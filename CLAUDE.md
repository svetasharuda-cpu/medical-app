# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm start            # Start Expo dev server (scan QR with Expo Go)
npm run android      # Open on Android emulator/device
npm run ios          # Open on iOS simulator/device
npm run web          # Open in browser
```

No test runner or linter is configured — there are no `test` or `lint` scripts.

## Architecture

**Expo SDK 56 / React Native 0.85** app with no backend — all data lives in `AsyncStorage`.

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

`MedicationsScreen` sends a base64-encoded image (camera, gallery, or file) to the Anthropic Messages API (`claude-opus-4-5`) to extract medication name, dosage, and schedule. The API key is entered by the user and stored in AsyncStorage under `'anthropic_api_key'`. Always check the versioned Expo docs before changing camera/file-picker code.

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
