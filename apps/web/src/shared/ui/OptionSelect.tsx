import type { Ref } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  describedBy,
  onBlur,
  ref,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        ref={ref}
        id={id}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="min-h-11 w-full min-w-0 rounded-md border-control-border bg-control px-3 text-left hover:border-control-hover-border lg:min-h-9 dark:bg-control dark:hover:border-foreground/40 dark:hover:bg-control"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={4}
        className="z-[60] min-w-(--radix-select-trigger-width) bg-popover before:content-none"
      >
        {options.map(({ value, label }) => (
          <SelectItem key={value} value={value} className="min-h-11 lg:min-h-8">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
