import { useSafeAreaInsets } from "react-native-safe-area-context";

export const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MIN_BOTTOM = 12;
const CONTENT_GAP = 16;

/** Distance from the screen bottom to the floating tab bar's bottom edge. */
export function useTabBarBottom() {
  return Math.max(useSafeAreaInsets().bottom, TAB_BAR_MIN_BOTTOM);
}

/** Bottom padding screens need so their content scrolls clear of the floating tab bar. */
export function useTabBarSpace() {
  return useTabBarBottom() + TAB_BAR_HEIGHT + CONTENT_GAP;
}
