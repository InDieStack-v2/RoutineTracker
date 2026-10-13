import { RoutineTaskService } from "@/services/routineTaskService";
import { useCandyContext } from "@/store/context";
import { useStreakStore } from "@/store/streakStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EyeOffIcon,
  PlusIcon,
  XIcon,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  SectionList,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";

import { Icon } from "@/components/ui/icon";
import { Fab } from "@/components/ui/fab";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import i18n from "@/i18n";
import { calendarDateString, noonOnCalendarDate, shiftCalendarDate, toLocalDateString, todayLocalDateString } from "@/utils/dateUtils";
import { useIsDark } from "@/hooks/useIsDark";

type Task = {
  id: string;
  label: string;
  isFavorite: boolean;
  isDone?: boolean;
  isHidden?: boolean;
  color?: string;
  icon?: string;
};

// ── Sub-step B: Module-level ItemView ──────────────────────────────────────

interface ItemViewProps {
  task: Task;
  onItemPress?: (taskId: string) => void;
}

const ItemView = React.memo(({ task, onItemPress }: ItemViewProps) => {
  const hidden = task.isHidden === true;
  return (
    <View
      className={`rounded-2xl p-4 border flex-row items-center ${
        hidden ? "bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-600" : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
      }`}
      style={
        hidden
          ? { borderStyle: "dashed" }
          : Platform.OS === "web"
            ? ({ boxShadow: "0 1px 3px rgba(17, 24, 39, 0.06)" } as ViewStyle)
            : {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }
      }
    >
      <TouchableOpacity
        className="flex-1 flex-row items-center"
        onPress={() => {
          onItemPress?.(task.id);
        }}
        activeOpacity={0.7}
      >
        <View
          className="h-12 w-12 rounded-full items-center justify-center mr-4 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
          style={
            task.color
              ? { backgroundColor: task.color + "20" }
              : {}
          }
        >
          <Text style={{ fontSize: 24, opacity: hidden ? 0.55 : 1 }}>
            {task.icon || "📝"}
          </Text>
        </View>

        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              hidden
                ? "text-gray-500"
                : task.isDone
                  ? "text-gray-400 line-through"
                  : "text-gray-800 dark:text-gray-100"
            }`}
            numberOfLines={1}
          >
            {task.label}
          </Text>
          {hidden ? (
            <Text className="text-xs text-gray-400 mt-0.5">{i18n.t("hidden")}</Text>
          ) : task.isDone ? (
            <Text className="text-xs text-gray-400 mt-0.5">
              {i18n.t("completed")}
            </Text>
          ) : null}
        </View>

        {hidden ? (
          <View className="bg-gray-200 dark:bg-gray-700 p-1.5 rounded-full">
            <Icon as={EyeOffIcon} className="text-gray-500" size="sm" />
          </View>
        ) : task.isDone ? (
          <View className="bg-green-100 p-1.5 rounded-full">
            <Icon as={CheckIcon} className="text-green-600" size="sm" />
          </View>
        ) : (
          <View className="w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-700" />
        )}
      </TouchableOpacity>
    </View>
  );
});
ItemView.displayName = "ItemView";

// ── RoutineTask ────────────────────────────────────────────────────────────

type RoutineTaskProps = {
  task: Task;
  onToggle: (taskId: string) => void;
  onToggleFavorite: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSwipeableWillOpen: () => void;
  onClose: () => void;
  onItemPress?: (taskId: string) => void;
};

const ACTION_WIDTH = 84;
const FAB_SIZE = 56;
const FAB_GAP = 16;

function closeSwipeable(ref: React.ForwardedRef<Swipeable>) {
  if (ref && typeof ref !== "function") {
    ref.current?.close();
  }
}

function SwipeAction({
  label,
  icon,
  color,
  side,
}: {
  label: string;
  icon: typeof CheckIcon;
  color: string;
  side: "left" | "right";
}) {
  return (
    <View
      style={{
        width: ACTION_WIDTH,
        height: "100%",
        paddingRight: side === "left" ? 8 : 0,
        paddingLeft: side === "right" ? 8 : 0,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 16,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon as={icon} className="text-white" size="md" />
        <Text className="text-white text-xs font-semibold mt-1" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const RoutineTask = React.memo(
  React.forwardRef<Swipeable, RoutineTaskProps>(
    (
      {
        task,
        onToggle,
        onDelete,
        onSwipeableWillOpen,
        onClose,
        onItemPress,
      },
      ref,
    ) => {
      return (
        <View className="mx-4 mb-3">
          {task.isHidden ? (
            <ItemView task={task} onItemPress={onItemPress} />
          ) : (
            <Swipeable
              ref={ref}
              overshootLeft={false}
              overshootRight={false}
              friction={2}
              useNativeAnimations={Platform.OS !== "web"}
              renderLeftActions={() => (
                <SwipeAction
                  side="left"
                  color={task.isDone ? "#ef4444" : "#8882e7"}
                  icon={task.isDone ? XIcon : CheckIcon}
                  label={i18n.t(task.isDone ? "mark_undo" : "mark_done")}
                />
              )}
              renderRightActions={
                task.isDone
                  ? undefined
                  : () => (
                      <SwipeAction
                        side="right"
                        color="#6b7280"
                        icon={ArrowRightIcon}
                        label={i18n.t("skip")}
                      />
                    )
              }
              onSwipeableWillOpen={onSwipeableWillOpen}
              onSwipeableOpen={(direction) => {
                closeSwipeable(ref);
                if (direction === "left") {
                  onToggle(task.id);
                } else {
                  onDelete?.(task.id);
                }
              }}
              onSwipeableClose={() => {
                onClose();
              }}
            >
              <ItemView task={task} onItemPress={onItemPress} />
            </Swipeable>
          )}
        </View>
      );
    },
  ),
);
RoutineTask.displayName = "RoutineTask";
// ── FilterTask ─────────────────────────────────────────────────────────────

type FilterType = 'today' | 'yesterday' | 'custom';

function DatePopup({
  value,
  onClose,
  onSelect,
}: {
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const dark = useIsDark();
  const selectedKey = toLocalDateString(value);
  const [selectedYear, selectedMonth] = selectedKey.split("-").map(Number);
  const [cursor, setCursor] = useState(
    () => new Date(selectedYear, selectedMonth - 1, 1),
  );
  const locale = i18n.locale === "vi" ? "vi-VN" : "en-US";
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayKey = todayLocalDateString();
  const labels = [
    i18n.t("mon"),
    i18n.t("tue"),
    i18n.t("wed"),
    i18n.t("thu"),
    i18n.t("fri"),
    i18n.t("sat"),
    i18n.t("sun"),
  ];

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
                  maxWidth: 340,
                  boxShadow: "0 12px 40px rgba(17, 24, 39, 0.16)",
                } as ViewStyle)
              : {
                  maxWidth: 340,
                  shadowColor: "#111827",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.16,
                  shadowRadius: 24,
                  elevation: 8,
                }
          }
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("previous_month")}
              onPress={() => setCursor(new Date(year, month - 1, 1))}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
            >
              <Icon as={ChevronLeftIcon} size="sm" className="text-gray-600 dark:text-gray-300" />
            </Pressable>
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {cursor.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("next_month")}
              onPress={() => setCursor(new Date(year, month + 1, 1))}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
            >
              <Icon as={ChevronRightIcon} size="sm" className="text-gray-600 dark:text-gray-300" />
            </Pressable>
          </View>
          <View className="flex-row mb-2">
            {labels.map((label) => (
              <Text
                key={label}
                className="text-xs font-semibold text-gray-400 text-center"
                style={{ width: "14.28%" }}
              >
                {label}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {Array.from({ length: startOffset }, (_, index) => (
              <View key={`empty-${index}`} style={{ width: "14.28%", height: 40 }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = calendarDateString(year, month, day);
              const selected = key === selectedKey;
              const today = key === todayKey;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => onSelect(noonOnCalendarDate(key))}
                  className="items-center justify-center"
                  style={{ width: "14.28%", height: 40 }}
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: selected ? "#8882e7" : "transparent",
                      borderWidth: today && !selected ? 1 : 0,
                      borderColor: "#8882e7",
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? "#ffffff" : today ? "#8882e7" : dark ? "#e5e7eb" : "#374151" }}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface FilterTaskProps {
  selectedDate: Date | null;
  onSelectedDateChange: (date: Date | null) => void;
}
const FilterTask: React.FC<FilterTaskProps> = React.memo(
  ({ selectedDate, onSelectedDateChange }) => {
    const [selectedType, setSelectedType] = useState<FilterType>('today');
    const [customDateLabel, setCustomDateLabel] = useState<string | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const activePillLabel =
      selectedType === 'today' ? i18n.t('today') :
      selectedType === 'yesterday' ? i18n.t('yesterday') :
      customDateLabel ?? i18n.t('other');

    const dateNames = [
      i18n.t('today'),
      i18n.t('yesterday'),
      selectedType === 'custom' && customDateLabel ? customDateLabel : i18n.t('other'),
    ];

    const applyCustomDate = useCallback(
      (date: Date) => {
        onSelectedDateChange(date);
        setSelectedType('custom');
        setCustomDateLabel(toLocalDateString(date));
        setShowDatePicker(false);
      },
      [onSelectedDateChange],
    );

    const onSelectItem = useCallback(
      (index: number) => {
        if (index === 0) {
          setSelectedType('today');
          onSelectedDateChange(new Date());
        } else if (index === 1) {
          const yesterday = noonOnCalendarDate(shiftCalendarDate(todayLocalDateString(), -1));
          setSelectedType('yesterday');
          onSelectedDateChange(yesterday);
        } else {
          setShowDatePicker(true);
        }
      },
      [onSelectedDateChange],
    );

    return (
      <View className="mb-6 px-4 pt-2">
        {showDatePicker ? (
          <DatePopup
            value={selectedDate || new Date()}
            onClose={() => setShowDatePicker(false)}
            onSelect={applyCustomDate}
          />
        ) : null}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dateNames}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => onSelectItem(index)}
              className={`mr-3 px-5 py-2.5 rounded-full border ${
                item === activePillLabel
                  ? "bg-[#8882e7] border-[#8882e7]"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              }`}
              style={
                item !== activePillLabel
                  ? {
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                    }
                  : {}
              }
              activeOpacity={0.8}
            >
              <Text
                className={`font-semibold text-sm ${
                  item === activePillLabel ? "text-white" : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
        />
      </View>
    );
  },
);
FilterTask.displayName = "FilterTask";

// ── TaskScreen ─────────────────────────────────────────────────────────────

export default function TaskScreen() {
  const dark = useIsDark();
  const [tasks, setTasks] = useState<Task[]>([]);
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const sectionListRef = useRef<SectionList<Task>>(null);
  const [filteredOnDate, setFilteredOnDate] = useState<Date | null>(new Date());
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();
  const tabOverflow = useBottomTabOverflow();
  const fabBottom = tabOverflow + FAB_GAP;

  const routineTasks = useCandyContext((state) => state.routineTasks);
  const timezone = useSettingsStore((state) => state.timezone);
  const updateRoutineTask = useCandyContext((state) => state.updateRoutineTask);

  // Sub-step A: Cleanup stale refs when tasks change
  useEffect(() => {
    const taskIds = new Set(tasks.map((t) => t.id));
    for (const key of swipeableRefs.current.keys()) {
      if (!taskIds.has(key)) swipeableRefs.current.delete(key);
    }
  }, [tasks]);

  // Sub-step A: Mount cleanup
  useEffect(() => () => { swipeableRefs.current.clear(); }, []);

  // Sub-step G: Scroll to top on focus
  useFocusEffect(
    useCallback(() => {
      sectionListRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    }, [])
  );

  useScrollToTop(sectionListRef as any);

  useEffect(() => {
    RoutineTaskService.getFilteredRoutineTasks(routineTasks, filteredOnDate, {
      includeHidden: true,
    }).then((filteredTasks) => {
      setTasks(
        filteredTasks.map((task) => {
          return {
            id: task.id,
            label: task.label,
            isFavorite: task.isFavorite,
            isDone: task.isDone || false,
            isHidden: task.isHidden,
            color: task.color,
            icon: task.icon,
          };
        }),
      );
    });
  }, [routineTasks, filteredOnDate, timezone]);

  const handleToggleTask = React.useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      if (task.isDone) {
        await RoutineTaskService.deleteFinishedRoutineTask(
          filteredOnDate || new Date(),
          taskId,
          tasks.length,
        );
      } else {
        await RoutineTaskService.markFinishedRoutineTask(
          filteredOnDate || new Date(),
          taskId,
          tasks.length,
        );
      }

      const selectedStr = toLocalDateString(filteredOnDate || new Date());
      const scheduled = tasks.filter((item) => !item.isHidden);
      const remainingDoneCount = task.isDone
        ? scheduled.filter((item) => item.isDone && item.id !== taskId).length
        : scheduled.filter((item) => item.isDone).length + 1;

      if (remainingDoneCount > 0) {
        await useStreakStore.getState().recordTaskDone(selectedStr);
      } else {
        await useStreakStore.getState().revokeToday(selectedStr);
      }

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, isDone: !t.isDone } : t,
        ),
      );
    },
    [tasks, filteredOnDate],
  );

  const handleToggleFavorite = useCallback(
    (taskId: string) => {
      updateRoutineTask(taskId, {
        isFavorite: !tasks.find((task) => task.id === taskId)?.isFavorite,
      });
    },
    [tasks, updateRoutineTask],
  );

  const handleItemPressed = useCallback(
    (taskId: string) => {
      router.push(`/tasks/form?id=${taskId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const callbackRef = (el: Swipeable | null) => {
        swipeableRefs.current.set(item.id, el);
      };

      const handleSwipeableWillOpen = () => {
        if (openSwipeableRef.current && openSwipeableRef.current !== swipeableRefs.current.get(item.id)) {
          openSwipeableRef.current.close();
        }
        openSwipeableRef.current = swipeableRefs.current.get(item.id) ?? null;
      };

      const handleClose = () => {
        if (openSwipeableRef.current === swipeableRefs.current.get(item.id)) {
          openSwipeableRef.current = null;
        }
      };

      return (
        <RoutineTask
          ref={callbackRef}
          task={item}
          onToggle={handleToggleTask}
          onToggleFavorite={handleToggleFavorite}
          onDelete={(taskId) => {
            // handle hide routine task
          }}
          onSwipeableWillOpen={handleSwipeableWillOpen}
          onClose={handleClose}
          onItemPress={handleItemPressed}
        />
      );
    },
    [handleToggleFavorite, handleToggleTask, handleItemPressed],
  );

  const todoTasks = tasks.filter((task) => !task.isHidden && !task.isDone);
  const doneTasks = tasks.filter((task) => !task.isHidden && task.isDone);
  const hiddenCount = tasks.filter((task) => task.isHidden).length;
  const hiddenTasks = showAll ? tasks.filter((task) => task.isHidden) : [];
  const sections = [
    { title: i18n.t("todo"), kind: "todo" as const, data: todoTasks },
    { title: i18n.t("completed"), kind: "done" as const, data: doneTasks },
    ...(hiddenCount > 0
      ? [{ title: i18n.t("hidden"), kind: "hidden" as const, data: hiddenTasks }]
      : []),
  ].filter((section) => section.kind === "hidden" || section.data.length > 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-gray-50/50 dark:bg-gray-950 pt-4">
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => {
            if (section.kind === "hidden") {
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAll }}
                  onPress={() => setShowAll((open) => !open)}
                  className="mx-4 mt-2 mb-3 flex-row items-center rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3"
                  style={{
                    borderColor: showAll ? "#8882e7" : dark ? "#1f2937" : "#f3f4f6",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <Icon as={EyeOffIcon} size="sm" className="text-gray-500" />
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {i18n.t("show_all")}
                  </Text>
                  <Text className="mr-2 text-sm font-semibold text-gray-400">
                    {hiddenCount}
                  </Text>
                  <Icon
                    as={showAll ? ChevronUpIcon : ChevronDownIcon}
                    size="sm"
                    className="text-gray-400"
                  />
                </Pressable>
              );
            }
            if (section.kind === "todo" || section.data.length === 0) {
              return null;
            }
            return (
              <View className="flex-row items-center px-6 py-4 mt-2 mb-2">
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {i18n.t("completed")} ({section.data.length})
                </Text>
                <View className="h-[1px] flex-1 bg-gray-200 dark:bg-gray-700 ml-4" />
              </View>
            );
          }}
          ListHeaderComponent={
            <FilterTask
              selectedDate={filteredOnDate}
              onSelectedDateChange={setFilteredOnDate}
            />
          }
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <Text style={{ fontSize: 48 }}>📋</Text>
              <Text className="text-gray-400 text-base font-semibold mt-4 text-center">
                {i18n.t("no_tasks_for_day")}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: fabBottom + FAB_SIZE + FAB_GAP }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            openSwipeableRef.current?.close();
          }}
          stickySectionHeadersEnabled={false}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />

        <Fab
          size="lg"
          className="bg-[#8882E7]"
          placement="bottom right"
          style={{ bottom: fabBottom, right: FAB_GAP }}
          onPress={() => {
            router.push("/tasks/form");
          }}
        >
          <Icon as={PlusIcon} className="text-white" size="xl" />
        </Fab>
      </View>
    </GestureHandlerRootView>
  );
}
