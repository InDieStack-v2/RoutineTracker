import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/HapticTab';
import { Icon } from '@/components/ui/icon';
import { HouseIcon, ListChecksIcon, SmilePlusIcon, SettingsIcon } from 'lucide-react-native';
import { Header } from '@/components/Header';
import i18n from '@/i18n';
import { useIsDark } from '@/hooks/useIsDark';
import { TAB_BAR_HEIGHT, useTabBarBottom } from '@/hooks/useTabBarSpace';

const TAB_BAR_WIDTH = 280;

export default function TabLayout() {
  const dark = useIsDark();
  const bottom = useTabBarBottom();
  const colorStyle = (focused: boolean) => {
    return focused ? "text-[#8882e7]" : "text-[#8E8E8F]";
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#8882e7",
        headerShown: true,
        header: ({ options }) => <Header title={options.title ?? ''} />,
        tabBarButton: HapticTab,
        // Floats over the content; screens pad their bottom via useTabBarSpace().
        tabBarStyle: {
          position: 'absolute',
          width: TAB_BAR_WIDTH,
          left: '50%',
          marginLeft: -TAB_BAR_WIDTH / 2,
          bottom,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          borderRadius: TAB_BAR_HEIGHT / 2,
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: dark ? "#1f2937" : "#e5e7eb",
          backgroundColor: dark ? "rgba(31, 41, 55, 0.75)" : "rgba(255, 255, 255, 0.75)",
          elevation: 0,
        },
        tabBarShowLabel: false,
        // Horizontal layout centers the icon in the bar (the default column pins it to the top).
        tabBarLabelPosition: 'beside-icon',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.t('home'),
          tabBarIcon: ({ focused }) => <Icon as={HouseIcon} className={colorStyle(focused)} />,
        }}
      />
      <Tabs.Screen
        name="task"
        options={{
          title: i18n.t('routine_tasks'),
          tabBarIcon: ({ focused }) => <Icon as={ListChecksIcon} className={colorStyle(focused)} />,
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          title: i18n.t('moods'),
          tabBarIcon: ({ focused }) => <Icon as={SmilePlusIcon} className={colorStyle(focused)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: i18n.t('settings'),
          tabBarIcon: ({ focused }) => <Icon as={SettingsIcon} className={colorStyle(focused)} />,
        }}
      />
    </Tabs>
  );
}
