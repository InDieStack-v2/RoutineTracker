# routine-tracker Codebase Guide for Agents

This document provides essential information for AI agents working on the `routine-tracker` repository.

## 1. Project Overview

*   **Type:** React Native mobile application using Expo.
*   **Language:** TypeScript.
*   **Frameworks:** Expo Router, NativeWind (Tailwind CSS), Gluestack UI.
*   **State Management:** Zustand (persisted via AsyncStorage).
*   **Navigation:** Expo Router (file-based routing in `app/`).

## 2. Build, Lint, and Test Commands

### Build & Run
*   **Package manager:** This project uses **pnpm** (see `pnpm-lock.yaml`). Use `pnpm` for installs and scripts (`pnpm install`, `pnpm <script>`, `pnpm exec <bin>`); do not use `yarn` or `npm`, and do not create `yarn.lock` / `package-lock.json`.
*   **Start Development Server:** `pnpm start`
*   **Run on Android:** `pnpm android`
*   **Run on iOS:** `pnpm ios`
*   **Run on Web:** `pnpm web`

### Linting & Formatting
*   **Lint Code:** `pnpm lint` (Runs `expo lint` with ESLint)
*   **Format Code:** Uses Prettier. Ensure your editor or pre-commit hooks handle formatting, or run `pnpm exec prettier --write .` if unsure.

### Testing
*   **Framework:** Jest (`jest-expo` preset, config in `jest.config.js`). Tests live in `__tests__/` folders next to the code (e.g. `services/__tests__/`, `utils/__tests__/`).
*   **Run:** `pnpm test` (pinned to `TZ=America/New_York` so date/DST logic is deterministic). Single file: `pnpm exec cross-env TZ=America/New_York jest services/__tests__/dashboardStats.test.ts`.
*   **Known issue:** `utils/dateUtils.test.js` is a standalone Node script (run it with `pnpm test:date`); it calls `process.exit` and fails under Jest. Ignore it in `pnpm test` output.
*   **Tests are required for logic changes:** any new or changed business logic (scheduling, completion rates, streaks, date/timezone handling) must ship with unit tests.
    *   Keep logic in pure functions under `services/` or `utils/` (take data in, return data out) so it can be tested without rendering UI. Example: `services/dashboardStats.ts` holds the Home dashboard maths, and `app/(tabs)/index.tsx` only renders it.
    *   Services that import the DB or settings store need these mocks at the top of the test: `jest.mock('@/services/db', ...)`, `jest.mock('@/store/settingsStore', ...)`, `jest.mock('../logger')`. See `services/__tests__/dashboardStats.test.ts`.
    *   Use `@jest-environment node` for non-UI tests.
    *   Cover edge cases: empty input, window boundaries (off-by-one), days with nothing scheduled, task `createdAt`/`endDate`/`deletedAt`.
*   **Do not duplicate existing logic:** before computing something new (e.g. streak), check for an existing service/store. The streak shown in the Header and Dashboard comes from `store/streakStore.ts` (`services/streakService.ts`), which includes freezes.

## 3. Code Style Guidelines

### General
*   **Strictness:** The project uses `strict: true` in `tsconfig.json`. Ensure all types are explicitly defined; avoid `any` unless absolutely necessary.
*   **Functional Components:** Use functional components with hooks for all UI elements.
*   **Imports:**
    *   Use absolute imports with the `@` alias (e.g., `import { Foo } from "@/components/Foo"`).
    *   Group imports: External libraries first, then internal components/services.

### Naming Conventions
*   **Files:** `kebab-case` for general files, `PascalCase` for React components if they are the main export (though standard Expo structure often uses kebab-case for files like `index.tsx`).
    *   *Note:* The current codebase mixes conventions (e.g., `store/candyStore.ts` vs `components/ui/vstack/index.tsx`). Follow the prevailing pattern in the specific directory you are working in.
*   **Components:** `PascalCase` (e.g., `RoutineTask`, `CandyProvider`).
*   **Functions/Hooks:** `camelCase` (e.g., `useColorScheme`, `scheduleNotifications`).
*   **Variables:** `camelCase`.
*   **Interfaces/Types:** `PascalCase` (e.g., `RoutineTask`, `CandyState`).

### Styling (NativeWind + Gluestack)
*   Use **NativeWind** (Tailwind classes) for layout and standard styling.
    *   Example: `<View className="flex-1 bg-white p-4">`
*   Use **Gluestack UI** components for accessible primitives (Box, VStack, Text, Button, etc.).
    *   Example: `import { Box } from "@/components/ui/box";`
    *   Check `gluestack-ui.config.json` and `global.css` for theme configurations.
*   **Shadows:** Avoid using `shadow-*` utility classes (e.g., `shadow-md`, `shadow-lg`) from NativeWind as they can cause issues with Expo Router/Navigation on some platforms. Instead, use React Native's `StyleSheet` or the `style` prop with native shadow properties (`shadowColor`, `shadowOffset`, `shadowOpacity`, `elevation`, etc.).
*   **Light/Dark Theme (required):** The app supports Light, Dark and System themes (Settings → Theme, stored in `useSettingsStore().theme`). Every new or changed UI must look correct in **both** light and dark.
    *   Pair each hardcoded color class with a `dark:` variant, following the existing mapping: `bg-white` → `dark:bg-gray-900`, `bg-gray-50` → `dark:bg-gray-950`, `bg-gray-100` → `dark:bg-gray-800`, `border-gray-100` → `dark:border-gray-800`, `text-gray-900` → `dark:text-gray-50`, `text-gray-600` → `dark:text-gray-300`. Gluestack semantic tokens (e.g. `bg-background-0`, `text-typography-900`) already flip and need no variant.
    *   For inline hex colors (`style`, SVG `fill`/`stroke`, `color` props), use `useIsDark()` from `@/hooks/useIsDark` and branch: `dark ? "#1f2937" : "#f3f4f6"`. Do **not** read NativeWind's `useColorScheme()` for this; it is unreliable on web.
    *   Check new UI in both themes (and on web) before finishing.
*   **Design Philosophy:** Follow a **minimalist design system** for all future modifications. Avoid clutter, excessive colors, or complex UI elements unless necessary. Prioritize clean, whitespace-heavy, and simple interfaces.

### State Management (Zustand)
*   Stores are located in `store/`.
*   Use the `create` function from `zustand` and `persist` middleware for data that needs to survive restarts.
*   Define interfaces for State and Actions separately if complex.
    ```typescript
    interface MyState { count: number }
    interface MyActions { increment: () => void }
    // ...
    ```

### Error Handling
*   Use `try/catch` blocks for async operations, especially those involving API calls or `AsyncStorage`.
*   Log errors using the custom logger service: `import log from "@/services/logger";`
*   Avoid `console.log` in production code; use the logger.

## 4. Project Structure

*   `app/`: Expo Router pages. `_layout.tsx` defines the root layout and providers. `(tabs)/` contains tab-based navigation.
*   `components/`: Reusable UI components.
    *   `ui/`: Gluestack UI primitives.
*   `hooks/`: Custom React hooks (e.g., `useColorScheme`).
*   `services/`: Business logic, API calls, logging, notifications.
*   `store/`: Zustand state stores.
*   `constants/`: App-wide constants (colors, layout settings).
*   `assets/`: Images, fonts, and other static files.

## 5. Development Workflow for Agents

1.  **Analyze:** Before making changes, scan the relevant files to understand existing patterns. Use `grep` or `glob` to find usage examples.
2.  **Plan:** Formulate a plan. For logic changes, decide which unit tests will cover it.
3.  **Implement:** Write code that matches the existing style (NativeWind + Gluestack, Zustand, TypeScript).
4.  **Verify:** Run `pnpm test` and `pnpm lint`. Ensure types check out (`pnpm exec tsc --noEmit`; existing errors in `components/ui/` are known).

## 6. Specific Rules (Cursor/Copilot)

*   **Restricted Directories:** Do **NOT** edit any files in `components/ui/`.
    *   These are standard Gluestack UI components.
    *   If you need to customize a component, wrap it in a new component in `components/` or override styles via props, but do not modify the core files in this directory.
*   *No specific `.cursorrules` or `.github/copilot-instructions.md` found.*
*   Adhere to the general guidelines above.

## 7. Dependencies Note

*   **Expo:** ~57.0.27
*   **React Native:** 0.86.3
*   **React:** 19.2.3
*   **Gluestack UI:** v1
*   **NativeWind:** 4.2.7

Always check `package.json` for the exact versions before assuming API availability.
