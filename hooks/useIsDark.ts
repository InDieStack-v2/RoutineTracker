import { useColorScheme } from "react-native";
import { useSettingsStore } from "@/store/settingsStore";

export function useIsDark() {
  const theme = useSettingsStore((state) => state.theme);
  const system = useColorScheme();
  return theme === "dark" || (theme === "system" && system === "dark");
}
