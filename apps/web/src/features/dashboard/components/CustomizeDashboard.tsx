import { useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductPanel } from "@/features/products";
import {
  allowedWidgets,
  defaultPreferences,
  moveWidget,
  type Preferences,
  type WidgetId,
} from "../preferences";
import { PeriodSelect, PuritySelect, UnitSelect } from "./MarketWidgets";

export function CustomizeDashboard({
  current,
  owner,
  purities,
  opener,
  close,
  save,
}: {
  current: Preferences;
  owner: boolean;
  purities: number[];
  opener: HTMLElement;
  close: () => void;
  save: (next: Preferences) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [draft, setDraft] = useState(current);
  const [days, setDays] = useState(String(current.agedDays));
  const allowed = allowedWidgets(owner);
  const order = draft.order.filter((id) => allowed.includes(id));
  const canSave = /^[1-9][0-9]{0,2}$/.test(days) && Number(days) <= 365;
  function move(id: WidgetId, direction: -1 | 1) {
    setDraft((previous) => ({
      ...previous,
      order: moveWidget(previous.order, allowed, id, direction),
    }));
  }
  return (
    <ProductPanel title={t("customize")} opener={opener} close={close}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) save({ ...draft, agedDays: Number(days) });
        }}
      >
        <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
          <div className="grid justify-items-start gap-2">
            <span className="text-sm font-medium">{t("period")}</span>
            <PeriodSelect
              period={draft.period}
              onChange={(period) => setDraft({ ...draft, period })}
            />
          </div>
          <div className="grid justify-items-start gap-2">
            <span className="text-sm font-medium">{t("unit")}</span>
            <UnitSelect
              unit={draft.unit}
              onChange={(unit) => setDraft({ ...draft, unit })}
            />
          </div>
          <div className="grid min-w-0 justify-items-start gap-2 [&_button]:max-w-full">
            <span className="text-sm font-medium">{t("purity")}</span>
            <PuritySelect
              purities={purities}
              purity={draft.purity}
              automatic
              onChange={(purity) => setDraft({ ...draft, purity })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-aged-days">{t("days")}</Label>
            <Input
              id="dashboard-aged-days"
              inputMode="numeric"
              maxLength={3}
              value={days}
              className="min-h-10 lg:min-h-8"
              onChange={(event) => setDays(event.currentTarget.value)}
              aria-invalid={!canSave}
              aria-describedby="dashboard-day-range"
            />
            {!canSave && (
              <p
                id="dashboard-day-range"
                className="text-xs text-danger-foreground"
              >
                {t("dayRange")}
              </p>
            )}
          </div>
        </div>
        <ul className="divide-y rounded-md border px-3">
          {order.map((id, index) => (
            <li key={id} className="flex min-h-11 items-center gap-1">
              <Label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 leading-snug">
                <Checkbox
                  checked={draft.enabled.includes(id)}
                  onCheckedChange={(checked) => {
                    setDraft((previous) => ({
                      ...previous,
                      enabled: checked
                        ? [...previous.enabled, id]
                        : previous.enabled.filter((item) => item !== id),
                    }));
                  }}
                />
                {t(`widgets.${id}`)}
              </Label>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-disabled={index === 0}
                className="min-h-10 min-w-10 aria-disabled:opacity-35 lg:min-h-8 lg:min-w-8"
                aria-label={t("moveUp", { name: t(`widgets.${id}`) })}
                onClick={() => move(id, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-disabled={index === order.length - 1}
                className="min-h-10 min-w-10 aria-disabled:opacity-35 lg:min-h-8 lg:min-w-8"
                aria-label={t("moveDown", { name: t(`widgets.${id}`) })}
                onClick={() => move(id, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-card py-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            onClick={() => {
              const defaults = defaultPreferences();
              setDraft(defaults);
              setDays(String(defaults.agedDays));
            }}
          >
            <RotateCcw aria-hidden="true" />
            {t("reset")}
          </Button>
          <Button type="submit" disabled={!canSave} className="min-h-10">
            {t("save")}
          </Button>
        </div>
      </form>
    </ProductPanel>
  );
}
