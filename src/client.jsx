import { useState, useSyncExternalStore } from 'react'
import {
  Button,
  IconCloseOutlineRegular,
  IconTrashOutlineRegular,
  MenuItemButton,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'

const ROUTE = '/api/dsh/session-delete'

/**
 * The menu item lives inside the row menu, which unmounts as soon as the menu
 * closes. The confirmation therefore cannot be rendered from the item: it is
 * published to a module-level store and picked up by the overlay below.
 */
function createRequestStore() {
  let current = null
  const listeners = new Set()
  return {
    get: () => current,
    set(next) {
      if (current === next) return
      current = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const requestStore = createRequestStore()

/** Turn a failed response into the message we want to show in the dialog. */
async function readFailure(response) {
  const text = await response.text().catch(() => '')
  let detail = text
  if (text !== '') {
    try {
      const parsed = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object' && typeof parsed.error === 'string') {
        detail = parsed.error
      }
    } catch {
      // Not JSON: show the raw body.
    }
  }
  return detail === '' ? `HTTP ${response.status}` : detail
}

function isCurrentSession(sessions, sessionId) {
  const snapshot = sessions.list.getSnapshot()
  return Object.values(snapshot.byId).some(
    (row) => row.id === sessionId && (row.retainedBy?.mainView ?? 0) > 0,
  )
}

function currentSessionId(sessions) {
  const snapshot = sessions.list.getSnapshot()
  return Object.values(snapshot.byId).find((row) => (row.retainedBy?.mainView ?? 0) > 0)?.id
}

function workspaceById(ctx, workspaceId) {
  const snapshot = ctx.get('workspaces')?.list?.getSnapshot?.()
  return snapshot?.items?.find((workspace) => workspace.workspaceId === workspaceId)
}

function workspaceSessionIds(ctx, workspaceId) {
  return workspaceById(ctx, workspaceId)?.sessionIds ?? []
}

function workspaceIdFor(ctx, sessionId) {
  const snapshot = ctx.get('workspaces')?.list?.getSnapshot?.()
  return snapshot?.items?.find((workspace) => workspace.sessionIds.includes(sessionId))
    ?.workspaceId
}

function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState }) {
  const [, setMenuOpen] = useMenuOpenState()
  const title =
    typeof displayTitle === 'string' && displayTitle.trim() !== '' ? displayTitle : sessionId
  return (
    <MenuItemButton
      icon={<IconTrashOutlineRegular size={14} />}
      onSelect={() => {
        setMenuOpen(false)
        requestStore.set({ sessionId, title })
      }}
    >
      删除会话
    </MenuItemButton>
  )
}

function DeleteSessionDialog({ ctx, request }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    if (busy) return
    requestStore.set(null)
  }

  const remove = async () => {
    if (busy) return
    // Read the selection before the request: the host disposes a live session
    // while handling it, and the removal event releases the main-view retain
    // before the response even reaches this tab.
    const wasCurrent = isCurrentSession(ctx.sessions, request.sessionId)
    const workspaceId = wasCurrent ? workspaceIdFor(ctx, request.sessionId) : undefined
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: request.sessionId }),
      })
      if (!response.ok) throw new Error(await readFailure(response))

      requestStore.set(null)
      // The host also broadcasts `api-session/removed`, but a refresh keeps
      // this tab authoritative (cold sessions have no live entry to dispose).
      await ctx.sessions.refresh().catch(() => {})
      if (wasCurrent) {
        const uiWorkspace = ctx.get('uiWorkspace')
        const reopen =
          workspaceId !== undefined && typeof uiWorkspace?.openWorkspace === 'function'
        if (reopen) {
          // `clearMain` empties the workspace selection, which leaves the hero
          // composer asking for a folder. Reopening the workspace keeps the
          // "What's up next" state and the folder chip.
          await uiWorkspace.openWorkspace(workspaceId).catch(() => uiWorkspace?.clearMain?.())
        } else if (typeof uiWorkspace?.clearMain === 'function') {
          uiWorkspace.clearMain()
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <Modal open headless title="删除会话" onClose={close} className="dsd-modal">
      <div className="dsd-panel">
        <header className="dsd-head">
          <span className="dsd-badge" aria-hidden="true">
            <IconTrashOutlineRegular size={16} />
          </span>
          <div className="dsd-heading">
            <h2 className="dsd-title">删除会话</h2>
            <p className="dsd-kicker">此操作不可撤销</p>
          </div>
          <button
            type="button"
            className="dsd-close"
            aria-label="关闭"
            title="关闭"
            disabled={busy}
            onClick={close}
          >
            <IconCloseOutlineRegular size={14} />
          </button>
        </header>

        <div className="dsd-content">
          <p className="dsd-question">确定要永久删除这个会话吗？</p>
          <div className="dsd-target" title={request.title}>
            {request.title}
          </div>
          <p className="dsd-note">会话记录、消息和附件都会从本机移除，删除后无法恢复。</p>
          {error !== null ? (
            <p className="dsd-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="dsd-actions">
          <Button variant="ghost" disabled={busy} data-modal-autofocus onClick={close}>
            取消
          </Button>
          <Button
            variant="outline"
            className="dsd-confirm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void remove()}
          >
            {busy ? '正在删除…' : '删除会话'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteWorkspaceDialog({ ctx, request }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(request.sessionIds.length)
  const [remaining, setRemaining] = useState(request.sessionIds.length)

  const close = () => {
    if (busy) return
    requestStore.set(null)
    // The official workspace dialog is still awaiting this promise. Rejecting
    // is the only way to release its pending state, so cancellation surfaces
    // there as an ordinary delete error instead of a stuck "deleting…" button.
    request.reject(new Error('已取消删除工作区'))
  }

  const remove = async () => {
    if (busy) return
    // Re-read the account on every attempt: a previous partial failure may
    // already have detached some sessions, and a retry must not target them.
    const sessionIds = [...workspaceSessionIds(ctx, request.workspaceId)]
    const current = currentSessionId(ctx.sessions)
    setBusy(true)
    setError(null)
    setTotal(sessionIds.length)
    setRemaining(sessionIds.length)
    try {
      if (current !== undefined && sessionIds.includes(current)) {
        // Clear the main view before its session disappears; otherwise the
        // removal event leaves a "Session unavailable" panel behind.
        ctx.get('uiWorkspace')?.clearMain?.()
      }
      for (const sessionId of sessionIds) {
        const response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        // A retry can race a previous partial deletion. An already-gone
        // session is the desired end state, not a failure.
        if (!response.ok && response.status !== 404) {
          throw new Error(await readFailure(response))
        }
        setRemaining((count) => Math.max(0, count - 1))
      }
      await ctx.sessions.refresh().catch(() => {})
      await request.commit()
      requestStore.set(null)
      request.resolve()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <Modal open headless title="删除工作区" onClose={close} className="dsd-modal">
      <div className="dsd-panel">
        <header className="dsd-head">
          <span className="dsd-badge" aria-hidden="true">
            <IconTrashOutlineRegular size={16} />
          </span>
          <div className="dsd-heading">
            <h2 className="dsd-title">删除工作区</h2>
            <p className="dsd-kicker">会同时删除其中的所有会话</p>
          </div>
          <button
            type="button"
            className="dsd-close"
            aria-label="关闭"
            title="关闭"
            disabled={busy}
            onClick={close}
          >
            <IconCloseOutlineRegular size={14} />
          </button>
        </header>

        <div className="dsd-content">
          <p className="dsd-question">
            确定要删除“{request.title}”及其中的 {total} 个会话吗？
          </p>
          <div className="dsd-target" title={request.title}>
            {request.title}
          </div>
          <p className="dsd-note">
            工作区会从列表中移除，文件夹本身保留；其中的会话记录、消息和附件都会永久删除，无法恢复。
          </p>
          {busy ? (
            <p className="dsd-progress" role="status">
              正在删除会话…（剩余 {remaining} 个）
            </p>
          ) : null}
          {error !== null ? (
            <p className="dsd-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="dsd-actions">
          <Button variant="ghost" disabled={busy} data-modal-autofocus onClick={close}>
            取消
          </Button>
          <Button
            variant="outline"
            className="dsd-confirm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void remove()}
          >
            {busy ? '正在删除…' : total > 0 ? `删除工作区及 ${total} 个会话` : '删除工作区'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const CSS = `
.dsd-modal.dsd-modal {
  width: min(424px, 100%);
  padding: 0;
  gap: 0;
  border: 1px solid var(--dsw-alias-border-l1);
}

.dsd-panel {
  display: flex;
  flex-direction: column;
}

.dsd-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 16px 0 20px;
}

.dsd-badge {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);
}

.dsd-heading {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 1px;
}

.dsd-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: 0.01em;
}

.dsd-kicker {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.dsd-close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin-top: 2px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--dsw-alias-label-tertiary);
  background: transparent;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.dsd-close:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dsd-close:disabled {
  opacity: 0.4;
  cursor: default;
}

.dsd-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 0;
}

.dsd-question {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}

.dsd-target {
  padding: 9px 12px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsd-note {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.dsd-progress {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dsd-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  font-size: 12px;
  line-height: 18px;
}

.dsd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 18px 20px 20px;
}

.dsd-confirm.dsd-confirm {
  color: var(--dsw-alias-state-error-primary);
}

.dsd-confirm.dsd-confirm:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 36%, transparent);
  background: var(--dsw-alias-interactive-bg-hover-danger);
}
`

export const inject = ['slots', 'sessions', 'workspaces']

export function apply(ctx) {
  ctx.effect(
    () => {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-plugin-session-delete'
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => tag.remove()
    },
    'session-delete: styles',
  )

  ctx.slots.inject('sidebar.workspaces.session.menu.item', function* () {
    yield ctx.slots.register(
      {
        name: 'sidebar.workspaces.session.menu.item',
        id: 'delete',
        order: 500,
      },
      DeleteSessionMenuItem,
    )
  })

  ctx.slots.inject('shell.overlay', function* () {
    function DeleteOverlay() {
      const request = useSyncExternalStore(requestStore.subscribe, requestStore.get)
      if (request === null) return null
      if (request.kind === 'workspace') {
        return (
          <DeleteWorkspaceDialog
            key={request.workspaceId}
            ctx={ctx}
            request={request}
          />
        )
      }
      return (
        <DeleteSessionDialog
          key={request.sessionId}
          ctx={ctx}
          request={request}
        />
      )
    }

    yield ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'session-delete',
        order: 500,
      },
      DeleteOverlay,
    )
  })

  // The shipped workspace browser deletes a Workspace registration and leaves
  // its Sessions behind as ungrouped rows. Intercept that one command so the
  // rows disappear together: confirm the real blast radius, delete every
  // accounted Session through the host route, then let the official delete
  // proceed. A Workspace without Sessions keeps the original fast path.
  const workspaces = ctx.get('workspaces')
  if (workspaces !== undefined && typeof workspaces.delete === 'function') {
    const originalDelete = workspaces.delete.bind(workspaces)
    const wrappedDelete = (workspaceId) => {
      const workspace = workspaceById(ctx, workspaceId)
      const sessionIds = workspace?.sessionIds ?? []
      if (sessionIds.length === 0) return originalDelete(workspaceId)
      return new Promise((resolve, reject) => {
        requestStore.set({
          kind: 'workspace',
          workspaceId,
          title: workspace?.title || workspace?.path || workspaceId,
          sessionIds: [...sessionIds],
          commit: () => originalDelete(workspaceId),
          resolve,
          reject,
        })
      })
    }
    try {
      workspaces.delete = wrappedDelete
      ctx.effect(
        () => () => {
          if (workspaces.delete === wrappedDelete) workspaces.delete = originalDelete
        },
        'session-delete: workspace cascade',
      )
    } catch {
      // A sealed service keeps the official delete semantics; the host still
      // provides per-session deletion from its row menu.
    }
  }
}
