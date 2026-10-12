import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Icon } from '@/components/ui/icon';
import { FlameIcon, SnowflakeIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { useStreakStore } from '@/store/streakStore';
import { formatInstant } from '@/utils/dateUtils';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
};

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const language = useSettingsStore((state) => state.language);
  const timezone = useSettingsStore((state) => state.timezone);
  const streakCount = useStreakStore((state) => state.streakCount);
  const freezeCount = useStreakStore((state) => state.freezeCount);
  const locale = LOCALE_MAP[language] ?? 'en-US';
  const date = formatInstant(
    new Date(),
    locale,
    { weekday: 'long', day: 'numeric', month: 'short' },
    timezone,
  );

  return (
    <Box className="bg-white">
      <SafeAreaView edges={['top']} className="bg-white">
        <Box className="px-6 pb-4 pt-2 flex-row items-center justify-between">
          <VStack>
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              {date}
            </Text>
            <Text size="3xl" className="font-black text-gray-900 tracking-tight leading-none">
              {title}
            </Text>
          </VStack>
          
          <View className="flex-row items-center gap-2">
            {/* Streak counter — always visible */}
            <View className="flex-row items-center gap-1 bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-100">
              <Icon as={FlameIcon} className="text-orange-400 w-4 h-4" />
              <Text className="text-sm font-bold text-orange-500">{streakCount}</Text>
            </View>

            {/* Freeze badge — only shown when freezeCount > 0 */}
            {freezeCount > 0 && (
              <View className="flex-row items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100">
                <Icon as={SnowflakeIcon} className="text-blue-400 w-4 h-4" />
                <Text className="text-sm font-bold text-blue-500">{freezeCount}</Text>
              </View>
            )}
          </View>
        </Box>
      </SafeAreaView>
    </Box>
  );
};
