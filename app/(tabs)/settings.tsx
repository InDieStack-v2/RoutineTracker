import React, { useMemo, useState } from "react";
import { FlatList, Modal, Platform, StyleSheet, TextInput } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { DateTimeField } from "@/components/DateTimeField";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { CheckIcon, ChevronRightIcon } from "lucide-react-native";
import { useSettingsStore } from "@/store/settingsStore";
import i18n from "@/i18n";
import { deviceTimeZone, isSystemTimeZone, listTimeZones, timeZoneOffsetLabel } from "@/utils/timezone";
import { Stack } from "expo-router";
import { useIsDark } from "@/hooks/useIsDark";
import { Icon } from "@/components/ui/icon";
import { scheduleNotificationsForRoutineTasks } from "@/services/notification";

// Flip on when manual timezone selection should ship.
const TIMEZONE_SELECTION_ENABLED = false;

function Option<T extends string>({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: T;
  selected: T;
  onSelect: (value: T) => void;
}) {
  const isSelected = selected === value;
  return (
    <Pressable onPress={() => onSelect(value)}>
      <HStack className="justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
        <Text
          className={`text-base ${isSelected ? "text-gray-900 dark:text-gray-50 font-medium" : "text-gray-600 dark:text-gray-300"}`}
        >
          {label}
        </Text>
        {isSelected && (
          <Icon as={CheckIcon} className="text-primary-500 w-5 h-5" />
        )}
      </HStack>
    </Pressable>
  );
}

function TimezonePicker({
  timezone,
  enabled,
  onSelect,
}: {
  timezone: string;
  enabled: boolean;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const zones = useMemo(() => listTimeZones(), []);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return zones;
    return zones.filter((zone) => {
      const label = zone.toLowerCase().replace(/_/g, " ");
      return label.includes(needle) || zone.toLowerCase().includes(needle.replace(/ /g, "_"));
    });
  }, [needle, zones]);
  const deviceZone = deviceTimeZone();
  const showSystem =
    !needle ||
    i18n.t("system").toLowerCase().includes(needle) ||
    deviceZone.toLowerCase().replace(/_/g, " ").includes(needle);
  const selectedLabel = isSystemTimeZone(timezone)
    ? i18n.t("system")
    : timezone.replace(/_/g, " ");
  const selectedDetail = isSystemTimeZone(timezone)
    ? deviceZone.replace(/_/g, " ")
    : timeZoneOffsetLabel(timezone);

  const choose = (value: string) => {
    if (!enabled) return;
    setOpen(false);
    setQuery("");
    onSelect(value);
  };

  return (
    <>
      <Pressable
        disabled={!enabled}
        accessibilityState={{ disabled: !enabled }}
        onPress={() => setOpen(true)}
      >
        <HStack className="justify-between items-center py-3">
          <VStack>
            <Text className="text-base text-gray-900 dark:text-gray-50">{selectedLabel}</Text>
            <Text className="text-sm text-gray-500">{selectedDetail}</Text>
          </VStack>
          <Icon as={ChevronRightIcon} className="text-gray-400 w-5 h-5" />
        </HStack>
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 justify-center px-6"
          style={{ backgroundColor: "rgba(17, 24, 39, 0.35)" }}
        >
          <Pressable
            onPress={() => {}}
            className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            style={styles.modal}
          >
            <VStack className="px-5 pt-5 pb-3" space="sm">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{i18n.t("timezone")}</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={i18n.t("search_timezone")}
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.search}
              />
            </VStack>
            {showSystem ? (
              <Pressable onPress={() => choose("system")} className="px-5">
                <HStack className="justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                  <VStack>
                    <Text className="text-base text-gray-900 dark:text-gray-50">{i18n.t("system")}</Text>
                    <Text className="text-sm text-gray-500">{deviceZone.replace(/_/g, " ")}</Text>
                  </VStack>
                  {isSystemTimeZone(timezone) ? (
                    <Icon as={CheckIcon} className="text-primary-500 w-5 h-5" />
                  ) : null}
                </HStack>
              </Pressable>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(zone) => zone}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <Text className="text-sm text-gray-500 px-5 py-4">{i18n.t("no_timezone_matches")}</Text>
              }
              renderItem={({ item }) => {
                const selected = item === timezone;
                return (
                  <Pressable onPress={() => choose(item)} className="px-5">
                    <HStack className="justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                      <VStack className="flex-1 pr-3">
                        <Text className={`text-base ${selected ? "text-gray-900 dark:text-gray-50 font-medium" : "text-gray-700 dark:text-gray-200"}`}>
                          {item.replace(/_/g, " ")}
                        </Text>
                        <Text className="text-sm text-gray-500">{timeZoneOffsetLabel(item)}</Text>
                      </VStack>
                      {selected ? <Icon as={CheckIcon} className="text-primary-500 w-5 h-5" /> : null}
                    </HStack>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}


export default function SettingScreen() {
  const { language, setLanguage, theme, setTheme, timezone, setTimezone, reminderTime, setReminderTime } =
    useSettingsStore();
  const [showTimePicker, setShowTimePicker] = useState(false);

  const isDark = useIsDark();
  const timeDate = new Date(reminderTime);

  // Ensure valid date
  if (isNaN(timeDate.getTime())) {
    const fallbackDate = new Date();
    fallbackDate.setHours(8, 0, 0, 0);
    setReminderTime(fallbackDate);
  }

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setShowTimePicker(false);
      return;
    }

    const currentDate = selectedDate || timeDate;
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    setReminderTime(currentDate);

    setTimeout(async () => {
      await scheduleNotificationsForRoutineTasks();
    }, 100);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };


  return (
    <Box className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Stack.Screen
        options={{
          title: i18n.t("settings"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: isDark ? "#030712" : "#F9FAFB" }, // Matches bg-gray-50 / gray-950
          headerTintColor: isDark ? "#F9FAFB" : "#111827",
        }}
      />

      <VStack className="flex-1 p-6" space="xl">
        {/* Language Section */}
        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("language")}
          </Text>
          <Box
            className="bg-white dark:bg-gray-900 rounded-xl px-4 py-1 border border-gray-100 dark:border-gray-800"
            style={styles.shadow}
          >
            <Option
              label={i18n.t("english")}
              value="en"
              selected={language}
              onSelect={setLanguage}
            />
            <Box className="h-[1px] bg-gray-100 dark:bg-gray-800" />
            <Option
              label={i18n.t("vietnamese")}
              value="vi"
              selected={language}
              onSelect={setLanguage}
            />
          </Box>
        </VStack>

        {/* Theme Section */}
        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("theme")}
          </Text>
          <Box
            className="bg-white dark:bg-gray-900 rounded-xl px-4 py-1 border border-gray-100 dark:border-gray-800"
            style={styles.shadow}
          >
            <Option label={i18n.t("system")} value="system" selected={theme} onSelect={setTheme} />
            <Box className="h-[1px] bg-gray-100 dark:bg-gray-800" />
            <Option label={i18n.t("light")} value="light" selected={theme} onSelect={setTheme} />
            <Box className="h-[1px] bg-gray-100 dark:bg-gray-800" />
            <Option label={i18n.t("dark")} value="dark" selected={theme} onSelect={setTheme} />
          </Box>
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("timezone")}
          </Text>
          <Box
            className="bg-white dark:bg-gray-900 rounded-xl px-4 py-1 border border-gray-100 dark:border-gray-800"
            style={styles.shadow}
          >
            <TimezonePicker
              timezone={timezone}
              enabled={TIMEZONE_SELECTION_ENABLED}
              onSelect={(value) => {
                void setTimezone(value).then(() => {
                  setTimeout(() => {
                    void scheduleNotificationsForRoutineTasks();
                  }, 100);
                });
              }}
            />
          </Box>
        </VStack>


        {/* Notifications Section */}
        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("reminder_time")}
          </Text>
          <Box
            className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-800 flex-row justify-between items-center"
            style={styles.shadow}
          >
            <Text className="text-base text-gray-900 dark:text-gray-50">
              {i18n.t("daily_reminder")}
            </Text>

            {Platform.OS === "web" ? (
              <DateTimeField
                mode="time"
                value={timeDate}
                onChange={(date) => {
                  setReminderTime(date);
                  setTimeout(() => {
                    void scheduleNotificationsForRoutineTasks();
                  }, 100);
                }}
              />
            ) : Platform.OS === "android" ? (
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md"
              >
                <Text className="font-medium text-gray-900 dark:text-gray-50">
                  {formatTime(timeDate)}
                </Text>
              </Pressable>
            ) : (
              <DateTimePicker
                testID="dateTimePicker"
                value={timeDate}
                mode="time"
                display="compact"
                onChange={onTimeChange}
              />
            )}
          </Box>
          {Platform.OS === "android" && showTimePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={timeDate}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={onTimeChange}
            />
          )}
        </VStack>
      </VStack>
    </Box>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modal: {
    maxHeight: "80%",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  search: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
});
