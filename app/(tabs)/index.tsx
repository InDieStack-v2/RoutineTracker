import { ProgressCircle } from "@/components/CircleProgress";
import { Icon } from "@/components/ui/icon";
import { Emojis } from "@/constants/Moods";
import i18n from "@/i18n";
import log from "@/services/logger";
import { RoutineTaskService } from "@/services/routineTaskService";
import { useMoodStore } from "@/store/moodStore";
import { useSettingsStore } from "@/store/settingsStore";
import {
  addLocalDays,
  datesInMonth,
  startOfWeekMonday,
  todayLocalDateString,
  toLocalDateString,
} from "@/utils/dateUtils";
import { useFocusEffect, useScrollToTop } from "expo-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
} from "react-native-svg";

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
  done: boolean;
  rate: number;
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

function weekRangeLabel(start: Date, language: string): string {
  const end = addLocalDays(start, 6);
  const locale = language === "vi" ? "vi-VN" : "en-US";
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

function completionPercent(mark: DayMark | undefined): number {
  if (!mark) return 0;
  if (mark.rate > 0) return Math.round(Math.min(1, mark.rate) * 100);
  return mark.done ? 100 : 0;
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
        className="bg-white rounded-3xl px-5 py-5 border border-gray-100"
        style={cardShadow}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3" style={{ minWidth: 0 }}>
            {eyebrow ? (
              <Text className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {eyebrow}
              </Text>
            ) : null}
            <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          </View>
          {trailing}
        </View>
        {children}
      </View>
    </View>
  );
}

function WeeklyChart() {
  const language = useSettingsStore((state) => state.language);
  const [weekOffset, setWeekOffset] = useState(0);
  const [counts, setCounts] = useState<WeekCount[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weekOffsetRef = useRef(0);
  const requestId = useRef(0);

  const labels = weekLabels();
  const today = todayLocalDateString();
  const weekStart = addLocalDays(startOfWeekMonday(new Date()), weekOffset * 7);
  const isCurrentWeek = weekOffset === 0;

  const loadWeek = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    try {
      const start = addLocalDays(startOfWeekMonday(new Date()), offset * 7);
      const dates = Array.from({ length: 7 }, (_, index) => addLocalDays(start, index));
      const results = await RoutineTaskService.getFinishedRoutineTasksForDates(dates);
      if (id !== requestId.current) return;
      setCounts(
        dates.map((date, index) => ({
          date: toLocalDateString(date),
          value: results[index]?.length ?? 0,
        })),
      );
      setReady(true);
    } catch (error) {
      log.error("[HomeScreen] Failed to load weekly tasks", { error });
    }
  }, []);

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
        <Text className="text-2xl font-bold text-gray-900">{ready ? total : "–"}</Text>
      }
    >
      <WeekSwitch
        label={isCurrentWeek ? i18n.t("this_week") : weekRangeLabel(weekStart, language)}
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
                  color: selected || bar.isToday ? ACCENT : "#4b5563",
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
                  backgroundColor: bar.isFuture ? "#f9fafb" : TRACK,
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
      className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 border border-gray-100"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon
        as={direction === "left" ? ChevronLeftIcon : ChevronRightIcon}
        size="sm"
        className="text-gray-600"
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
        className="flex-1 text-center text-sm font-semibold text-gray-700 mx-2"
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

function MonthlyCalendar() {
  const language = useSettingsStore((state) => state.language);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [cellWidth, setCellWidth] = useState(0);
  const labels = weekLabels();
  const today = todayLocalDateString();
  const { year, month } = visibleMonth;
  const days = datesInMonth(year, month);
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const ringSize =
    cellWidth > 0 ? Math.min(40, Math.max(24, Math.floor(cellWidth) - 8)) : 28;
  const monthRef = useRef(visibleMonth);
  const requestId = useRef(0);

  const loadMonth = useCallback(async (nextYear: number, nextMonth: number) => {
    const id = ++requestId.current;
    try {
      const dates = datesInMonth(nextYear, nextMonth);
      const [finished, rates] = await Promise.all([
        RoutineTaskService.getFinishedRoutineTasksForDates(dates),
        RoutineTaskService.getFinishedRoutineTaskRatesForDates(dates),
      ]);
      if (id !== requestId.current) return;
      const next: Record<string, DayMark> = {};
      dates.forEach((date, index) => {
        const key = toLocalDateString(date);
        const done = (finished[index]?.length ?? 0) > 0;
        const rate = rates[index] ?? 0;
        if (done || rate > 0) {
          next[key] = { done, rate };
        }
      });
      setMarks(next);
    } catch (error) {
      log.error("[HomeScreen] Failed to load calendar", { error });
    }
  }, []);

  const shiftMonth = (delta: number) => {
    const current = monthRef.current;
    const nextDate = new Date(current.year, current.month + delta, 1);
    const next = { year: nextDate.getFullYear(), month: nextDate.getMonth() };
    monthRef.current = next;
    setVisibleMonth(next);
    loadMonth(next.year, next.month);
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

  return (
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
          const dateStr = toLocalDateString(date);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const percent = isFuture ? 0 : completionPercent(marks[dateStr]);
          return (
            <View
              key={dateStr}
              className="items-center justify-center"
              style={{ width: "14.28%", height: ringSize + 8 }}
            >
              <ProgressCircle
                size={ringSize}
                progressPercent={percent}
                displayText={String(date.getDate())}
                textColor={
                  isFuture ? "#d1d5db" : isToday || percent > 0 ? ACCENT : "#4b5563"
                }
              />
            </View>
          );
        })}
      </View>
    </Board>
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
                stroke="#f3f4f6"
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
                  key={labels[index] ?? index}
                  cx={xFor(index, chartWidth)}
                  cy={yFor(point)}
                  r={index === todayIndex ? 5 : 4}
                  fill={ACCENT}
                />
              ),
            )}
          </Svg>
        ) : null}
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
  const moodLogs = useMoodStore((state) => state.moodLogs);
  const [weekOffset, setWeekOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const labels = weekLabels();
  const today = todayLocalDateString();
  const weekStart = addLocalDays(startOfWeekMonday(new Date()), weekOffset * 7);
  const isCurrentWeek = weekOffset === 0;
  const dates = Array.from({ length: 7 }, (_, index) =>
    toLocalDateString(addLocalDays(weekStart, index)),
  );
  const points = dates.map((date) => {
    const entry = moodLogs.find((logEntry) => logEntry.date === date);
    return entry ? moodValue(entry.moodIndex) : null;
  });
  const todayIndex = dates.indexOf(today);
  const logged = points.filter((point) => point != null);
  const latest = [...points].reverse().find((point) => point != null);
  const latestEmoji = latest == null ? null : Emojis[5 - latest];
  const shiftWeek = (delta: number) => {
    setWeekOffset((current) => Math.min(0, current + delta));
  };

  return (
    <Board
      title={i18n.t("mood_chart")}
      trailing={
        latestEmoji ? (
          <Text style={{ fontSize: 28, lineHeight: 32 }}>{latestEmoji}</Text>
        ) : null
      }
    >
      <WeekSwitch
        label={isCurrentWeek ? i18n.t("this_week") : weekRangeLabel(weekStart, language)}
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

export default function HomeScreen() {
  const scrollViewRef = React.useRef<ScrollView>(null);



  useScrollToTop(scrollViewRef);

  return (
    <View className="flex-1 bg-gray-50" style={{ width: "100%", overflow: "hidden" }}>
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
            paddingBottom: 96,
            ...(Platform.OS === "web" ? { overflowAnchor: "none" } : null),
          } as ViewStyle
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 576 }}>
          <WeeklyChart />
          <MonthlyCalendar />
          <MoodChart />
        </View>
      </ScrollView>
    </View>
  );
}
