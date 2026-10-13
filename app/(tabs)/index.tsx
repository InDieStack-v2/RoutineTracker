import { ProgressCircle } from "@/components/CircleProgress";
import { Icon } from "@/components/ui/icon";
import { Emojis } from "@/constants/Moods";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import i18n from "@/i18n";
import log from "@/services/logger";
import {
  RoutineTaskService,
  scheduledCompletionRate,
  type RoutineTaskSummary,
} from "@/services/routineTaskService";
import { averageCompletion, mostMissed } from "@/services/dashboardStats";
import { useStreakStore } from "@/store/streakStore";
import { useCandyContext } from "@/store/context";
import type { RoutineTask } from "@/store/candyStore";
import { useMoodStore } from "@/store/moodStore";
import { useSettingsStore } from "@/store/settingsStore";
import {
  addLocalDays,
  currentCalendar,
  datesInMonth,
  formatCalendarDate,
  startOfWeekMonday,
  todayLocalDateString,
  toLocalDateString,
} from "@/utils/dateUtils";
import { isSystemTimeZone } from "@/utils/timezone";
import { useFocusEffect, useScrollToTop } from "expo-router";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
} from "react-native-svg";
import { useIsDark } from "@/hooks/useIsDark";

const ACCENT = "#8882e7";
const ACCENT_SOFT = "#d9d7f8";
const TRACK = "#f3f4f6";
const BAR_TRACK = 88;
const CHART_HEIGHT = 128;
const CHART_PAD_TOP = 12;
const CHART_PAD_BOTTOM = 12;
const EMOJI_COL = 24;

const cardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0 1px 3px rgba(17, 24, 39, 0.06)", overflowAnchor: "none" }
    : {
        shadowColor: "#111827",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }
) as ViewStyle;

type DayMark = {
  taskIds: string[];
};

type WeekCount = {
  date: string;
  value: number;
};

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

function monthLabel(year: number, month: number, language: string): string {
  const locale = language === "vi" ? "vi-VN" : "en-US";
  return new Date(year, month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function weekRangeLabel(start: Date, language: string, timeZone: string): string {
  const end = addLocalDays(start, 6, timeZone);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  if (!isSystemTimeZone(timeZone)) {
    const startStr = toLocalDateString(start, timeZone);
    const endStr = toLocalDateString(end, timeZone);
    const [startYear, startMonth] = startStr.split("-").map(Number);
    const [endYear, endMonth] = endStr.split("-").map(Number);
    const sameMonth = startYear === endYear && startMonth === endMonth;
    const includeYear = endYear !== currentCalendar(timeZone).year;
    const startText = formatCalendarDate(startStr, locale, { month: "short", day: "numeric" });
    const endText = formatCalendarDate(endStr, locale, {
      day: "numeric",
      ...(sameMonth ? {} : { month: "short" }),
      ...(includeYear ? { year: "numeric" } : {}),
    });
    return `${startText} – ${endText}`;
  }
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const includeYear = end.getFullYear() !== new Date().getFullYear();
  const startText = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
  const endText = end.toLocaleDateString(locale, {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
    ...(includeYear ? { year: "numeric" } : {}),
  });
  return `${startText} – ${endText}`;
}


function moodValue(moodIndex: number): number {
  return 5 - Math.max(0, Math.min(4, moodIndex));
}

function yFor(value: number): number {
  const plot = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  return CHART_PAD_TOP + ((5 - value) / 4) * plot;
}

function xFor(index: number, width: number): number {
  const padX = Math.min(14, width / 10);
  return padX + (index / 6) * Math.max(0, width - padX * 2);
}

function Board({
  eyebrow,
  title,
  trailing,
  children,
}: {
  eyebrow?: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4 mx-4">
      <View
        className="bg-white dark:bg-gray-900 rounded-3xl px-5 py-5 border border-gray-100 dark:border-gray-800"
        style={cardShadow}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3" style={{ minWidth: 0 }}>
            {eyebrow ? (
              <Text className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {eyebrow}
              </Text>
            ) : null}
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</Text>
          </View>
          {trailing}
        </View>
        {children}
      </View>
    </View>
  );
}

function WeeklyChart() {
  const dark = useIsDark();
  const language = useSettingsStore((state) => state.language);
  const timezone = useSettingsStore((state) => state.timezone);
  const [weekOffset, setWeekOffset] = useState(0);
  const [counts, setCounts] = useState<WeekCount[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weekOffsetRef = useRef(0);
  const requestId = useRef(0);

  const labels = weekLabels();
  const today = todayLocalDateString(timezone);
  const weekStart = addLocalDays(startOfWeekMonday(new Date(), timezone), weekOffset * 7, timezone);
  const isCurrentWeek = weekOffset === 0;

  const loadWeek = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    try {
      const start = addLocalDays(startOfWeekMonday(new Date(), timezone), offset * 7, timezone);
      const dates = Array.from({ length: 7 }, (_, index) => addLocalDays(start, index, timezone));
      const results = await RoutineTaskService.getFinishedRoutineTasksForDates(dates);
      if (id !== requestId.current) return;
      setCounts(
        dates.map((date, index) => ({
          date: toLocalDateString(date, timezone),
          value: results[index]?.length ?? 0,
        })),
      );
      setReady(true);
    } catch (error) {
      log.error("[HomeScreen] Failed to load weekly tasks", { error });
    }
  }, [timezone]);

  useFocusEffect(
    useCallback(() => {
      loadWeek(weekOffsetRef.current);
      return () => {
        requestId.current += 1;
      };
    }, [loadWeek]),
  );

  const shiftWeek = (delta: number) => {
    const next = Math.min(0, weekOffsetRef.current + delta);
    if (next === weekOffsetRef.current) return;
    weekOffsetRef.current = next;
    setSelectedDate(null);
    setWeekOffset(next);
    loadWeek(next);
  };

  const bars = counts.map((count, index) => ({
    ...count,
    label: labels[index] ?? "",
    isToday: count.date === today,
    isFuture: count.date > today,
  }));
  const total = bars.reduce(
    (sum, bar) => sum + (bar.isFuture ? 0 : bar.value),
    0,
  );
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <Board
      title={i18n.t("tasks_completed")}
      trailing={
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50">{ready ? total : "–"}</Text>
      }
    >
      <WeekSwitch
        label={isCurrentWeek ? i18n.t("this_week") : weekRangeLabel(weekStart, language, timezone)}
        canGoForward={weekOffset < 0}
        onShift={shiftWeek}
      />
      {ready && total === 0 ? (
        <Text className="text-sm text-gray-400 mb-3">
          {i18n.t(isCurrentWeek ? "no_tasks_this_week" : "no_tasks_that_week")}
        </Text>
      ) : null}
      <View className="flex-row items-end">
        {(bars.length > 0 ? bars : labels.map((label) => ({
          date: label,
          value: 0,
          label,
          isToday: false,
          isFuture: false,
        }))).map((bar) => {
          const selected = selectedDate === bar.date;
          const height =
            bar.value === 0 ? 0 : Math.max(6, (bar.value / max) * BAR_TRACK);
          return (
            <Pressable
              key={`${language}-${bar.date}`}
              accessibilityRole="button"
              accessibilityLabel={`${bar.label}, ${bar.value}`}
              disabled={bar.isFuture || bar.value === 0}
              onPress={() =>
                setSelectedDate((current) =>
                  current === bar.date ? null : bar.date,
                )
              }
              className="flex-1 items-center"
              style={{ minWidth: 0 }}
            >
              <Text
                className="text-xs font-semibold mb-1"
                style={{
                  color: selected || bar.isToday ? ACCENT : dark ? "#9ca3af" : "#4b5563",
                  opacity: bar.value > 0 ? 1 : 0,
                }}
              >
                {bar.value || 0}
              </Text>
              <View
                className="overflow-hidden justify-end"
                style={{
                  width: "55%",
                  maxWidth: 22,
                  height: BAR_TRACK,
                  borderRadius: 8,
                  backgroundColor: bar.isFuture ? (dark ? "#111827" : "#f9fafb") : dark ? "#1f2937" : TRACK,
                }}
              >
                <View
                  style={{
                    height,
                    backgroundColor:
                      selected || bar.isToday ? ACCENT : ACCENT_SOFT,
                  }}
                />
              </View>
              <Text
                numberOfLines={1}
                className="text-xs mt-2"
                style={{
                  color: bar.isToday ? ACCENT : "#9ca3af",
                  fontWeight: bar.isToday ? "700" : "500",
                }}
              >
                {bar.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Board>
  );
}

function MonthArrow({
  direction,
  onPress,
  disabled = false,
  label,
}: {
  direction: "left" | "right";
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label ?? i18n.t(direction === "left" ? "previous_month" : "next_month")
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon
        as={direction === "left" ? ChevronLeftIcon : ChevronRightIcon}
        size="sm"
        className="text-gray-600 dark:text-gray-300"
      />
    </Pressable>
  );
}

function WeekSwitch({
  label,
  canGoForward,
  onShift,
}: {
  label: string;
  canGoForward: boolean;
  onShift: (delta: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <MonthArrow
        direction="left"
        label={i18n.t("previous_week")}
        onPress={() => onShift(-1)}
      />
      <Text
        numberOfLines={1}
        className="flex-1 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 mx-2"
      >
        {label}
      </Text>
      <MonthArrow
        direction="right"
        label={i18n.t("next_week")}
        onPress={() => onShift(1)}
        disabled={!canGoForward}
      />
    </View>
  );
}

type DayAnchor = {
  date: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TaskChip = {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  deleted?: boolean;
};

const TOOLTIP_WIDTH = 248;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_GAP = 10;
const CARET_SIZE = 7;
const CARET_HALF = 8;
const CARET_WIDTH = CARET_HALF * 2;
const CARET_INSET = 16;
const TOOLTIP_BORDER = "#f3f4f6";

function dayLabel(dateStr: string, language: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(year !== currentCalendar().year ? { year: "numeric" } : {}),
  });
}

function completedTasksFor(
  ids: string[],
  routineTasks: RoutineTask[],
  summaries: Record<string, RoutineTaskSummary>,
  language: string,
): TaskChip[] {
  const seen: Record<string, true> = {};
  const tasks: TaskChip[] = [];
  for (const id of ids) {
    if (seen[id]) continue;
    seen[id] = true;
    const live = routineTasks.find((task) => task.id === id && !task.deletedAt);
    if (live) {
      tasks.push({
        id,
        label: live.label,
        icon: live.icon,
        color: live.color,
      });
      continue;
    }
    const saved = summaries[id];
    tasks.push(
      saved
        ? {
            id,
            label: saved.label,
            icon: saved.icon ?? undefined,
            color: saved.color ?? undefined,
            deleted: true,
          }
        : { id, label: i18n.t("deleted_task"), deleted: true },
    );
  }
  const locale = language === "vi" ? "vi" : "en";
  return tasks.sort((a, b) => a.label.localeCompare(b.label, locale));
}

function tooltipFrame(
  anchor: DayAnchor,
  tipWidth: number,
  tipHeight: number,
  screenWidth: number,
  screenHeight: number,
): { left: number; top: number; placeBelow: boolean; caretLeft: number } {
  const belowTop = anchor.y + anchor.height + TOOLTIP_GAP + CARET_SIZE;
  const aboveTop = anchor.y - TOOLTIP_GAP - CARET_SIZE - tipHeight;
  const fitsBelow =
    tipHeight === 0 || belowTop + tipHeight <= screenHeight - TOOLTIP_MARGIN;
  const fitsAbove = tipHeight > 0 && aboveTop >= TOOLTIP_MARGIN;
  const placeBelow = fitsBelow || !fitsAbove;
  const top = Math.round(
    placeBelow
      ? Math.min(
          belowTop,
          Math.max(TOOLTIP_MARGIN, screenHeight - TOOLTIP_MARGIN - Math.max(tipHeight, 1)),
        )
      : Math.max(TOOLTIP_MARGIN, aboveTop),
  );
  const left = Math.round(
    Math.min(
      Math.max(TOOLTIP_MARGIN, anchor.x + anchor.width / 2 - tipWidth / 2),
      Math.max(TOOLTIP_MARGIN, screenWidth - TOOLTIP_MARGIN - tipWidth),
    ),
  );
  const caretLeft = Math.round(
    Math.min(
      Math.max(CARET_INSET, anchor.x + anchor.width / 2 - left - CARET_HALF),
      tipWidth - CARET_INSET - CARET_WIDTH,
    ),
  );
  return { left, top, placeBelow, caretLeft };
}

function tooltipPath(
  width: number,
  height: number,
  caretLeft: number,
  up: boolean,
): string {
  const inset = 1;
  const radius = 16;
  const x0 = inset;
  const x1 = width - inset;
  const y0 = inset;
  const y1 = height - inset;
  const bodyTop = up ? y0 + CARET_SIZE : y0;
  const bodyBottom = up ? y1 : y1 - CARET_SIZE;
  const center = caretLeft + CARET_HALF;
  const notchStart = Math.max(x0 + radius, center - CARET_HALF);
  const notchEnd = Math.min(x1 - radius, center + CARET_HALF);
  const peakY = up ? y0 : y1;
  const baseY = up ? bodyTop : bodyBottom;

  if (up) {
    return [
      `M ${x0 + radius} ${bodyTop}`,
      `H ${notchStart}`,
      `L ${center} ${peakY}`,
      `L ${notchEnd} ${baseY}`,
      `H ${x1 - radius}`,
      `A ${radius} ${radius} 0 0 1 ${x1} ${bodyTop + radius}`,
      `V ${bodyBottom - radius}`,
      `A ${radius} ${radius} 0 0 1 ${x1 - radius} ${bodyBottom}`,
      `H ${x0 + radius}`,
      `A ${radius} ${radius} 0 0 1 ${x0} ${bodyBottom - radius}`,
      `V ${bodyTop + radius}`,
      `A ${radius} ${radius} 0 0 1 ${x0 + radius} ${bodyTop}`,
      "Z",
    ].join(" ");
  }

  return [
    `M ${x0 + radius} ${bodyTop}`,
    `H ${x1 - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x1} ${bodyTop + radius}`,
    `V ${bodyBottom - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x1 - radius} ${bodyBottom}`,
    `H ${notchEnd}`,
    `L ${center} ${peakY}`,
    `L ${notchStart} ${baseY}`,
    `H ${x0 + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x0} ${bodyBottom - radius}`,
    `V ${bodyTop + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x0 + radius} ${bodyTop}`,
    "Z",
  ].join(" ");
}

function TooltipTaskItem({ task }: { task: TaskChip }) {
  const dark = useIsDark();
  return (
    <View className="flex-row items-center" style={{ minHeight: 36 }}>
      <View
        className="items-center justify-center border border-gray-100 dark:border-gray-800"
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          marginRight: 10,
          backgroundColor: task.color ? `${task.color}20` : dark ? "#1f2937" : "#f3f4f6",
          opacity: task.deleted ? 0.55 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            lineHeight: 20,
            height: 20,
            textAlign: "center",
            ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
          }}
        >
          {task.icon || (task.deleted ? "·" : "📝")}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        className={`flex-1 text-sm font-semibold ${
          task.deleted ? "text-gray-400" : "text-gray-800 dark:text-gray-100"
        }`}
      >
        {task.label}
      </Text>
      {task.deleted ? null : (
        <View className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-green-100">
          <Icon as={CheckIcon} size="sm" className="text-green-600 w-3 h-3" />
        </View>
      )}
    </View>
  );
}

function DayTasksTooltip({
  anchor,
  title,
  tasks,
  onClose,
}: {
  anchor: DayAnchor;
  title: string;
  tasks: TaskChip[];
  onClose: () => void;
}) {
  const dark = useIsDark();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [tipHeight, setTipHeight] = useState(0);
  const tipWidth = Math.min(TOOLTIP_WIDTH, screenWidth - TOOLTIP_MARGIN * 2);
  const frame = tooltipFrame(anchor, tipWidth, tipHeight, screenWidth, screenHeight);

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.t("cancel")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            if (next > 0 && Math.abs(next - tipHeight) > 0.5) setTipHeight(next);
          }}
          style={{
            position: "absolute",
            left: frame.left,
            top: frame.top,
            width: tipWidth,
            opacity: tipHeight > 0 ? 1 : 0,
            zIndex: 2,
            overflow: "visible",
            ...cardShadow,
            elevation: 0,
          }}
        >
          {tipHeight > 0 ? (
            <Svg
              pointerEvents="none"
              width={tipWidth}
              height={tipHeight + CARET_SIZE}
              style={{
                position: "absolute",
                left: 0,
                top: frame.placeBelow ? -CARET_SIZE : 0,
              }}
            >
              <SvgPath
                d={tooltipPath(
                  tipWidth,
                  tipHeight + CARET_SIZE,
                  frame.caretLeft,
                  frame.placeBelow,
                )}
                fill={dark ? "#111827" : "#ffffff"}
                stroke={dark ? "#1f2937" : TOOLTIP_BORDER}
                strokeWidth={1}
                strokeLinejoin="miter"
                strokeMiterlimit={4}
              />
            </Svg>
          ) : null}
          <View className="px-3 py-3">
            <Text className="text-xs font-semibold text-gray-400 mb-2">{title}</Text>
            {tasks.length === 0 ? (
              <Text className="text-sm text-gray-400">{i18n.t("no_tasks_that_day")}</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 180 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {tasks.map((task, index) => (
                  <View key={task.id} style={{ marginTop: index === 0 ? 0 : 6 }}>
                    <TooltipTaskItem task={task} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MonthlyCalendar() {
  const dark = useIsDark();
  const language = useSettingsStore((state) => state.language);
  const timezone = useSettingsStore((state) => state.timezone);
  const routineTasks = useCandyContext((state) => state.routineTasks);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = currentCalendar();
    return { year: now.year, month: now.month };
  });
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [summaries, setSummaries] = useState<Record<string, RoutineTaskSummary>>({});
  const [anchor, setAnchor] = useState<DayAnchor | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const labels = weekLabels();
  const today = todayLocalDateString(timezone);
  const { year, month } = visibleMonth;
  const days = datesInMonth(year, month, timezone);
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const ringSize =
    cellWidth > 0 ? Math.min(40, Math.max(24, Math.floor(cellWidth) - 8)) : 28;
  const monthRef = useRef(visibleMonth);
  const requestId = useRef(0);
  const cellRefs = useRef<Record<string, View | null>>({});

  const loadMonth = useCallback(async (nextYear: number, nextMonth: number) => {
    const id = ++requestId.current;
    try {
      const dates = datesInMonth(nextYear, nextMonth, timezone);
      const finished = await RoutineTaskService.getFinishedRoutineTasksForDates(dates);
      if (id !== requestId.current) return;
      const next: Record<string, DayMark> = {};
      dates.forEach((date, index) => {
        const taskIds = finished[index] ?? [];
        if (taskIds.length > 0) {
          next[toLocalDateString(date, timezone)] = { taskIds };
        }
      });
      setMarks(next);
      const rows = await RoutineTaskService.getRoutineTaskSummaries(finished.flat());
      if (id !== requestId.current) return;
      const nextSummaries: Record<string, RoutineTaskSummary> = {};
      for (const row of rows) {
        nextSummaries[row.id] = row;
      }
      setSummaries(nextSummaries);
    } catch (error) {
      log.error("[HomeScreen] Failed to load calendar", { error });
    }
  }, [timezone]);

  const shiftMonth = (delta: number) => {
    const current = monthRef.current;
    const nextDate = new Date(current.year, current.month + delta, 1);
    const next = { year: nextDate.getFullYear(), month: nextDate.getMonth() };
    monthRef.current = next;
    setAnchor(null);
    setVisibleMonth(next);
    loadMonth(next.year, next.month);
  };

  const openDay = (dateStr: string) => {
    if (anchor?.date === dateStr) {
      setAnchor(null);
      return;
    }
    const node = cellRefs.current[dateStr];
    if (Platform.OS === "web") {
      const webNode = document.getElementById(`cal-${dateStr}`);
      if (webNode) {
        const rect = webNode.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setAnchor({
            date: dateStr,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
          return;
        }
      }
    }
    node?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setAnchor({ date: dateStr, x, y, width, height });
    });
  };

  useFocusEffect(
    useCallback(() => {
      const current = monthRef.current;
      loadMonth(current.year, current.month);
      return () => {
        requestId.current += 1;
      };
    }, [loadMonth]),
  );
  const seenTimezone = useRef(timezone);
  useEffect(() => {
    if (seenTimezone.current === timezone) return;
    seenTimezone.current = timezone;
    const now = currentCalendar(timezone);
    const next = { year: now.year, month: now.month };
    monthRef.current = next;
    setAnchor(null);
    setVisibleMonth(next);
    loadMonth(next.year, next.month);
  }, [timezone, loadMonth]);


  const selectedTasks = anchor
    ? completedTasksFor(
        marks[anchor.date]?.taskIds ?? [],
        routineTasks,
        summaries,
        language,
      )
    : [];

  return (
    <>
      <Board
        eyebrow={i18n.t("calendar_stats")}
        title={monthLabel(year, month, language)}
        trailing={
          <View className="flex-row items-center gap-2">
            <MonthArrow direction="left" onPress={() => shiftMonth(-1)} />
            <MonthArrow direction="right" onPress={() => shiftMonth(1)} />
          </View>
        }
      >
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
        <View
          className="flex-row flex-wrap"
          onLayout={(event) => {
            const next = event.nativeEvent.layout.width / 7;
            if (next > 0 && Math.abs(next - cellWidth) > 0.5) {
              setCellWidth(next);
            }
          }}
        >
          {Array.from({ length: startOffset }, (_, index) => (
            <View key={`empty-${index}`} style={{ width: "14.28%", height: ringSize + 8 }} />
          ))}
          {days.map((date) => {
            const dateStr = toLocalDateString(date, timezone);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const selected = anchor?.date === dateStr;
            const percent = isFuture
              ? 0
              : Math.round(
                  scheduledCompletionRate(
                    routineTasks,
                    date,
                    marks[dateStr]?.taskIds ?? [],
                  ) * 100,
                );
            const dayTasks = completedTasksFor(
              marks[dateStr]?.taskIds ?? [],
              routineTasks,
              summaries,
              language,
            );
            const label = dayLabel(dateStr, language);
            const taskNames = dayTasks.map((task) => task.label).join(", ");
            return (
              <Pressable
                key={dateStr}
                accessibilityRole="button"
                accessibilityState={{ disabled: isFuture, selected }}
                accessibilityLabel={
                  taskNames ? `${label}, ${taskNames}` : `${label}, ${i18n.t("no_tasks_that_day")}`
                }
                disabled={isFuture}
                onPress={() => openDay(dateStr)}
                className="items-center justify-center"
                style={{ width: "14.28%", height: ringSize + 8 }}
              >
                <View
                  nativeID={`cal-${dateStr}`}
                  ref={(node) => {
                    cellRefs.current[dateStr] = node;
                  }}
                  collapsable={false}
                  style={{
                    borderRadius: ringSize / 2,
                    backgroundColor: selected ? ACCENT_SOFT : "transparent",
                  }}
                >
                  <ProgressCircle
                    size={ringSize}
                    progressPercent={percent}
                    displayText={String(Number(dateStr.slice(8)))}
                    textColor={
                      isFuture
                        ? (dark ? "#4b5563" : "#d1d5db")
                        : selected || isToday || percent > 0
                          ? ACCENT
                          : dark
                            ? "#9ca3af"
                            : "#4b5563"
                    }
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Board>
      {anchor ? (
        <DayTasksTooltip
          anchor={anchor}
          title={dayLabel(anchor.date, language)}
          tasks={selectedTasks}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </>
  );
}

function MoodLine({
  points,
  labels,
  todayIndex,
  width,
}: {
  points: (number | null)[];
  labels: string[];
  todayIndex: number;
  width: number;
}) {
  const dark = useIsDark();
  const chartWidth = Math.max(0, width - EMOJI_COL);
  const groups: number[][] = [];
  let current: number[] = [];
  points.forEach((point, index) => {
    if (point == null) {
      if (current.length > 0) groups.push(current);
      current = [];
      return;
    }
    current.push(index);
  });
  if (current.length > 0) groups.push(current);

  return (
    <View>
      <View className="flex-row" style={{ height: CHART_HEIGHT }}>
        <View style={{ width: EMOJI_COL, height: CHART_HEIGHT }}>
          {Emojis.map((emoji, index) => (
            <Text
              key={emoji}
              style={{
                position: "absolute",
                top: yFor(5 - index) - 8,
                width: EMOJI_COL,
                textAlign: "center",
                fontSize: 13,
                lineHeight: 16,
              }}
            >
              {emoji}
            </Text>
          ))}
        </View>
        {chartWidth > 0 ? (
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {Emojis.map((emoji, index) => (
              <SvgLine
                key={emoji}
                x1={0}
                x2={chartWidth}
                y1={yFor(5 - index)}
                y2={yFor(5 - index)}
                stroke={dark ? "#1f2937" : "#f3f4f6"}
                strokeWidth={1}
              />
            ))}
            {groups.map((group) => {
              const line = group
                .map((index, order) => {
                  const value = points[index] ?? 1;
                  return `${order === 0 ? "M" : "L"}${xFor(index, chartWidth)},${yFor(value)}`;
                })
                .join(" ");
              const first = group[0];
              const last = group[group.length - 1];
              const bottom = CHART_HEIGHT - CHART_PAD_BOTTOM;
              const area = `${line} L${xFor(last, chartWidth)},${bottom} L${xFor(first, chartWidth)},${bottom} Z`;
              return (
                <React.Fragment key={group.join("-")}>
                  {group.length > 1 ? (
                    <SvgPath d={area} fill={ACCENT} fillOpacity={0.12} stroke="none" />
                  ) : null}
                  {group.length > 1 ? (
                    <SvgPath
                      d={line}
                      stroke={ACCENT}
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
            {points.map((point, index) =>
              point == null ? null : (
                <SvgCircle
                  key={`halo-${labels[index] ?? index}`}
                  cx={xFor(index, chartWidth)}
                  cy={yFor(point)}
                  r={11}
                  fill={dark ? "#111827" : "#ffffff"}
                  stroke={ACCENT}
                  strokeWidth={1.5}
                />
              ),
            )}
          </Svg>
        ) : null}
        {chartWidth > 0
          ? points.map((point, index) =>
              point == null ? null : (
                <Text
                  key={`emoji-${labels[index] ?? index}`}
                  style={{
                    position: "absolute",
                    left: EMOJI_COL + xFor(index, chartWidth) - 10,
                    top: yFor(point) - 9,
                    width: 20,
                    textAlign: "center",
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {Emojis[5 - point]}
                </Text>
              ),
            )
          : null}

      </View>
      {chartWidth > 0 ? (
        <View style={{ height: 18, marginLeft: EMOJI_COL, marginTop: 6 }}>
          {labels.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              numberOfLines={1}
              style={{
                position: "absolute",
                left: xFor(index, chartWidth) - 16,
                width: 32,
                textAlign: "center",
                fontSize: 11,
                color: index === todayIndex ? ACCENT : "#9ca3af",
                fontWeight: index === todayIndex ? "700" : "500",
              }}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ height: 24 }} />
      )}
    </View>
  );
}

function MoodChart() {
  const language = useSettingsStore((state) => state.language);
  const timezone = useSettingsStore((state) => state.timezone);
  const moodLogs = useMoodStore((state) => state.moodLogs);
  const [weekOffset, setWeekOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const labels = weekLabels();
  const today = todayLocalDateString(timezone);
  const weekStart = addLocalDays(startOfWeekMonday(new Date(), timezone), weekOffset * 7, timezone);
  const isCurrentWeek = weekOffset === 0;
  const dates = Array.from({ length: 7 }, (_, index) =>
    toLocalDateString(addLocalDays(weekStart, index, timezone), timezone),
  );
  const points = dates.map((date) => {
    const entry = moodLogs.find((logEntry) => logEntry.date === date);
    return entry ? moodValue(entry.moodIndex) : null;
  });
  const todayIndex = dates.indexOf(today);
  const logged = points.filter((point) => point != null);
  const latest = [...points].reverse().find((point) => point != null);
  const latestIndex = latest == null ? null : 5 - latest;
  const latestEmoji = latestIndex == null ? null : Emojis[latestIndex];
  const latestLabel =
    latestIndex == null
      ? null
      : [
          i18n.t("great"),
          i18n.t("good"),
          i18n.t("okay"),
          i18n.t("not_good"),
          i18n.t("bad"),
        ][latestIndex];
  const shiftWeek = (delta: number) => {
    setWeekOffset((current) => Math.min(0, current + delta));
  };

  return (
    <Board
      title={i18n.t("mood_chart")}
      trailing={
        latestEmoji ? (
          <View className="items-end">
            <Text style={{ fontSize: 28, lineHeight: 32 }}>{latestEmoji}</Text>
            <Text className="text-xs font-semibold text-gray-500">{latestLabel}</Text>
          </View>
        ) : null
      }
    >
      <WeekSwitch
        label={isCurrentWeek ? i18n.t("this_week") : weekRangeLabel(weekStart, language, timezone)}
        canGoForward={weekOffset < 0}
        onShift={shiftWeek}
      />
      {logged.length === 0 ? (
        <Text className="text-sm text-gray-400 mb-3">
          {i18n.t(isCurrentWeek ? "no_mood_this_week" : "no_mood_that_week")}
        </Text>
      ) : null}
      <View
        style={{ width: "100%" }}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && Math.abs(next - width) > 0.5) setWidth(next);
        }}
      >
        <MoodLine
          key={language}
          points={points}
          labels={labels}
          todayIndex={todayIndex}
          width={width}
        />
      </View>
    </Board>
  );
}

const DASHBOARD_DAYS = 31;

function AvgBar({ label, value }: { label: string; value: number | null }) {
  const dark = useIsDark();
  return (
    <View className="flex-1">
      <View className="flex-row items-baseline justify-between mb-2">
        <Text className="text-xs font-semibold text-gray-400">{label}</Text>
        <Text className="text-base font-bold text-gray-900 dark:text-gray-50">
          {value == null ? "–" : `${value}%`}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          backgroundColor: dark ? "#1f2937" : TRACK,
        }}
      >
        <View style={{ width: `${value ?? 0}%`, height: 6, backgroundColor: ACCENT }} />
      </View>
    </View>
  );
}

function Dashboard() {
  const dark = useIsDark();
  const timezone = useSettingsStore((state) => state.timezone);
  const routineTasks = useCandyContext((state) => state.routineTasks);
  const streak = useStreakStore((state) => state.streakCount);
  const [finished, setFinished] = useState<string[][] | null>(null);

  const days = Array.from({ length: DASHBOARD_DAYS }, (_, index) =>
    addLocalDays(new Date(), -index, timezone),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const dates = Array.from({ length: DASHBOARD_DAYS }, (_, index) =>
        addLocalDays(new Date(), -index, timezone),
      );
      RoutineTaskService.getFinishedRoutineTasksForDates(dates)
        .then((rows) => active && setFinished(rows))
        .catch((error) => log.error("[HomeScreen] Failed to load dashboard", { error }));
      return () => {
        active = false;
      };
    }, [timezone]),
  );

  const top = finished ? mostMissed(routineTasks, days, finished, 30) : [];

  return (
    <Board title={i18n.t("dashboard")}>
      <View className="flex-row items-center mb-5">
        <View
          className="items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            marginRight: 14,
            backgroundColor: dark ? "#2a2850" : "#eeedfc",
          }}
        >
          <Text style={{ fontSize: 26, lineHeight: 32 }}>🔥</Text>
        </View>
        <View>
          <Text className="text-xs font-semibold text-gray-400">{i18n.t("streak")}</Text>
          <Text style={{ fontSize: 32, lineHeight: 38, fontWeight: "700", color: ACCENT }}>
            {i18n.t("streak_days", { count: streak })}
          </Text>
        </View>
      </View>
      <View className="flex-row mb-5" style={{ gap: 20 }}>
        <AvgBar label={i18n.t("avg_7")} value={finished ? averageCompletion(routineTasks, days, finished, 7) : null} />
        <AvgBar label={i18n.t("avg_30")} value={finished ? averageCompletion(routineTasks, days, finished, 30) : null} />
      </View>
      <View className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <Text className="text-xs font-semibold text-gray-400 mb-2">{i18n.t("most_missed")}</Text>
        {finished && top.length === 0 ? (
          <Text className="text-sm text-gray-400">{i18n.t("nothing_missed")}</Text>
        ) : null}
        {top.map(({ task, count }) => (
          <View key={task.id} className="flex-row items-center" style={{ minHeight: 40 }}>
            <View
              className="items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                marginRight: 10,
                backgroundColor: task.color ? `${task.color}20` : dark ? "#1f2937" : "#f3f4f6",
              }}
            >
              <Text style={{ fontSize: 15, lineHeight: 20, height: 20, textAlign: "center" }}>
                {task.icon || "📝"}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100"
            >
              {task.label}
            </Text>
            <Text className="text-sm font-semibold text-gray-400 ml-2">
              {i18n.t("missed_times", { count })}
            </Text>
          </View>
        ))}
      </View>
    </Board>
  );
}

export default function HomeScreen() {
  const tabBarSpace = useTabBarSpace();
  const scrollViewRef = React.useRef<ScrollView>(null);

  useScrollToTop(scrollViewRef);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950" style={{ width: "100%", overflow: "hidden" }}>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        style={
          (Platform.OS === "web"
            ? { width: "100%", overflowAnchor: "none" }
            : { width: "100%" }) as ViewStyle
        }
        contentContainerStyle={
          {
            width: "100%",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: tabBarSpace,
            ...(Platform.OS === "web" ? { overflowAnchor: "none" } : null),
          } as ViewStyle
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 576 }}>
          <Dashboard />
          <WeeklyChart />
          <MonthlyCalendar />
          <MoodChart />
        </View>
      </ScrollView>
    </View>
  );
}
