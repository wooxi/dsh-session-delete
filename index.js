/**
 * Session deletion for dsh.
 *
 * The shipped session controller only archives; there is no delete method on
 * the persistence service either. This host plugin owns the missing lifecycle:
 * drain and detach a live session (emitting `session/disposed` so the
 * projection cache and search index react), unaccount it from its workspace,
 * then remove its on-disk log directory.
 *
 * Transport: an exact Fetch route under `/api/` so the shipped Host/Origin
 * fence and browser-cookie authentication apply unchanged (the NPM vhost
 * rewrites Origin for `/api/` only).
 */
import { rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'

export const name = 'session-delete'
export const inject = ['connection', 'sessions', 'sessionPersistence', 'workspaceRegistry']

const ROUTE = '/api/dsh/session-delete'

/**
 * A workspace cascade issues one request per session. Rebuilding the header
 * index on every one of them re-stats every stored session, which makes the
 * cascade quadratic; a short window collapses the burst into one rebuild.
 */
const REBUILD_DELAY_MS = 300

/** Encode one path segment exactly as the JSONL persistence backend does. */
function encodeSegment(raw) {
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

/** Readable project directory key; mirrors the backend's projectKey(). */
function projectKey(cwd) {
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
}

function sessionsRoot() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'sessions')
}

/** Yield one macrotask so a pending writer `close()` can finish its drain. */
function nextMacrotask() {
  return new Promise((resolve) => setImmediate(resolve))
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx) {
  let rebuildTimer = null

  async function rebuildHeaderIndex() {
    try {
      await ctx.workspaceRegistry.replaceHeaderIndex(await ctx.workspaceRegistry.listStoredHeaders())
    } catch (error) {
      // The next startup rebuilds it anyway; this line is what makes the
      // difference visible instead of silent.
      ctx.logger.warn(`session-delete: header index rebuild failed: ${messageOf(error)}`)
    }
  }

  function scheduleIndexRebuild() {
    if (rebuildTimer !== null) return
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null
      void rebuildHeaderIndex()
    }, REBUILD_DELAY_MS)
    rebuildTimer.unref?.()
  }

  /**
   * Remove one log directory without hiding the outcome.
   *
   * `force` stays off so a wrong path — a storage root that moved, a header
   * whose cwd no longer resolves — surfaces as ENOENT rather than a silent
   * success. The second pass covers a writer whose `close()` drain lands after
   * the first `rm` and recreates the directory.
   */
  async function removeLogDir(dir) {
    let logMissing = false
    try {
      await rm(dir, { recursive: true, force: false })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') logMissing = true
      else throw error
    }
    await nextMacrotask()
    const revived = await stat(dir).then(
      () => true,
      () => false,
    )
    if (revived) {
      ctx.logger.warn(`session-delete: log directory reappeared after removal: ${dir}`)
      await rm(dir, { recursive: true, force: true })
    }
    return logMissing
  }

  async function deleteSession(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 })
    }
    const sessionId = body?.sessionId
    if (typeof sessionId !== 'string' || !/^session-[A-Za-z0-9._-]+$/.test(sessionId)) {
      return Response.json({ error: 'invalid sessionId' }, { status: 400 })
    }

    // Header is the only source of `cwd`, and deleting without it would leave
    // the log directory orphaned, so refuse rather than guess.
    const snapshot = await ctx.sessionPersistence.stat(sessionId)
    if (snapshot === undefined) return Response.json({ error: 'session not found' }, { status: 404 })
    const cwd = snapshot.header.cwd

    const live = ctx.sessions.get(sessionId)
    const wasLive = live !== undefined

    // 0. Drain write buffers while the handle is still open. `detachEntered`
    //    below makes the backend call `writer.close()`, which drains
    //    asynchronously and would recreate the directory we are about to
    //    remove; flushing first leaves that close with nothing to write.
    if (typeof ctx.sessionPersistence.flush === 'function') {
      try {
        await ctx.sessionPersistence.flush()
      } catch (error) {
        ctx.logger.warn(`session-delete: flush before deleting "${sessionId}" failed: ${messageOf(error)}`)
      }
    }

    // 1. Detach a live session first: this closes its write handle and emits
    //    `session/disposed`, which the projection cache and search index follow.
    if (live !== undefined) {
      const entry = ctx.sessions.liveEntryFor(live)
      if (entry !== undefined) ctx.sessions.detachEntered(entry)
    }

    // 2. Unaccount it from the workspace record and the global sets.
    for (const workspace of ctx.workspaceRegistry.list()) {
      if (!workspace.record.sessionIds.includes(sessionId)) continue
      try {
        await workspace.detachSession(sessionId)
      } catch (error) {
        // A racing mutation already removed it; anything else is a real fault.
        ctx.logger.warn(`session-delete: detaching "${sessionId}" from workspace failed: ${messageOf(error)}`)
      }
    }
    // Both methods return silently when the id was never accounted there, so a
    // throw here is a storage fault worth reporting.
    for (const method of ['unarchiveSession', 'unpinSession']) {
      try {
        await ctx.workspaceRegistry[method](sessionId)
      } catch (error) {
        ctx.logger.warn(`session-delete: ${method}("${sessionId}") failed: ${messageOf(error)}`)
      }
    }

    // 3. Remove the stored log directory, bounded to the sessions root.
    const root = sessionsRoot()
    const dir = cwd === undefined
      ? join(root, '_no-cwd', encodeSegment(sessionId))
      : join(root, projectKey(cwd), encodeSegment(sessionId))
    if (!dir.startsWith(root + sep)) {
      ctx.logger.warn(`session-delete: refused path outside sessions root: ${dir}`)
      return Response.json({ error: 'refused path outside sessions root' }, { status: 400 })
    }
    const logMissing = await removeLogDir(dir)

    // 4. Rebuild the header index so `sessionKnown`/workspace rows stop
    //    reporting the id. Deferred and collapsed so a cascade pays for one
    //    rebuild instead of one per session.
    scheduleIndexRebuild()

    // 5. Notify every connected client. A live session already published this
    //    through `session/disposed`, but a cold one has no live entry, and the
    //    removal must still reach other tabs. The client handler is idempotent.
    ctx.emit('api-session/removed', sessionId)

    ctx.logger.info(
      `session-delete: removed "${sessionId}" (cwd=${cwd ?? '<none>'}, live=${wasLive}, log=${logMissing ? 'already-gone' : 'removed'})`,
    )

    return Response.json({ deleted: true, sessionId, logMissing })
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: deleteSession,
      }),
    'session-delete: /api/dsh/session-delete',
  )
}
