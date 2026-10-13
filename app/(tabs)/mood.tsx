import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Emojis } from "@/constants/Moods";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import i18n from "@/i18n";
import { useMoodStore } from "@/store/moodStore";
import { useSettingsStore } from "@/store/settingsStore";
import { calendarDateString, currentCalendar, todayLocalDateString } from "@/utils/dateUtils";
import { useIsDark } from "@/hooks/useIsDark";

const MOOD_COLORS = ["#D1FAE5", "#E0F2FE", "#F3F4F6", "#FEF3C7", "#FEE2E2"];
const ACCENT = "#8882e7";

const cardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0 1px 3px rgba(17, 24, 39, 0.06)" }
    : {
        shadowColor: "#111827",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }
) as ViewStyle;

function moodLabels(): string[] {
  return [
    i18n.t("great"),
    i18n.t("good"),
    i18n.t("okay"),
    i18n.t("not_good"),
    i18n.t("bad"),
  ];
}

function weekLabels(): string[] {
  return [
    i18n.t("mon"),
    i18n.t("tue"),
    i18n.t("wed"),
    i18n.t("thu"),
    i18n.t("fri"),
    i18n.t("sat"),
    i18n.t("sun"),
  ];
}

function appLocale(): string {
  return i18n.locale === "vi" ? "vi-VN" : "en-US";
}

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(appLocale(), {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function MoodPicker({
  date,
  selectedIndex,
  onSelect,
  onClose,
  onSave,
}: {
  date: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const dark = useIsDark();
  const labels = moodLabels();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(17, 24, 39, 0.35)",
          padding: 24,
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          className="w-full bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800"
          style={
            Platform.OS === "web"
              ? ({
                  maxWidth: 360,
                  boxShadow: "0 12px 40px rgba(17, 24, 39, 0.16)",
                } as ViewStyle)
              : {
                  maxWidth: 360,
                  shadowColor: "#111827",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.16,
                  shadowRadius: 24,
                  elevation: 8,
                }
          }
        >
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50 text-center">
            {i18n.t("how_are_you_feeling")}
          </Text>
          <Text className="text-sm text-gray-400 text-center mt-1 mb-4">
            {formatLongDate(date)}
          </Text>
          {labels.map((label, index) => {
            const selected = selectedIndex === index;
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => onSelect(index)}
                className="flex-row items-center rounded-2xl px-3 py-2.5 mb-2"
                style={{ backgroundColor: selected ? (dark ? "#2a2850" : "#f3f1ff") : dark ? "#1f2937" : "#f9fafb" }}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full mr-3"
                  style={{ backgroundColor: selected ? ACCENT : MOOD_COLORS[index] }}
                >
                  <Text style={{ fontSize: 30, lineHeight: 34 }}>{Emojis[index]}</Text>
                </View>
                <Text
                  className="flex-1 text-base font-semibold"
                  style={{ color: selected ? ACCENT : dark ? "#e5e7eb" : "#374151" }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            disabled={selectedIndex === null}
            onPress={onSave}
            className="mt-2 h-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: selectedIndex === null ? (dark ? "#374151" : "#e5e7eb") : ACCENT }}
          >
            <Text className="text-white font-semibold">
              {selectedIndex === null ? i18n.t("select_mood") : i18n.t("save_mood")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


export default function MoodScreen() {
  const tabBarSpace = useTabBarSpace();
  const dark = useIsDark();
  const language = useSettingsStore((state) => state.language);
  const timezone = useSettingsStore((state) => state.timezone);
  const moodLogs = useMoodStore((state) => state.moodLogs);
  const addMoodLog = useMoodStore((state) => state.addMoodLog);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = currentCalendar();
    return new Date(now.year, now.month, 1);
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMoodIndex, setSelectedMoodIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthZone, setMonthZone] = useState(timezone);
  if (monthZone !== timezone) {
    const now = currentCalendar();
    setMonthZone(timezone);
    setCurrentDate(new Date(now.year, now.month, 1));
  }
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = todayLocalDateString();
  const labels = weekLabels();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthLogs = moodLogs.filter((log) => log.date.startsWith(monthPrefix));
  const topMood = (() => {
    if (monthLogs.length === 0) return null;
    const counts = [0, 0, 0, 0, 0];
    for (const log of monthLogs) counts[log.moodIndex] += 1;
    const index = counts.indexOf(Math.max(...counts));
    return { emoji: Emojis[index], label: moodLabels()[index] };
  })();

  const openDay = (day: number) => {
    const dateStr = calendarDateString(year, month, day);
    if (dateStr > today) return;
    const log = moodLogs.find((entry) => entry.date === dateStr);
    setSelectedDate(dateStr);
    setSelectedMoodIndex(log ? log.moodIndex : null);
    setPickerOpen(true);
  };

  const saveMood = () => {
    if (selectedMoodIndex === null || !selectedDate) return;
    addMoodLog({ date: selectedDate, moodIndex: selectedMoodIndex });
    setPickerOpen(false);
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          width: "100%",
          maxWidth: 576,
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: tabBarSpace,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800" style={cardShadow}>
          <View className="flex-row items-center justify-between mb-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("previous_month")}
              onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="h-9 w-9 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
            >
              <Icon as={ChevronLeftIcon} size="sm" className="text-gray-600 dark:text-gray-300" />
            </Pressable>
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {currentDate.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("next_month")}
              onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="h-9 w-9 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
            >
              <Icon as={ChevronRightIcon} size="sm" className="text-gray-600 dark:text-gray-300" />
            </Pressable>
          </View>

          <View className="flex-row mb-2">
            {labels.map((label) => (
              <Text
                key={label}
                numberOfLines={1}
                className="text-xs font-semibold text-gray-400 text-center"
                style={{ width: "14.28%" }}
              >
                {label}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {Array.from({ length: startOffset }, (_, index) => (
              <View key={`empty-${index}`} style={{ width: "14.28%", height: 44 }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dateStr = calendarDateString(year, month, day);
              const log = moodLogs.find((entry) => entry.date === dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              return (
                <Pressable
                  key={dateStr}
                  accessibilityRole="button"
                  disabled={isFuture}
                  onPress={() => openDay(day)}
                  className="items-center justify-center"
                  style={{ width: "14.28%", height: 44, opacity: isFuture ? 0.4 : 1 }}
                >
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: log ? MOOD_COLORS[log.moodIndex] : "transparent",
                      borderWidth: log && !isToday ? 0 : 1,
                      borderColor: isToday ? ACCENT : dark ? "#374151" : "#e5e7eb",
                    }}
                  >
                    {log ? (
                      <Text style={{ fontSize: 24, lineHeight: 28 }}>{Emojis[log.moodIndex]}</Text>
                    ) : (
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isToday ? ACCENT : "#6b7280" }}
                      >
                        {day}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-4 px-1">
          <Text className="text-sm text-gray-500">
            {i18n.t("moods_logged", { count: monthLogs.length })}
          </Text>
          {topMood ? (
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              <Text style={{ fontSize: 20, lineHeight: 24 }}>{topMood.emoji}</Text>
              {` ${topMood.label}`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {pickerOpen ? (
        <MoodPicker
          date={selectedDate}
          selectedIndex={selectedMoodIndex}
          onSelect={setSelectedMoodIndex}
          onClose={() => setPickerOpen(false)}
          onSave={saveMood}
        />
      ) : null}
    </View>
  );
}
