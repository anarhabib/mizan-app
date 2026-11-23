import { marketPeriods, type MarketPeriod } from "@mizan/contracts";

export const widgets = [
  "actions",
  "gold",
  "exchange",
  "sales",
  "payments",
  "debt",
  "inventory",
  "intake",
  "storeRates",
  "grossProfit",
  "intakeCost",
  "inventoryCost",
  "agedStock",
  "salesTrend",
  "salesCount",
  "paymentTrend",
  "categories",
  "paymentMethods",
  "distribution",
  "settlement",
  "activity",
  "recentSales",
  "recentIntake",
  "recentTradeIns",
  "recentRepayments",
  "debtors",
] as const;

export type WidgetId = (typeof widgets)[number];
export const ownerWidgets = [
  "grossProfit",
  "intakeCost",
  "inventoryCost",
] satisfies WidgetId[];
const defaultWidgets: WidgetId[] = [
  "actions",
  "gold",
  "exchange",
  "sales",
  "payments",
  "debt",
  "inventory",
  "intake",
  "grossProfit",
  "storeRates",
  "activity",
];
export type ChartUnit = "usd" | "azn";
export type Preferences = {
  order: WidgetId[];
  enabled: WidgetId[];
  period: MarketPeriod;
  purity: number | null;
  unit: ChartUnit;
  agedDays: number;
};

export function defaultPreferences(): Preferences {
  return {
    order: [...widgets],
    enabled: [...defaultWidgets],
    period: "7d",
    purity: null,
    unit: "usd",
    agedDays: 90,
  };
}

export function allowedWidgets(owner: boolean) {
  return widgets.filter(
    (id) => owner || !ownerWidgets.some((item) => item === id),
  );
}

export function visibleWidgets(preferences: Preferences, owner: boolean) {
  const allowed = new Set(allowedWidgets(owner));
  return preferences.order.filter(
    (id) => allowed.has(id) && preferences.enabled.includes(id),
  );
}

export function moveWidget(
  order: WidgetId[],
  allowed: WidgetId[],
  id: WidgetId,
  step: -1 | 1,
) {
  const visibleOrder = order.filter((item) => allowed.includes(item));
  const index = visibleOrder.indexOf(id);
  const next = visibleOrder[index + step];
  if (!next || index < 0) return order;
  return order.map((item) => (item === id ? next : item === next ? id : item));
}

export function preferenceKey(
  userId: string,
  organizationId: string,
  storeId: string,
) {
  return `mizan:dashboard:v1:${userId}:${organizationId}:${storeId}`;
}

function widgetList(value: unknown): WidgetId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [
    ...new Set(
      value.filter((item): item is WidgetId => widgets.includes(item)),
    ),
  ];
}

export function readPreferences(
  storage: Pick<Storage, "getItem">,
  key: string,
): Preferences {
  const defaults = defaultPreferences();
  try {
    const saved = JSON.parse(
      storage.getItem(key) ?? "null",
    ) as Partial<Preferences> | null;
    if (!saved) return defaults;
    const order = widgetList(saved.order) ?? defaults.order;
    return {
      order: [...order, ...widgets.filter((id) => !order.includes(id))],
      enabled: widgetList(saved.enabled) ?? defaults.enabled,
      period:
        marketPeriods.find((period) => period === saved.period) ??
        defaults.period,
      purity:
        typeof saved.purity === "number" &&
        Number.isInteger(saved.purity) &&
        saved.purity >= 1 &&
        saved.purity <= 999
          ? saved.purity
          : defaults.purity,
      unit: saved.unit === "azn" ? "azn" : "usd",
      agedDays:
        typeof saved.agedDays === "number" &&
        Number.isInteger(saved.agedDays) &&
        saved.agedDays >= 1 &&
        saved.agedDays <= 365
          ? saved.agedDays
          : defaults.agedDays,
    };
  } catch {
    return defaults;
  }
}
