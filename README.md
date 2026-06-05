# To Do — Cross-platform Todo & Learning Planner

A local-first **todo and learning-planning** app built with **Expo + React Native + TypeScript**.
One codebase runs on **Web**, **iOS**, and **Windows desktop** (via Electron). All data lives on
your device — no backend, no account, no sign-in.

🔗 **Live demo (PWA):** https://hmago.github.io/todo-app/

---

## Highlights

- 📋 Rich tasks with subtasks, tags, priorities, estimates, links, due dates, and recurrence
- 📅 Calendar — month/week/day views, drag-to-reschedule, completion-day routing, device sync
- 🎓 Learning planner — goals, milestones, spaced repetition, Pomodoro timer, study streaks
- 🌟 Motivation — 200+ curated quotes with favorites and live search
- 📊 Analytics — trends, streaks, heatmap, CSV/PDF export
- 🔔 Local reminders & notifications (Web, iOS, desktop) with quiet hours
- ⚡ Natural-language quick-add (`gym tomorrow 6pm !high #health`)
- 📦 Full JSON backup/restore, installable as a PWA, offline-ready

---

## Getting started

Requires **Node.js 18+** and **npm**.

```bash
npm install
```

### Run it

| Target | Command | Notes |
|--------|---------|-------|
| **Web** | `npm run web` | Opens at http://localhost:8081/todo-app/ |
| **iOS (phone)** | `npm start` → scan QR with Expo Go | Same Wi-Fi required |
| **iOS (simulator)** | `npm run ios` | macOS + Xcode only |
| **Windows desktop (dev)** | `npm run desktop` | Runs Electron against the dev build |

### Build the Windows desktop installer

One command produces the installer at `release\To Do Setup.exe`:

```bash
npm run desktop:build
```

That's it. The script web-exports the app to `dist/`, then packages it with `electron-builder`
into an NSIS installer (~160 MB, x64, unsigned). The `release/` folder is gitignored — distribute
the `.exe` directly.

Need an unpacked tree (no installer) for fast iteration? Use `npm run desktop:dir`; the executable
lands at `release\win-unpacked\To Do.exe`.

---

## All scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Expo dev server (pick a target interactively) |
| `npm run web` | Web dev server |
| `npm run ios` / `npm run android` | Native simulator/emulator dev |
| `npm run desktop` | Launch Electron in dev mode |
| `npm run desktop:build` | **Build the Windows installer** (`release\To Do Setup.exe`) |
| `npm run desktop:dir` | Build the unpacked desktop app only (faster) |
| `npm run build:web` | Static web export to `dist/` |
| `npm run deploy` | Publish `dist/` to `gh-pages` |
| `npx tsc --noEmit` | Type-check |

---

## Tech stack

Expo SDK 56 · React Native 0.85 · `react-native-web` · TypeScript (strict) · Zustand (persisted) ·
`@react-native-async-storage/async-storage` · date-fns · Electron 33 · `electron-builder`.

Native extras: `expo-notifications`, `expo-calendar`, `expo-haptics`.
Web extras: service worker (offline + notifications), web app manifest.

---

## Data & privacy

- **Local-first** — everything is stored on-device; nothing is sent to a server.
- **Backup / restore** — Settings → *Backup & data* exports a full JSON snapshot, importable on
  any other device. Analytics also supports CSV import/export.
- **Reset** — clear site data (web), reinstall (iOS), or uninstall (desktop).

---

## Deployment

Pushes to `main` auto-deploy the web build to GitHub Pages via
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). The base path is set with
`experiments.baseUrl: "/todo-app"` in `app.json` so assets resolve under the subpath.

See [`HOW_TO_START.md`](./HOW_TO_START.md) for a longer dev walkthrough and troubleshooting tips.
