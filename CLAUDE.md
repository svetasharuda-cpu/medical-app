# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm start            # Start Expo dev server (scan QR with Expo Go)
npm run android      # Open on Android emulator/device
npm run ios          # Open on iOS simulator/device
npm run web          # Open in browser
npm run build:web    # expo export -p web, then generate the Workbox service worker into dist/
```

No test runner or linter is configured — there are no `test` or `lint` scripts.

## Architecture

**Expo SDK 56 / React Native 0.85** app. All user data lives in `AsyncStorage` — there is no app database or user backend. The only server-side code is a one-route Vercel proxy (`api/`) that exists solely to work around browser CORS when calling Anthropic from the web build.

### Navigation

`App.js` sets up a `createStackNavigator` with `headerShown: false` on every screen. All headers are rendered manually inside each screen. The navigator wraps everything in `LanguageProvider`.

### Screens

| Screen | Purpose |
|--------|---------|
| `HomeScreen` | Greeting, name entry, nav grid to the four feature areas |
| `MedicationsScreen` | CRUD for medications; AI prescription scanning via Anthropic API |
| `ScheduleScreen` | Daily/weekly view of medication intake times and adherence |
| `SummaryScreen` | Medical history report filterable by date, shareable as text |
| `DoctorScreen` | Doctor visit log (upcoming/past) |
| `WellbeingScreen` | Mood, blood pressure, pulse log with history |
| `ContactsScreen` | Emergency contacts with one-tap calling |

### Internationalisation

`utils/i18n.js` exports `translations` (all UI strings), `MED_NAMES`, `DOSAGES`, `SPECIALTIES`, `RELATIONS` — all keyed by `'ua'` or `'fr'`.

`utils/LanguageContext.js` provides `LanguageProvider` and the `useLang()` hook, which returns `{ lang, t, toggleLang }`. Every screen consumes `t` for translated strings. Default language is Ukrainian (`'ua'`), toggle switches to French (`'fr'`).

Date strings throughout the app use the format `DD.MM.YYYY` (Ukrainian convention).

### Notifications

`utils/notifications.js` manages two types of scheduled notifications via `expo-notifications`:
- **Daily repeating** (`DAILY` trigger) — one per medication time entry, cancelled and rescheduled whenever a medication is saved.
- **End-of-course** (`DATE` trigger) — fired once on the medication's end date.

Notification IDs are persisted in AsyncStorage under `notif_<medId>` and `notif_end_<medId>` to allow cancellation.

### AI Prescription Scanning

`MedicationsScreen` sends a base64-encoded image or PDF (camera, gallery, or file) to the Anthropic Messages API (`claude-sonnet-5`) to extract medication name, dosage, and schedule as JSON. The API key is entered by the user and stored in AsyncStorage under `'anthropic_api_key'`; it's sent client-side as the `x-api-key` header on every request, never persisted server-side.

- **Native (iOS/Android)**: calls `https://api.anthropic.com/v1/messages` directly.
- **Web**: calls same-origin `/api/anthropic`, which `api/anthropic.js` (a Vercel serverless function, routed via `vercel.json`) forwards to the Anthropic API — a direct browser call would be blocked by CORS. The proxy only relays the `x-api-key`/`anthropic-beta` headers and body; it does not read or store the key.
- **Web image handling**: `expo-image-picker`'s `maxWidth`/`maxHeight` are ignored by browsers, so `webCompressImage` in `MedicationsScreen` canvas-resizes to ≤1024px and re-encodes as JPEG (quality 0.7) before sending, to stay under Vercel's 4.5 MB request body limit. Uses `document.createElement('img')`, not `new Image()` (the latter breaks the web build).

Always check the versioned Expo docs before changing camera/file-picker code.

### Web / PWA deployment

The web build is deployed to Vercel as a static PWA:
- `public/index.html`, `public/manifest.json`, `public/icon-*.png` are the PWA shell served as-is.
- `npm run build:web` runs `expo export -p web` then `workbox generateSW workbox-config.js`, which generates `dist/sw.js` (Workbox config: `skipWaiting` + `clientsClaim` so a new deploy takes over immediately; cache-first for images, stale-while-revalidate for JS/CSS).
- `public/index.html` registers the service worker and force-reloads the page once a new worker activates, so users don't get stuck on a stale cached build after a deploy.
- `vercel.json` sets `outputDirectory: dist` and rewrites all paths except `/api/*` and `/sw.js` to `index.html` (SPA routing).

### Data Storage Keys (AsyncStorage)

| Key | Content |
|-----|---------|
| `userName` | String |
| `medications_v1` | JSON array of medication objects |
| `anthropic_api_key` | String |
| `notif_<id>` | JSON array of notification IDs |
| `notif_end_<id>` | Single notification ID string |
| `doctor_visits` | JSON array |
| `wellbeing_records` | JSON array |
| `contacts_v1` | JSON array |
