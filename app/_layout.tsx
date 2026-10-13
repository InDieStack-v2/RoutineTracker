import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { CandyContext } from "@/store/context";
import { useEffect, useState } from "react";
import { candyStore } from "@/store/candyStore";
import { useMoodStore } from "@/store/moodStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStreakStore } from "@/store/streakStore";
import { scheduleNotificationsForRoutineTasks, setupNotificationHandler } from "@/services/notification";
import { Appearance, AppState, Platform } from "react-native";
import { useIsDark } from "@/hooks/useIsDark";
import log from "@/services/logger";
import { getDB } from "@/services/db";
import { migrateFromAsyncStorage } from "@/services/migration";

type CandyProviderProps = React.PropsWithChildren<{}>;

function CandyProvider({ children }: CandyProviderProps) {
  return (
    <CandyContext.Provider value={candyStore}>
      {children}
    </CandyContext.Provider>
  );
}


function NavigationTheme({ children }: React.PropsWithChildren) {
  return (
    <ThemeProvider value={useIsDark() ? DarkTheme : DefaultTheme}>{children}</ThemeProvider>
  );
}

export default function RootLayout() {
  const theme = useSettingsStore((state) => state.theme);
  const isDark = useIsDark();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: Open DB and run migrations
        log.info("Initializing database...");
        await getDB();

        // Step 2: Migrate old AsyncStorage data if needed
        log.info("Running data migration...");
        await migrateFromAsyncStorage();

        // Step 3: Initialize stores
        log.info("Initializing stores...");
        await candyStore.getState().initialize();
        await useMoodStore.getState().initialize();
        await useSettingsStore.getState().loadSettings();
        await useStreakStore.getState().loadStreak();
        await useStreakStore.getState().evaluateNewDay();

        setIsReady(true);
      } catch (error) {
        log.error("App initialization failed:", error);
        // Don't crash - allow app to continue even if migration fails
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // Keep native chrome (blur tab bar, pickers, status bar) in step with the chosen theme.
  useEffect(() => {
    // react-native-web's Appearance has no setColorScheme; nativewind handles web.
    if (Platform.OS === "web") return;
    Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
  }, [theme]);

  useEffect(() => {
    if (!isReady) return;

    if (Platform.OS !== "web") {
      log.info("Setting up notification handler");
      setupNotificationHandler();
      // const unsubscribe = candyStore.subscribe(() => {
      //   scheduleNotificationsForRoutineTasks();
      // });
      
      scheduleNotificationsForRoutineTasks();

      return () => {
        // unsubscribe();
      };
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        useStreakStore.getState().evaluateNewDay();
      }
    });
    return () => subscription.remove();
  }, [isReady]);

  if (!loaded || !isReady) {
    // Async font loading only occurs in development.
    // Block rendering until DB is ready and migration is complete.
    return null;
  }

  return (
    <GluestackUIProvider mode={isDark ? "dark" : "light"}>
      <NavigationTheme>
        <CandyProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </CandyProvider>
      </NavigationTheme>
    </GluestackUIProvider>
  );
}
