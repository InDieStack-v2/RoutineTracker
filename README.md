# Routine Tracker

A daily routine and habit tracker built with [Expo](https://expo.dev) and React Native. Runs on iOS, Android and the web (installable as a PWA).

## Features

- Routine tasks with icon, color, time of day (morning / afternoon / evening) and daily, weekly or monthly repeats
- Home dashboard with completion stats and a streak (with freezes)
- Mood logging
- Local reminders via notifications
- Light, Dark and System themes
- English and Vietnamese (`i18n/`)
- All data stored on-device in SQLite (`expo-sqlite`)

## Tech stack

- Expo SDK 57, React Native 0.86, React 19, TypeScript (strict)
- [Expo Router](https://docs.expo.dev/router/introduction) (file-based routing in `app/`)
- [NativeWind](https://www.nativewind.dev) + [Gluestack UI](https://gluestack.io) v1
- Zustand for state (persisted via AsyncStorage)
- Jest (`jest-expo`) for tests

## Get started

This project uses [pnpm](https://pnpm.io). Don't use npm or yarn.

```bash
pnpm install
pnpm start        # Expo dev server
```

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `pnpm ios`         | Build and run on the iOS simulator/device                 |
| `pnpm android`     | Build and run on the Android emulator/device              |
| `pnpm web`         | Dev server for web at http://localhost:8081 (COOP/COEP headers set for SQLite) |
| `pnpm build:web`   | Static web export to `dist/`                              |
| `pnpm lint`        | ESLint via `expo lint`                                    |
| `pnpm test`        | Jest, pinned to `TZ=America/New_York`                     |
| `pnpm test:watch`  | Jest in watch mode                                        |
| `pnpm test:coverage` | Jest with coverage                                      |
| `pnpm test:date`   | Standalone date utility script (not run by Jest)          |

Type check with `pnpm exec tsc --noEmit` (existing errors in `components/ui/` are known).

## Project structure

```
app/          Expo Router screens (tabs: Home, Task, Mood, Settings; tasks/form)
components/   Reusable UI (ui/ holds Gluestack primitives, do not edit)
hooks/        Custom hooks
services/     Business logic: DB, scheduling, streaks, dashboard stats, notifications
store/        Zustand stores
i18n/         Translations (en, vi)
utils/        Date and timezone helpers
public/       Web PWA files (manifest, service worker, headers)
```

See [AGENTS.md](AGENTS.md) for code style, theming rules and testing conventions.

## Deploying the web build

`pnpm build:web` exports to `dist/`. Host it with the `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` headers (see `public/_headers`), which the web SQLite build needs.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction)
