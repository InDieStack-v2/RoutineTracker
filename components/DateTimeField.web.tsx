import { createElement } from "react";
import { toLocalDateString } from "@/utils/dateUtils";
import { useIsDark } from "@/hooks/useIsDark";

type DateTimeFieldProps = {
  mode: "date" | "time";
  value: Date;
  onChange: (date: Date) => void;
};

export function DateTimeField({ mode, value, onChange }: DateTimeFieldProps) {
  const dark = useIsDark();
  const inputValue =
    mode === "date"
      ? toLocalDateString(value)
      : `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

  return createElement("input", {
    type: mode,
    value: inputValue,
    "aria-label": mode === "date" ? "Date" : "Time",
    onChange: (event: { target: { value: string } }) => {
      const raw = event.target.value;
      if (mode === "date") {
        const [year, month, day] = raw.split("-").map(Number);
        if (!year || !month || !day) {
          return;
        }
        onChange(new Date(year, month - 1, day));
        return;
      }

      const [hours, minutes] = raw.split(":").map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return;
      }
      const next = new Date(value);
      next.setHours(hours, minutes, 0, 0);
      onChange(next);
    },
    style: {
      border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 14,
      color: dark ? "#f9fafb" : "#111827",
      backgroundColor: dark ? "#1f2937" : "#f3f4f6",
      colorScheme: dark ? "dark" : "light",
    },
  });
}
