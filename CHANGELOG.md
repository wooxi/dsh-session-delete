# Changelog

## 0.2.0

- Deleting a workspace now offers a cascade confirmation when the workspace still owns sessions. Confirming permanently deletes every session in it through the existing host route, then removes the workspace registration. The folder on disk is kept.

## 0.1.0

- Add a **Delete session** action to the sidebar session menu.
- Confirmation dialog built from the DSH `Modal` primitive, with light/dark theme support, danger styling, inline errors, and a busy state.
- Host route `POST /api/dsh/session-delete`: validates the id, detaches live sessions, unlinks the session from workspaces, removes the on-disk log directory, rebuilds the header index, and broadcasts `api-session/removed`.
- Refresh the sidebar in place after deletion instead of reloading the page.
- Keep the selected workspace and return to the home screen when the deleted session was the active one.
