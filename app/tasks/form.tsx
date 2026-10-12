import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useLayoutEffect } from "react";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { CheckIcon, ArrowLeftIcon } from "lucide-react-native";
import { useForm, Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { Grid, GridItem } from "@/components/ui/grid";
import { useCandyContext } from "@/store/context";
import i18n from "@/i18n";
import { WEEKDAY_KEYS } from "@/utils/dateUtils";

const COLORS = [
  "#FFFFCD",
  "#FFCD9A",
  "#AA959A",
  "#C7A5A3",
  "#FF9799",

  "#FFCBCB",
  "#FF9BCD",
  "#FFCFFF",
  "#CC9AFD",
  "#CCCEFD",

  "#9CCDFE",
  "#99C7C5",
  "#CDFFFE",
  "#CDFFCC",
  "#5be2f7",
];

const RANDOM_EMOJIS = [
  "☂️",
  "🎓",
  "💼",
  "🧳",
  "👑",
  "🏄🏻‍♂️",
  "🐓",
  "🏯",
  "💳",
  "💞",
  "🫎",
  "🩻",
  "🗓",
  "💎",
  "🗑",
  "❤️‍🔥",
  "🫅",
  "⚒",
  "💻",
  "⌚️",
];

const ColorInput = React.memo(({ control }: { control: any; errors: any }) => {
  return (
    <Controller
      control={control}
      name="color"
      render={({ field: { onChange, value } }) => (
        <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
          <Heading size="md" className="mb-4 text-gray-800">
            {i18n.t('color')}
          </Heading>
          <Grid
            _extra={{
              className: "grid-cols-5",
            }}
            gap={4}
            className="gap-4"
          >
            {COLORS.map((c) => (
              <GridItem key={c} _extra={{ className: "" }}>
                <Pressable
                  key={c}
                  onPress={() => {
                    onChange(c);
                  }}
                  style={{ backgroundColor: c }}
                  className="w-12 h-12 rounded-full justify-center items-center shadow-sm border border-gray-100"
                >
                  {value === c && (
                    <Icon as={CheckIcon} className="w-6 h-6 text-gray-700" />
                  )}
                </Pressable>
              </GridItem>
            ))}
          </Grid>
        </Box>
      )}
    />
  );
});
ColorInput.displayName = "ColorInput";

const DoItAtInput = React.memo(({ control }: { control: any; errors: any }) => {
  const options = ["morning", "afternoon", "evening"];

  const DoItAtView = ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (value: string | null) => void;
  }) => {
    return (
      <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
        <Heading size="md" className="mb-4 text-gray-800">
          {i18n.t('do_it_at')}
        </Heading>
        <HStack className="gap-3">
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              className={`flex-1 py-3 px-2 rounded-xl items-center justify-center border ${
                value === option
                  ? "bg-[#8882e7] border-[#8882e7]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-semibold capitalize ${
                  value === option ? "text-white" : "text-gray-600"
                }`}
              >
                {i18n.t(option)}
              </Text>
            </Pressable>
          ))}
        </HStack>
      </Box>
    );
  };

  return (
    <Controller
      control={control}
      name="doItAt"
      render={({ field: { onChange, value } }) => (
        <DoItAtView value={value} onChange={onChange} />
      )}
    />
  );
});
DoItAtInput.displayName = "DoItAtInput";

type TaskFormValues = {
  name: string;
  color?: string;
  icon?: string;
  doItAt?: string;
  repeat: "daily" | "weekly" | "monthly";
  repeatValues: string[];
};

const RepeatInput = React.memo(({
  control,
  setValue,
}: {
  control: Control<TaskFormValues>;
  setValue: UseFormSetValue<TaskFormValues>;
}) => {
  const options = ["daily", "weekly", "monthly"];

  const RepeatOptionView = ({
    repeatType,
    onChange,
  }: {
    repeatType: string;
    onChange: (value: string) => void;
  }) => {
    return (
      <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
        <Heading size="md" className="mb-4 text-gray-800">
          {i18n.t('repeat')}
        </Heading>
        <HStack className="gap-3">
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                if (option === repeatType) return;
                onChange(option);
                const today = new Date();
                if (option === "weekly") {
                  setValue("repeatValues", [WEEKDAY_KEYS[today.getDay()]]);
                } else if (option === "monthly") {
                  setValue("repeatValues", [String(today.getDate())]);
                } else {
                  setValue("repeatValues", [...WEEKDAY_KEYS]);
                }
              }}
              className={`flex-1 py-3 px-2 rounded-xl items-center justify-center border ${
                repeatType === option
                  ? "bg-[#8882e7] border-[#8882e7]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-semibold capitalize ${
                  repeatType === option ? "text-white" : "text-gray-600"
                }`}
              >
                {i18n.t(option)}
              </Text>
            </Pressable>
          ))}
        </HStack>
      </Box>
    );
  };

  const RepeatValuesView = ({
    repeatValues,
    onChange,
  }: {
    repeatValues: string[];
    onChange: (values: string[]) => void;
  }) => {
    const allDay = repeatValues.length === 7;
    return (
      <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Heading size="md" className="text-gray-800">
            {i18n.t('on_these_days')}
          </Heading>
          <Pressable
            className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200"
            onPress={() => {
              if (allDay) {
                onChange([]);
              } else {
                onChange(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
              }
            }}
          >
            <Text className="text-xs font-semibold text-gray-600 mr-2">
              {i18n.t('all_day')}
            </Text>
            <View
              className={`w-4 h-4 rounded-full border items-center justify-center ${
                allDay ? "bg-[#8882e7] border-[#8882e7]" : "border-gray-400"
              }`}
            >
              {allDay && <Icon as={CheckIcon} className="text-white w-3 h-3" />}
            </View>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Pressable
              key={day}
              onPress={() => {
                let newValues = [...repeatValues];
                if (newValues.includes(day)) {
                  newValues = newValues.filter((d) => d !== day);
                } else {
                  newValues.push(day);
                }
                onChange(newValues);
              }}
              className={`items-center justify-center rounded-xl w-10 h-12 border ${
                allDay || repeatValues.includes(day)
                  ? "bg-[#8882e7] border-[#8882e7]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Text
                className={`font-semibold text-sm ${
                  allDay || repeatValues.includes(day)
                    ? "text-white"
                    : "text-gray-500"
                }`}
              >
                {i18n.t(day.toLowerCase())}
              </Text>
            </Pressable>
          ))}
        </View>
      </Box>
    );
  };

  const MonthDaysView = ({
    repeatValues,
    onChange,
  }: {
    repeatValues: string[];
    onChange: (values: string[]) => void;
  }) => {
    return (
      <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <Heading size="md" className="mb-4 text-gray-800">
          {i18n.t("on_these_days")}
        </Heading>
        <View className="flex-row flex-wrap">
          {Array.from({ length: 31 }, (_, index) => {
            const day = String(index + 1);
            const selected = repeatValues.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(
                    selected
                      ? repeatValues.filter((value) => value !== day)
                      : [...repeatValues, day],
                  );
                }}
                className="items-center justify-center"
                style={{ width: "14.28%", height: 40 }}
              >
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full border ${
                    selected
                      ? "bg-[#8882e7] border-[#8882e7]"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Box>
    );
  };

  return (
    <>
      <Controller
        control={control}
        name="repeat"
        render={({ field: { onChange, value } }) => (
          <RepeatOptionView repeatType={value} onChange={onChange} />
        )}
      />
      <Controller
        control={control}
        name="repeat"
        render={({ field: { value: repeatValue } }) =>
          repeatValue === "monthly" ? (
            <Controller
              control={control}
              name="repeatValues"
              render={({ field: { onChange, value } }) => (
                <MonthDaysView repeatValues={value ?? []} onChange={onChange} />
              )}
            />
          ) : (
            <Controller
              control={control}
              name="repeatValues"
              render={({ field: { onChange, value } }) => (
                <RepeatValuesView repeatValues={value ?? []} onChange={onChange} />
              )}
            />
          )
        }
      />
    </>
  );
});
RepeatInput.displayName = "RepeatInput";

const IconInput = React.memo(
  ({ control, errors }: { control: any; errors: any }) => {
    return (
      <Controller
        control={control}
        rules={{ required: false }}
        name="icon"
        render={({ field: { onChange, value } }) => (
          <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
            <Heading size="md" className="mb-2 text-gray-800">
              {i18n.t('icon')}
            </Heading>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-3 my-2">
                {RANDOM_EMOJIS.map((e, index) => (
                  <Pressable
                    key={e + index}
                    onPress={() => {
                      onChange(e);
                    }}
                    className={`items-center justify-center rounded-xl w-12 h-12 border ${
                      value === e
                        ? "bg-[#8882e7]/10 border-[#8882e7]"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <Text className="text-2xl">{e}</Text>
                  </Pressable>
                ))}
              </HStack>
            </ScrollView>
            {errors.icon && (
              <Text className="text-red-500 mt-1 text-xs">
                {errors.icon.message}
              </Text>
            )}
          </Box>
        )}
      />
    );
  },
);
IconInput.displayName = "IconInput";

const Page = () => {
  const navigation = useNavigation();
  const addRoutineTask = useCandyContext((state) => state.addRoutineTask);
  const updateRoutineTask = useCandyContext((state) => state.updateRoutineTask);

  const { id } = useLocalSearchParams();
  const isEdit = !!id;

  const getRoutineTask = useCandyContext((state) => state.getRoutineTask);
  const routineTask = isEdit ? getRoutineTask(id as string) : null;

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    defaultValues: {
      name: routineTask ? routineTask.label : "",
      color: routineTask ? routineTask.color : "",
      icon: routineTask ? routineTask.icon : "",
      doItAt: routineTask ? routineTask.doItAt : "",
      repeat: routineTask
        ? routineTask.repeat
          ? routineTask.repeat
          : "daily"
        : "daily",
      repeatValues: routineTask
        ? routineTask.repeatValues
          ? routineTask.repeatValues
          : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <View className="flex-1 bg-gray-50/50">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-white border-b border-gray-100 flex-row items-center justify-between shadow-sm z-10">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 active:bg-gray-100"
        >
          <Icon as={ArrowLeftIcon} className="text-gray-800 w-6 h-6" />
        </TouchableOpacity>
        <Heading size="lg" className="text-gray-800 font-bold">
          {isEdit ? i18n.t('edit_task') : i18n.t('new_task')}
        </Heading>
        <View className="w-10" /> 
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <VStack className="gap-2 p-4">
          <Controller
            control={control}
            name="name"
            rules={{ required: i18n.t('task_name_required') }}
            render={({ field: { onChange, value } }) => (
              <Box className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
                <Heading size="md" className="mb-3 text-gray-800">
                  {i18n.t('task_name')}
                </Heading>
                <Input className="bg-gray-50 border border-gray-200 h-12 rounded-xl">
                  <InputField
                    value={value}
                    onChangeText={onChange}
                    placeholder={i18n.t('task_name_placeholder')}
                    className="font-medium text-gray-800 text-sm"
                    placeholderTextColor="#9ca3af"
                  />
                </Input>
                {errors.name && (
                  <Text className="text-red-500 mt-2 text-xs">
                    {errors.name.message}
                  </Text>
                )}
              </Box>
            )}
          />
          <IconInput control={control} errors={errors} />
          <ColorInput control={control} errors={errors} />
          <RepeatInput control={control} setValue={setValue} />
          <DoItAtInput control={control} errors={errors} />

          <Button
            className="h-14 rounded-full bg-[#8882e7] shadow-lg shadow-indigo-200 mt-4 active:bg-[#7069d6]"
            onPress={() => {
              handleSubmit((data) => {
                if (isEdit) {
                  updateRoutineTask(id as string, {
                    label: data.name,
                    color: data.color,
                    icon: data.icon,
                    doItAt: data.doItAt as "morning" | "afternoon" | "evening",
                    repeat: data.repeat as "daily" | "weekly" | "monthly",
                    repeatValues: data.repeatValues,
                    updatedAt: new Date(),
                  });
                } else {
                  addRoutineTask({
                    id: String(Date.now()),
                    label: data.name,
                    color: data.color,
                    isFavorite: false,
                    icon: data.icon,
                    doItAt: data.doItAt as "morning" | "afternoon" | "evening",
                    repeat: data.repeat as "daily" | "weekly" | "monthly",
                    repeatValues: data.repeatValues,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                  });
                }
                navigation.goBack();
              })();
            }}
          >
            <ButtonText className="font-bold text-lg">
              {isEdit ? i18n.t('update_task') : i18n.t('create_task')}
            </ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </View>
  );
};

export default Page;