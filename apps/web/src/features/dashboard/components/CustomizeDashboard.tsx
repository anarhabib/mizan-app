import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductPanel } from "@/features/products";
import {
  allowedWidgets,
  defaultPreferences,
  groupWidgets,
  moveGroup,
  showQuickActions,
  type Preferences,
  type WidgetGroupId,
} from "../preferences";
import { PeriodSelect, PuritySelect, UnitSelect } from "./MarketWidgets";

export function CustomizeDashboard({
  current,
  owner,
  purities,
  opener,
  close,
  previewGroupOrder,
  save,
}: {
  current: Preferences;
  owner: boolean;
  purities: number[];
  opener: HTMLElement;
  close: () => void;
  previewGroupOrder: (order: WidgetGroupId[]) => void;
  save: (next: Preferences) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [draft, setDraft] = useState(current);
  const [days, setDays] = useState(String(current.agedDays));
  const [expanded, setExpanded] = useState<WidgetGroupId[]>([]);
  const groups = groupWidgets(allowedWidgets(owner), draft.groupOrder);
  const canSave = /^[1-9][0-9]{0,2}$/.test(days) && Number(days) <= 365;
  function changeGroupOrder(id: WidgetGroupId, direction: -1 | 1) {
    const groupOrder = moveGroup(draft.groupOrder, id, direction);
    if (groupOrder === draft.groupOrder) return;
    setDraft({ ...draft, groupOrder });
    previewGroupOrder(groupOrder);
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
        <Label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3">
          <Checkbox
            checked={showQuickActions(draft)}
            onCheckedChange={(checked) =>
              setDraft((previous) => ({
                ...previous,
                enabled:
                  checked === true
                    ? [...previous.enabled, "actions"]
                    : previous.enabled.filter((id) => id !== "actions"),
              }))
            }
          />
          {t("widgets.actions")}
        </Label>
        <ul className="divide-y rounded-md border">
          {groups.map(({ id: group, widgets }, index) => {
            const name = t(`groups.${group}`);
            const panelId = `dashboard-customize-${group}`;
            const open = expanded.includes(group);
            return (
              <li key={group}>
                <div className="flex items-center gap-2 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-10 min-w-0 flex-1 justify-start whitespace-normal px-2 text-left wrap-anywhere"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() =>
                      setExpanded((previous) =>
                        open
                          ? previous.filter((id) => id !== group)
                          : [...previous, group],
                      )
                    }
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={open ? "rotate-180" : undefined}
                    />
                    {name}
                  </Button>
                  <Label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 px-2">
                    <Checkbox
                      aria-label={t("showGroup", { name })}
                      checked={!draft.hiddenGroups.includes(group)}
                      onCheckedChange={(checked) =>
                        setDraft((previous) => ({
                          ...previous,
                          hiddenGroups:
                            checked === true
                              ? previous.hiddenGroups.filter(
                                  (id) => id !== group,
                                )
                              : [...previous.hiddenGroups, group],
                        }))
                      }
                    />
                    {t("showGroupShort")}
                  </Label>
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-disabled={index === 0}
                      className="min-h-10 min-w-10 aria-disabled:opacity-35 lg:min-h-8 lg:min-w-8"
                      aria-label={t("moveGroupUp", { name })}
                      onClick={() => changeGroupOrder(group, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-disabled={index === groups.length - 1}
                      className="min-h-10 min-w-10 aria-disabled:opacity-35 lg:min-h-8 lg:min-w-8"
                      aria-label={t("moveGroupDown", { name })}
                      onClick={() => changeGroupOrder(group, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <ul
                  id={panelId}
                  hidden={!open}
                  aria-label={name}
                  className="divide-y border-t px-3"
                >
                  {open &&
                    widgets.map((id) => (
                      <li key={id}>
                        <Label className="flex min-h-11 cursor-pointer items-center gap-2 py-2 leading-snug wrap-anywhere">
                          <Checkbox
                            checked={draft.enabled.includes(id)}
                            onCheckedChange={(checked) =>
                              setDraft((previous) => ({
                                ...previous,
                                enabled: checked
                                  ? [...previous.enabled, id]
                                  : previous.enabled.filter(
                                      (item) => item !== id,
                                    ),
                              }))
                            }
                          />
                          {t(`widgets.${id}`)}
                        </Label>
                      </li>
                    ))}
                </ul>
              </li>
            );
          })}
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
              previewGroupOrder(defaults.groupOrder);
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
