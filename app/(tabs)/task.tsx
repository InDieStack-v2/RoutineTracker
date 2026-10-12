import { RoutineTaskService } from "@/services/routineTaskService";
import { useCandyContext } from "@/store/context";
import { useStreakStore } from "@/store/streakStore";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
import i18n from "@/i18n";
import { toLocalDateString } from "@/utils/dateUtils";

type Task = {
  id: string;
  label: string;
  isFavorite: boolean;
  isDone?: boolean;
  color?: string;
  icon?: string;
};

// ── Sub-step B: Module-level ItemView ──────────────────────────────────────

interface ItemViewProps {
  task: Task;
  onItemPress?: (taskId: string) => void;
}

const ItemView = React.memo(({ task, onItemPress }: ItemViewProps) => {
  return (
    <View
      className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
      style={
        Platform.OS === "web"
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
          className="h-12 w-12 rounded-full items-center justify-center mr-4 bg-gray-50 border border-gray-100"
          style={
            task.color
              ? { backgroundColor: task.color + "20" } // 20 opacity hex
              : {}
          }
        >
          <Text style={{ fontSize: 24 }}>{task.icon || "📝"}</Text>
        </View>

        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              task.isDone ? "text-gray-400 line-through" : "text-gray-800"
            }`}
            numberOfLines={1}
          >
            {task.label}
          </Text>
          {task.isDone && (
            <Text className="text-xs text-gray-400 mt-0.5">
              {i18n.t('completed')}
            </Text>
          )}
        </View>

        {task.isDone ? (
          <View className="bg-green-100 p-1.5 rounded-full">
            <Icon as={CheckIcon} className="text-green-600" size="sm" />
          </View>
        ) : (
          <View className="w-6 h-6 rounded-full border-2 border-gray-200" />
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
  const [cursor, setCursor] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const locale = i18n.locale === "vi" ? "vi-VN" : "en-US";
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const selectedKey = toLocalDateString(value);
  const todayKey = toLocalDateString(new Date());
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
          className="w-full bg-white rounded-3xl p-5 border border-gray-100"
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
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 border border-gray-100"
            >
              <Icon as={ChevronLeftIcon} size="sm" className="text-gray-600" />
            </Pressable>
            <Text className="text-base font-semibold text-gray-900">
              {cursor.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("next_month")}
              onPress={() => setCursor(new Date(year, month + 1, 1))}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 border border-gray-100"
            >
              <Icon as={ChevronRightIcon} size="sm" className="text-gray-600" />
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
              const date = new Date(year, month, day);
              const key = toLocalDateString(date);
              const selected = key === selectedKey;
              const today = key === todayKey;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => onSelect(date)}
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
                      style={{ color: selected ? "#ffffff" : today ? "#8882e7" : "#374151" }}
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
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
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
                  : "bg-white border-gray-200"
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
                  item === activePillLabel ? "text-white" : "text-gray-600"
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const sectionListRef = useRef<SectionList<Task>>(null);
  const [filteredOnDate, setFilteredOnDate] = useState<Date | null>(new Date());
  const router = useRouter();

  const routineTasks = useCandyContext((state) => state.routineTasks);
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
    RoutineTaskService.getFilteredRoutineTasks(
      routineTasks,
      filteredOnDate,
    ).then((filteredTasks) => {
      setTasks(
        filteredTasks.map((task) => {
          return {
            id: task.id,
            label: task.label,
            isFavorite: task.isFavorite,
            isDone: task.isDone || false,
            color: task.color,
            icon: task.icon,
          };
        }),
      );
    });
  }, [routineTasks, filteredOnDate]);

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
      const remainingDoneCount = task.isDone
        ? tasks.filter((t) => t.isDone && t.id !== taskId).length
        : tasks.filter((t) => t.isDone).length + 1;

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

  const todoTasks = tasks.filter((task) => !task.isDone);
  const doneTasks = tasks.filter((task) => task.isDone);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-gray-50/50 pt-4">
        <SectionList
          ref={sectionListRef}
          sections={[
            { title: i18n.t('todo'), data: todoTasks },
            { title: i18n.t('completed'), data: doneTasks },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title, data } }) => {
            if (title === i18n.t('completed') && data.length > 0) {
              return (
                <View className="flex-row items-center px-6 py-4 mt-2 mb-2">
                  <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {i18n.t('completed')} ({data.length})
                  </Text>
                  <View className="h-[1px] flex-1 bg-gray-200 ml-4" />
                </View>
              );
            }
            return null;
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
                No tasks for this day
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
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
          className="bg-[#8882E7] mb-6 mr-4 shadow-lg shadow-indigo-200"
          placement="bottom right"
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
