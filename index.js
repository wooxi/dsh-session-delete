/**
 * Session deletion for dsh.
 *
 * The shipped session controller only archives; there is no delete method on
 * the persistence service either. This host plugin owns the missing lifecycle:
 * detach a live session (emitting `session/disposed` so the projection cache
 * and search index react), unaccount it from its workspace, then remove its
 * on-disk log directory.
 *
 * Transport: an exact Fetch route under `/api/` so the shipped Host/Origin
 * fence and browser-cookie authentication apply unchanged (the NPM vhost
 * rewrites Origin for `/api/` only).
 */
import { rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'

export const name = 'session-delete'
export const inject = ['connection', 'sessions', 'sessionPersistence', 'workspaceRegistry']

const ROUTE = '/api/dsh/session-delete'

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

export function apply(ctx) {
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

    // 1. Detach a live session first: this closes its write handle and emits
    //    `session/disposed`, which the projection cache and search index follow.
    const live = ctx.sessions.get(sessionId)
    if (live !== undefined) {
      const entry = ctx.sessions.liveEntryFor(live)
      if (entry !== undefined) ctx.sessions.detachEntered(entry)
    }

    // 2. Unaccount it from the workspace record and the global sets.
    for (const workspace of ctx.workspaceRegistry.list()) {
      if (!workspace.record.sessionIds.includes(sessionId)) continue
      try {
        await workspace.detachSession(sessionId)
      } catch {
        // A racing mutation already removed it.
      }
    }
    for (const method of ['unarchiveSession', 'unpinSession']) {
      try {
        await ctx.workspaceRegistry[method](sessionId)
      } catch {
        // Not accounted there — idempotent for our purpose.
      }
    }

    // 3. Remove the stored log directory, bounded to the sessions root.
    const root = sessionsRoot()
    const dir = cwd === undefined
      ? join(root, '_no-cwd', encodeSegment(sessionId))
      : join(root, projectKey(cwd), encodeSegment(sessionId))
    if (!dir.startsWith(root + sep)) {
      return Response.json({ error: 'refused path outside sessions root' }, { status: 400 })
    }
    await rm(dir, { recursive: true, force: true })

    // 4. Rebuild the header index so `sessionKnown`/workspace rows stop
    //    reporting the id before any restart.
    try {
      await ctx.workspaceRegistry.replaceHeaderIndex(await ctx.workspaceRegistry.listStoredHeaders())
    } catch {
      // The next startup rebuilds it anyway.
    }

    // 5. Notify every connected client. A live session already published this
    //    through `session/disposed`, but a cold one has no live entry, and the
    //    removal must still reach other tabs. The client handler is idempotent.
    ctx.emit('api-session/removed', sessionId)

    return Response.json({ deleted: true, sessionId })
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
