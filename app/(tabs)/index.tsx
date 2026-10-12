import ProgressCircle from "@/components/CircleProgress";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import log from "@/services/logger";
import { RoutineTaskService } from "@/services/routineTaskService";
import { toLocalDateString } from "@/utils/dateUtils";
import { useFocusEffect, useScrollToTop } from "expo-router";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Calendar } from "react-native-calendars";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useMoodStore } from "@/store/moodStore";

import i18n from "@/i18n";

const MonthlyCalendar = React.memo(() => {
  const [markFinishedDates, setMarkFinishedDates] = useState<string[]>([]);
  const [markFinishedDateRates, setMarkFinishedDateRates] = useState<
    Map<string, number>
  >(new Map());

  async function fetchFinishedDates(onDate: Date | null = null) {
    let markDate = new Date();
    if (onDate) {
      markDate = onDate;
    }

    const datesToFetch: Date[] = [];
    for (let i = 1; i <= 31; i++) {
      const date = new Date(markDate);
      date.setDate(i);
      datesToFetch.push(date);
    }

    const results =
      await RoutineTaskService.getFinishedRoutineTasksForDates(datesToFetch);

    const finishedDates = results
       .map((res, index) => {
         if (res.length > 0) {
           const date = new Date(markDate);
           date.setDate(index + 1);
           return toLocalDateString(date);
         }
         return null;
       })
      .filter((date) => date !== null);

    setMarkFinishedDates(finishedDates);

    const rateResults =
      await RoutineTaskService.getFinishedRoutineTaskRatesForDates(
        datesToFetch,
      );
    const finishedDateRates = new Map<string, number>();
     rateResults.forEach((rate, index) => {
       if (rate !== null) {
         const date = new Date(markDate);
         date.setDate(index + 1);
         const dateStr = toLocalDateString(date);
         finishedDateRates.set(dateStr, rate);
       }
     });
    setMarkFinishedDateRates(finishedDateRates);

    log.info(`[HomeScreen] Fetched finished dates: ${finishedDates}`);
    log.info(
      `[HomeScreen] Fetched finished date rates: ${Array.from(finishedDateRates.entries())}`,
    );
  }

  const memoizedFetchFinishedDates = useCallback(() => {
    fetchFinishedDates();

    return () => {
      setMarkFinishedDates([]);
    };
  }, []);

  useFocusEffect(memoizedFetchFinishedDates);

  const markedDates = useMemo(() => {
    const result: { [date: string]: { marked: boolean; rate: number } } = {};
    for (const date of markFinishedDates) {
      result[date] = { marked: true, rate: 0 };
      if (markFinishedDateRates.has(date)) {
        const rate = markFinishedDateRates.get(date) ?? 0;
        result[date].rate = rate;
      }
    }
    return result;
  }, [markFinishedDates, markFinishedDateRates]);

  const handleMonthChange = useCallback(
    (month: Date) => fetchFinishedDates(month),
    []
  );

  return (
    <StatsView
      title={i18n.t('calendar_stats')}
      data={{
        markFinishedDates,
        markedDates,
        onMonthChange: handleMonthChange,
      }}
      type="progress_calendar"
    />
  );
});
MonthlyCalendar.displayName = 'MonthlyCalendar';

const WeeklyChart = React.memo(() => {
  const [taskCounts, setTaskCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  async function fetchTasks() {
    const _now = new Date();
    let weekDay = _now.getDay(); // 0 (Sun) to 6 (Sat)
    if (weekDay === 0) weekDay = 7; // Make Sunday the last day

    const datesToFetch: Date[] = [];

    for (let i = 1; i <= weekDay; i++) {
      const atDate = new Date(_now);
      atDate.setDate(_now.getDate() - weekDay + i);

      datesToFetch.push(atDate);
    }

    const results =
      await RoutineTaskService.getFinishedRoutineTasksForDates(datesToFetch);
    const counts = results.map((res) => res.length);

    while (counts.length < 7) {
      counts.push(0);
    }

    log.info(`[HomeScreen] Weekly task counts: ${counts}`);
    setTaskCounts(counts);
  }

  const memoizedFetchTasks = useCallback(() => {
    fetchTasks();

    return () => {
      setTaskCounts([0, 0, 0, 0, 0, 0, 0]);
    };
  }, []);

  useFocusEffect(memoizedFetchTasks);

  return <StatsView title={i18n.t('tasks_completed')} data={{ taskCounts }} type="bar" />;
});
WeeklyChart.displayName = 'WeeklyChart';

const MoodChart = React.memo(() => {
  const moodLogs = useMoodStore((state) => state.moodLogs);
  const { width } = useWindowDimensions();

  const lineData = useMemo(() => {
    const _now = new Date();
    const currentDay = _now.getDay() === 0 ? 7 : _now.getDay(); // 1-7 (Mon-Sun)

    const data = [];
    const dayLabels = [
      i18n.t('mon'), i18n.t('tue'), i18n.t('wed'), i18n.t('thu'), i18n.t('fri'), i18n.t('sat'), i18n.t('sun')
    ];

    // Calculate start of week (Monday)
    const startOfWeek = new Date(_now);
    startOfWeek.setDate(_now.getDate() - currentDay + 1);

    for (let i = 0; i < 7; i++) {
      const atDate = new Date(startOfWeek);
      atDate.setDate(startOfWeek.getDate() + i);
      const dateStr = `${atDate.getFullYear()}-${String(
        atDate.getMonth() + 1,
      ).padStart(2, "0")}-${String(atDate.getDate()).padStart(2, "0")}`;

      const log = moodLogs.find((l) => l.date === dateStr);
      const dayLabel = dayLabels[i];

      if (log) {
        data.push({
          value: 4 - log.moodIndex + 1, // Invert: Great(0)->5, Bad(4)->1
          label: dayLabel,
          labelTextStyle: { color: "gray" },
          dataPointText: "",
        });
      } else {
        // For future days or days with no data
        data.push({
          value: 1,
          label: dayLabel,
          labelTextStyle: { color: "gray" },
          hideDataPoint: true,
          customDataPoint: () => null,
        });
      }
    }

    return data;
  }, [moodLogs]);

  // Calculate spacing to fit 7 points exactly in the width
  // Total width available = Screen Width - Padding (e.g. 40 or 60)
  // We have 7 points, so 6 intervals.
  const chartWidth = width - 60;
  const spacing = chartWidth / 7;

  return (
    <StatsView
      title={i18n.t('mood_chart')}
      data={{ lineData, spacing, width: chartWidth }}
      type="line"
    />
  );
});
MoodChart.displayName = 'MoodChart';

interface StatsViewProps {
  title: string;
  data: {
    taskCounts?: number[];
    markFinishedDates?: string[];
    markedDates?: { [date: string]: { marked: boolean; rate: number } };
    lineData?: any[];
    onMonthChange?: (month: Date) => void;
    spacing?: number;
    width?: number;
  };
  type?: "bar" | "line" | "progress_calendar";
}

const StatsView = React.memo(({ title, data, type = "bar" }: StatsViewProps) => {
  let chartComponent = null;
  switch (type) {
    case "bar":
      chartComponent = (
        <View className="py-4">
          <BarChartView taskCounts={data.taskCounts ?? []} />
        </View>
      );
      break;

    case "line":
      chartComponent = (
        <View className="py-4">
          <MoodLineChart
            lineData={data.lineData ?? []}
            spacing={data.spacing}
            width={data.width}
          />
        </View>
      );
      break;

    case "progress_calendar":
      chartComponent = (
        <View className="pb-2">
          <CalendarView
            markedDates={data.markedDates}
            onMonthChange={data.onMonthChange}
          />
        </View>
      );
      break;

    default:
      break;
  }

  let filterText = i18n.t('this_week');
  if (type === "progress_calendar") {
    filterText = i18n.t('this_month');
  }

  return (
    <View className="mb-6 mx-4">
      <View
        className="bg-white rounded-3xl p-5 border border-gray-100"
        style={{
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Heading className="text-xl font-bold text-gray-800 tracking-tight">
            {title}
          </Heading>

          <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <Text className="text-xs font-semibold text-gray-600 mr-1">
              {filterText}
            </Text>
            <Icon as={ChevronDownIcon} size="xs" className="text-gray-400" />
          </View>
        </View>

        <View>{chartComponent}</View>
      </View>
    </View>
  );
});
StatsView.displayName = 'StatsView';

const MoodLineChart = React.memo(({
  lineData,
  spacing = 40,
  width = 300,
}: {
  lineData: any[];
  spacing?: number;
  width?: number;
}) => {
  // Emojis: ["😎", "😊", "😐", "😢", "😡"]
  // Indices: 0, 1, 2, 3, 4
  // Values: 4, 3, 2, 1, 0
  // Y-Axis Labels should be mapped from value.
  // 0 -> 😡 (index 4)
  // 1 -> 😢 (index 3)
  // 2 -> 😐 (index 2)
  // 3 -> 😊 (index 1)
  // 4 -> 😎 (index 0)
  const yAxisLabelTexts = [" ", "😡", "😢", "😐", "😊", "😎"];

  return (
    <View
      style={{ borderRadius: 16, overflow: "hidden" }}
      className="py-2 items-center"
    >
      <LineChart
        data={lineData}
        areaChart
        curved
        isAnimated
        animationDuration={1200}
        startFillColor="#8985e8"
        startOpacity={0.15}
        endFillColor="#ffffff"
        endOpacity={0.01}
        color="#8985e8"
        thickness={3}
        dataPointsColor="#8985e8"
        dataPointsRadius={5}
        textFontSize={10}
        hideRules
        yAxisLabelTexts={yAxisLabelTexts}
        yAxisOffset={0}
        maxValue={5}
        stepValue={1}
        noOfSections={5}
        yAxisTextStyle={{ fontSize: 16, color: "#4b5563" }}
        width={width - 20}
        spacing={spacing}
        initialSpacing={20}
        backgroundColor="transparent"
        hideDataPoints={false}
      />
    </View>
  );
});
MoodLineChart.displayName = 'MoodLineChart';

const BarChartView = React.memo(({ taskCounts }: { taskCounts: number[] }) => {
  const [pressedBarIndex, setPressedBarIndex] = useState(-1);
  const labels = [
    i18n.t('mon'), i18n.t('tue'), i18n.t('wed'), i18n.t('thu'), i18n.t('fri'), i18n.t('sat'), i18n.t('sun')
  ];
  const { width } = useWindowDimensions();
  const initialSpacing = 10;
  const barWidth =
    ((width * 0.85 - initialSpacing) * 3) / (taskCounts.length * 4);

  const barData = taskCounts.map((count, index) => {
    return {
      value: count,
      frontColor: index === pressedBarIndex ? "#8985e8" : "#dadaf8",
      gradientColor: index === pressedBarIndex ? "#6b66d8" : "#e6e6fa",
      label: labels[index],
      labelTextStyle: {
        color: index === pressedBarIndex ? "#8985e8" : "#9ca3af",
        fontSize: 12,
        fontWeight: (index === pressedBarIndex ? "bold" : "normal") as
          | "bold"
          | "normal",
      },
      topLabelComponent: () => {
        if (index === pressedBarIndex) {
          return (
            <View className="items-center mb-2">
              <View
                className="items-center justify-center rounded-xl bg-gray-800 px-3 py-1.5 shadow-md"
                style={{
                  elevation: 4,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                }}
              >
                <Text className="text-white text-xs font-bold">{count}</Text>
              </View>
              <View
                className="w-3 h-3 bg-gray-800"
                style={{
                  transform: [{ rotate: "45deg" }],
                  marginTop: -6,
                  zIndex: -1,
                }}
              />
            </View>
          );
        }
        return null;
      },
    };
  });

  return (
    <BarChart
      data={barData}
      barWidth={barWidth}
      initialSpacing={10}
      spacing={14}
      barBorderTopLeftRadius={8}
      barBorderTopRightRadius={8}
      showGradient
      yAxisThickness={0}
      xAxisThickness={0}
      yAxisTextStyle={{ color: "#9ca3af", fontSize: 11 }}
      noOfSections={3}
      maxValue={
        Math.max(...taskCounts) + 3 < 5 ? 5 : Math.max(...taskCounts) + 3
      }
      isAnimated
      animationDuration={300}
      onPress={(item: any, index: number) => {
        if (taskCounts[index] === 0) {
          // Optional: allow pressing 0 to see "0 tasks"
        }
        setPressedBarIndex(index === pressedBarIndex ? -1 : index);
      }}
    />
  );
});
BarChartView.displayName = 'BarChartView';

interface CalendarViewProps {
  markedDates?: { [date: string]: { marked: boolean; rate: number } };
  onMonthChange?: (month: Date) => void;
}

const CalendarView = React.memo(({ markedDates, onMonthChange }: CalendarViewProps) => {
  return (
    <Calendar
      style={{ borderRadius: 12, overflow: "hidden" }}
      theme={{
        backgroundColor: "#ffffff",
        calendarBackground: "#ffffff",
        textSectionTitleColor: "#b6c1cd",
        selectedDayBackgroundColor: "#8985e8",
        selectedDayTextColor: "#ffffff",
        todayTextColor: "#8985e8",
        dayTextColor: "#2d4150",
        textDisabledColor: "#d9e1e8",
        dotColor: "#8985e8",
        selectedDotColor: "#ffffff",
        arrowColor: "#8985e8",
        disabledArrowColor: "#d9e1e8",
        monthTextColor: "#1f2937",
        indicatorColor: "#8985e8",
        textDayFontWeight: "600",
        textMonthFontWeight: "700",
        textDayHeaderFontWeight: "600",
        textDayFontSize: 14,
        textMonthFontSize: 16,
        textDayHeaderFontSize: 12,
      }}
      renderArrow={(direction) =>
        direction === "left" ? (
          <View className="bg-gray-50 p-1 rounded-full">
            <Icon as={ChevronLeftIcon} size="sm" className="text-gray-600" />
          </View>
        ) : (
          <View className="bg-gray-50 p-1 rounded-full">
            <Icon as={ChevronRightIcon} size="sm" className="text-gray-600" />
          </View>
        )
      }
      markedDates={markedDates}
      dayComponent={({ date, marking, state }) => {
        if (!date) return null;
        const markedData = markedDates ? markedDates[date.dateString] : null;
        const isActuallyMarked = markedData ? markedData.marked : false;
        const actualPercent = markedData ? markedData.rate * 100 : 0;

        // Use actual data from markedDates prop to avoid inconsistency
        const finalIsMarked = isActuallyMarked;
        const finalPercent = actualPercent;

        return (
          <View className="items-center justify-center h-8 w-8">
            <ProgressCircle
              progressPercent={
                finalIsMarked ? (finalPercent === 0 ? 100 : finalPercent) : 0
              }
              displayText={date?.day?.toString() ?? ""}
              textColor={
                state === "disabled"
                  ? "#d1d5db"
                  : isActuallyMarked
                    ? "#8985e8"
                    : "#4b5563"
              }
            />
          </View>
        );
      }}
      onMonthChange={(month: any) => {
        onMonthChange && onMonthChange(new Date(month.dateString));
      }}
    />
  );
});
CalendarView.displayName = 'CalendarView';

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, [])
  );

  useScrollToTop(scrollViewRef);

  return (
    <View className="flex-1 bg-gray-50/50">
      <ScrollView
        ref={scrollViewRef}
        className="pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyChart />
        <MonthlyCalendar />
        <MoodChart />
      </ScrollView>
    </View>
  );
}
