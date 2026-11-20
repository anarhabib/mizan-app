import { ChevronDown, Check } from "lucide-react";
import { Select } from "radix-ui";
import type { Ref } from "react";

export function ProductSelect({
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
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger
        ref={ref}
        id={id}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive lg:min-h-9 [&>span]:truncate"
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border bg-popover text-sm text-popover-foreground"
        >
          <Select.Viewport className="p-2">
            {options.map(({ value, label }) => (
              <Select.Item
                key={value}
                value={value}
                className="relative flex min-h-11 cursor-default items-center rounded-md py-2 pr-9 pl-3 outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground lg:min-h-8"
              >
                <Select.ItemText>{label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3">
                  <Check className="size-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
