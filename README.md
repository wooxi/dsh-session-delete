# Session Delete for DSH

Permanently delete a DeepSeek Harness (dsh) session from the sidebar — with a proper confirmation dialog and no full-page reload.

DSH ships *archive*, not *delete*. This plugin fills that gap: it removes the session record, detaches it from every workspace, closes any live handle, and deletes the on-disk log directory.

![Delete session in the sidebar menu](assets/sidebar-menu.png)

## Features

- **Delete session** entry in the sidebar session menu, right after the built-in actions.
- A confirmation modal in the Claude / OpenCode visual language, built from the DSH `Modal` primitive and design tokens.
  - Light and dark themes.
  - Red danger action, session title, “cannot be undone” copy.
  - `Esc`, backdrop click, and an explicit close button.
  - Inline error message when the host rejects the request.
  - Busy state while the request is in flight.
- **No page reload.** After a successful delete the sidebar refreshes in place through `sessions.refresh()`.
- **Deleting the active session** clears the main view, keeps the workspace selected, and returns to the home screen. Deleting a background session keeps the current view untouched.
- **Delete a workspace together with its sessions.** When a workspace still owns sessions, deleting it opens a cascade confirmation that shows the session count. Confirming permanently deletes every session in that workspace, then removes the workspace registration. The folder on disk is left untouched.
- The host broadcasts `api-session/removed`, so other open tabs drop the row as well.

| Light | Dark |
| --- | --- |
| ![Light confirmation dialog](assets/confirm-light.png) | ![Dark confirmation dialog](assets/confirm-dark.png) |

## Install

```sh
# from npm (once published)
dsh plugin add dsh-plugin-session-delete

# directly from GitHub
dsh plugin add github:wooxi/dsh-session-delete
```

Restart the DSH web service after installing. The package declares a `dsh.bundle` patch and ships `client.js` prebuilt, so no build step or build approval is required.

To uninstall:

```sh
dsh plugin remove dsh-plugin-session-delete
```

## Compatibility

- DSH `>=0.2.1-rc.1 <0.3.0-0`
- Web client only (`dsh.client.platform: "web"`)
- Node.js `>=20`

## How it works

**Host** (`index.js`) registers `POST /api/dsh/session-delete`. The route:

1. Validates the session id (`/^session-[A-Za-z0-9._-]+$/`) and confirms the session exists.
2. If the session is live, detaches it from the session controller — this closes write handles and emits `session/disposed`, so the projection cache and search index follow.
3. Detaches the id from every workspace that references it, and clears archive/pin state.
4. Removes the session's log directory under the dsh sessions root. The resolved path is checked to stay inside that root.
5. Rebuilds the stored-session header index and emits `api-session/removed`.

**Client** (`src/client.jsx`) adds the menu item and renders the dialog through the `shell.overlay` slot. The menu closes before the dialog opens, so the dialog is owned by the overlay and survives menu unmounting. After a successful delete it calls `ctx.sessions.refresh()`, then either keeps the workspace (via `uiWorkspace.openWorkspace`) or clears the main view.

Workspace deletion wraps `ctx.workspaces.delete`. When the workspace still owns sessions, the wrapper opens a cascade confirmation before the official deletion runs. Confirming deletes each session through the same host route, refreshes the session list, and then calls the original `workspaces.delete` — so the folder stays in place while the sessions themselves are gone.

## Security and data

- Deletion is **permanent**: messages, attachments metadata, and the session log directory are removed from this machine.
- The route is `POST`-only, same-origin, and uses the host's existing cookie authentication. No token is stored by the plugin.
- Session ids are validated before any path is built, and the delete path must stay under the sessions root.
- The plugin makes no network requests.

## Development

```sh
npm install
npm run build
```

`npm run build` bundles `src/client.jsx` into the browser module envelope dsh expects (`client.js`). The host entry is plain ESM and is not bundled.

## License

MIT
