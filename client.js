window.__ModuleLoader__.load({
	id: "dsh-plugin-session-delete",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
var ROUTE = "/api/dsh/session-delete";
function createRequestStore() {
  let current = null;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => current,
    set(next) {
      if (current === next) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
var requestStore = createRequestStore();
async function readFailure(response) {
  const text = await response.text().catch(() => "");
  let detail = text;
  if (text !== "") {
    try {
      const parsed = JSON.parse(text);
      if (parsed !== null && typeof parsed === "object" && typeof parsed.error === "string") {
        detail = parsed.error;
      }
    } catch {
    }
  }
  return detail === "" ? `HTTP ${response.status}` : detail;
}
function isCurrentSession(sessions, sessionId) {
  const snapshot = sessions.list.getSnapshot();
  return Object.values(snapshot.byId).some(
    (row) => row.id === sessionId && (row.retainedBy?.mainView ?? 0) > 0
  );
}
function workspaceIdFor(ctx, sessionId) {
  const workspaces = ctx.get("workspaces");
  const snapshot = workspaces?.list?.getSnapshot?.();
  const item = snapshot?.items?.find((workspace) => workspace.sessionIds.includes(sessionId));
  return item?.workspaceId;
}
function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState }) {
  const [, setMenuOpen] = useMenuOpenState();
  const title = typeof displayTitle === "string" && displayTitle.trim() !== "" ? displayTitle : sessionId;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.MenuItemButton,
    {
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
      onSelect: () => {
        setMenuOpen(false);
        requestStore.set({ sessionId, title });
      },
      children: "\u5220\u9664\u4F1A\u8BDD"
    }
  );
}
function DeleteSessionDialog({ ctx, request }) {
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const close = () => {
    if (busy) return;
    requestStore.set(null);
  };
  const remove = async () => {
    if (busy) return;
    const wasCurrent = isCurrentSession(ctx.sessions, request.sessionId);
    const workspaceId = wasCurrent ? workspaceIdFor(ctx, request.sessionId) : void 0;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: request.sessionId })
      });
      if (!response.ok) throw new Error(await readFailure(response));
      requestStore.set(null);
      await ctx.sessions.refresh().catch(() => {
      });
      if (wasCurrent) {
        const uiWorkspace = ctx.get("uiWorkspace");
        const reopen = workspaceId !== void 0 && typeof uiWorkspace?.openWorkspace === "function";
        if (reopen) {
          await uiWorkspace.openWorkspace(workspaceId).catch(() => uiWorkspace?.clearMain?.());
        } else if (typeof uiWorkspace?.clearMain === "function") {
          uiWorkspace.clearMain();
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Modal, { open: true, headless: true, title: "\u5220\u9664\u4F1A\u8BDD", onClose: close, className: "dsd-modal", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsd-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dsd-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsd-badge", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsd-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dsd-title", children: "\u5220\u9664\u4F1A\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsd-kicker", children: "\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "dsd-close",
          "aria-label": "\u5173\u95ED",
          title: "\u5173\u95ED",
          disabled: busy,
          onClick: close,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsd-content", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsd-question", children: "\u786E\u5B9A\u8981\u6C38\u4E45\u5220\u9664\u8FD9\u4E2A\u4F1A\u8BDD\u5417\uFF1F" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsd-target", title: request.title, children: request.title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsd-note", children: "\u4F1A\u8BDD\u8BB0\u5F55\u3001\u6D88\u606F\u548C\u9644\u4EF6\u90FD\u4F1A\u4ECE\u672C\u673A\u79FB\u9664\uFF0C\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\u3002" }),
      error !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsd-error", role: "alert", children: error }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsd-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", disabled: busy, "data-modal-autofocus": true, onClick: close, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          className: "dsd-confirm",
          disabled: busy,
          "aria-busy": busy,
          onClick: () => void remove(),
          children: busy ? "\u6B63\u5728\u5220\u9664\u2026" : "\u5220\u9664\u4F1A\u8BDD"
        }
      )
    ] })
  ] }) });
}
var CSS = `
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
`;
var inject = ["slots", "sessions", "workspaces"];
function apply(ctx) {
  ctx.effect(
    () => {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-plugin-session-delete";
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    },
    "session-delete: styles"
  );
  ctx.slots.inject("sidebar.workspaces.session.menu.item", function* () {
    yield ctx.slots.register(
      {
        name: "sidebar.workspaces.session.menu.item",
        id: "delete",
        order: 500
      },
      DeleteSessionMenuItem
    );
  });
  ctx.slots.inject("shell.overlay", function* () {
    function SessionDeleteOverlay() {
      const request = (0, import_react.useSyncExternalStore)(requestStore.subscribe, requestStore.get);
      if (request === null) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        DeleteSessionDialog,
        {
          ctx,
          request
        },
        request.sessionId
      );
    }
    yield ctx.slots.register(
      {
        name: "shell.overlay",
        id: "session-delete",
        order: 500
      },
      SessionDeleteOverlay
    );
  });
}
		return module.exports;
	}
});
