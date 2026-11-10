# Orarul meu

A small static web app for the school timetable, homework, announcements, polls, calendar, and class chat.

## Source of truth

The live app is built from this GitHub repository. The project folder open in some local workspaces may contain an older standalone copy; use the repository files below when changing the live app.

## File map

- `index.html` — page structure and entry point. Loads the stylesheet, Supabase client, and app script.
- `styles.css` — all active app styling, including responsive and admin layouts.
- `app.js` — Supabase setup, shared app state, rendering, interactions, admin tools, realtime updates, and startup.
- `sw.js` — service worker, offline app-shell cache, and push notification handling.
- `manifest.json` and `icon.svg` — installable app metadata and icon.
- `supabase/migrations/` — versioned database changes. Keep database changes here; do not put them in frontend files.

## How the app starts

1. The browser loads `index.html`, then `styles.css`.
2. The Supabase client library loads before `app.js`.
3. `app.js` creates the client, refreshes auth, loads the core tables, then renders the dashboard and calendar.
4. Realtime subscriptions refresh affected screens as records change.
5. `sw.js` caches the app shell for offline startup and handles push notifications.

## Finding behavior in `app.js`

Search for these section comments:

- `App configuration and shared state`
- `Browser notifications`, `Theme and visitor identity`, `Authentication`
- `Core data loading`, `Timetable and schedule changes`
- `Tasks and attachments`, `Task completion and summaries`
- `Polls`, `Comments and chat`, `Public chat`
- `Page navigation and overlays`, `Calendar`
- `Admin dashboard`
- `Visit history and online presence`, `Realtime subscriptions`
- `Startup and initial render`

Search for a function name to locate one action; search for a table name to locate its reads or writes.

## Finding styles

Search `styles.css` for the component class or ID. Responsive rules and final overrides are spread across the file, so search for every occurrence of a selector before changing or removing one.

## Change workflow

- Base changes on the current repository, not an older local copy.
- Keep changes on a branch and use its Vercel preview for review.
- Update the service worker cache version when changing the app shell.
- Keep schema changes in `supabase/migrations/`.
