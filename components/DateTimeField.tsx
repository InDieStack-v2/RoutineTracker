import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

type DateTimeFieldProps = {
  mode: "date" | "time";
  value: Date;
  onChange: (date: Date) => void;
};

export function DateTimeField({ mode, value, onChange }: DateTimeFieldProps) {
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed" || !date) {
      return;
    }
    onChange(date);
  };

  return (
    <DateTimePicker
      testID="dateTimePicker"
      value={value}
      mode={mode}
      is24Hour
      onChange={handleChange}
    />
  );
}
