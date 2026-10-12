import React, { useState } from "react";
import { Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { CheckIcon } from "lucide-react-native";
import { useSettingsStore } from "@/store/settingsStore";
import i18n from "@/i18n";
import { Stack } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { scheduleNotificationsForRoutineTasks } from "@/services/notification";

function LanguageOption({
  label,
  value,
  language,
  onSelect,
}: {
  label: string;
  value: "en" | "vi";
  language: "en" | "vi";
  onSelect: (value: "en" | "vi") => void;
}) {
  const isSelected = language === value;
  return (
    <Pressable onPress={() => onSelect(value)}>
      <HStack className="justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
        <Text
          className={`text-base ${isSelected ? "text-gray-900 font-medium" : "text-gray-600"}`}
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

export default function SettingScreen() {
  const { language, setLanguage, reminderTime, setReminderTime } =
    useSettingsStore();
  const [showTimePicker, setShowTimePicker] = useState(false);

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
    <Box className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: i18n.t("settings"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#F9FAFB" }, // Matches bg-gray-50
        }}
      />

      <VStack className="flex-1 p-6" space="xl">
        {/* Language Section */}
        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("language")}
          </Text>
          <Box
            className="bg-white rounded-xl px-4 py-1 border border-gray-100"
            style={styles.shadow}
          >
            <LanguageOption
              label={i18n.t("english")}
              value="en"
              language={language}
              onSelect={setLanguage}
            />
            <Box className="h-[1px] bg-gray-100" />
            <LanguageOption
              label={i18n.t("vietnamese")}
              value="vi"
              language={language}
              onSelect={setLanguage}
            />
          </Box>
        </VStack>

        {/* Notifications Section */}
        <VStack space="xs">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-2">
            {i18n.t("reminder_time")}
          </Text>
          <Box
            className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex-row justify-between items-center"
            style={styles.shadow}
          >
            <Text className="text-base text-gray-900">
              {i18n.t("daily_reminder")}
            </Text>

            {Platform.OS === "android" ? (
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="bg-gray-100 px-3 py-1.5 rounded-md"
              >
                <Text className="font-medium text-gray-900">
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
});
