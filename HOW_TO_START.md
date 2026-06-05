# How to Start To Do

A quick guide to running the app on **web**, **iOS**, and **Windows desktop**.

## Prerequisites

- **Node.js** (v18+; this project was built with v24) and **npm** installed.
- Project dependencies installed (run once after cloning):
  ```powershell
  npm install
  ```

All commands below are run from the project folder:
`C:\Users\harshitmago\Documents\code\todo_app`

---

## Run on the Web (easiest)

```powershell
npm run web
```

Then open your browser to:

> http://localhost:8081

The page reloads automatically when you change code.

---

## Run on iPhone (no Mac required)

1. Install **Expo Go** from the App Store on your iPhone.
2. Start the dev server:
   ```powershell
   npm start
   ```
3. Scan the QR code shown in the terminal using your iPhone **Camera** app
   (or the Expo Go app). The app opens live on your phone.

> Your computer and iPhone must be on the **same Wi-Fi network**.

---

## Run on iOS Simulator (macOS only)

Requires a Mac with **Xcode** installed:

```powershell
npm run ios
```

> This does **not** work on Windows — use the Web or Expo Go options above instead.

---

## Run on Windows desktop

The desktop app is an **Electron** wrapper around the web build.

**Dev mode** (rebuilds on save when paired with `npm run web` in a second terminal):

```powershell
npm run desktop
```

**Build the installer:**

```powershell
npm run desktop:build
```

The installer lands at `release\To Do Setup.exe` (~160 MB, x64, unsigned). Double-click to install
or distribute as-is. The `release/` folder is gitignored.

For fast iteration without rebuilding the installer, use `npm run desktop:dir` — the unpacked app
lives at `release\win-unpacked\To Do.exe`.

---

## Other commands

| Command          | What it does                                  |
|------------------|-----------------------------------------------|
| `npm start`      | Start Expo dev server (choose web/iOS/Android)|
| `npm run web`    | Start directly in the browser                 |
| `npm run ios`    | Start in the iOS Simulator (macOS only)       |
| `npm run android`| Start in an Android emulator                  |
| `npm run desktop`     | Run the Electron desktop app in dev mode  |
| `npm run desktop:build` | Build the Windows installer (`release\To Do Setup.exe`) |
| `npm run desktop:dir`   | Build the unpacked desktop app only (faster) |
| `npx tsc --noEmit` | Type-check the project                       |

---

## Stopping the server

Press **Ctrl + C** in the terminal where the server is running.

---

## Troubleshooting

- **Port 8081 already in use** → start on another port:
  ```powershell
  npx expo start --web --port 8082
  ```
- **Browser shows a blank page** → wait for the first bundle to finish
  (the terminal prints `Web Bundled …`), then refresh.
- **Changes not appearing** → save the file; if needed, press `r` in the
  terminal to reload, or restart the server.
- **Dependency errors** → delete `node_modules` and reinstall:
  ```powershell
  Remove-Item -Recurse -Force node_modules; npm install
  ```
