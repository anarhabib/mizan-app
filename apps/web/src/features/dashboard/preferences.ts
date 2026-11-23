import { marketPeriods, type MarketPeriod } from "@mizan/contracts";

const widgetGroups = {
  operations: ["activity"],
  sales: ["sales", "salesTrend", "grossProfit", "recentSales", "categories"],
  payments: [
    "payments",
    "paymentTrend",
    "debt",
    "paymentMethods",
    "settlement",
    "recentRepayments",
    "debtors",
  ],
  inventory: [
    "inventory",
    "intake",
    "intakeCost",
    "inventoryCost",
    "agedStock",
    "distribution",
    "recentIntake",
    "recentTradeIns",
  ],
  market: ["gold", "exchange", "storeRates"],
} as const;

export type WidgetGroupId = keyof typeof widgetGroups;
export type BusinessWidgetId = (typeof widgetGroups)[WidgetGroupId][number];
export type WidgetId = BusinessWidgetId | "actions";
const defaultGroupOrder = Object.keys(widgetGroups) as WidgetGroupId[];
export const widgets: readonly WidgetId[] = [
  "actions",
  ...defaultGroupOrder.flatMap((group) => [...widgetGroups[group]]),
];

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
  "salesTrend",
  "storeRates",
  "activity",
];
export type ChartUnit = "usd" | "azn";
export type Preferences = {
  enabled: WidgetId[];
  hiddenGroups: WidgetGroupId[];
  groupOrder: WidgetGroupId[];
  period: MarketPeriod;
  purity: number | null;
  unit: ChartUnit;
  agedDays: number;
  salesMetric: "sales" | "count";
};

export function defaultPreferences(): Preferences {
  return {
    enabled: [...defaultWidgets],
    hiddenGroups: [],
    groupOrder: [...defaultGroupOrder],
    period: "7d",
    purity: null,
    unit: "usd",
    agedDays: 90,
    salesMetric: "sales",
  };
}

export function allowedWidgets(owner: boolean) {
  return widgets.filter(
    (id) => owner || !ownerWidgets.some((item) => item === id),
  );
}

export function visibleWidgets(preferences: Preferences, owner: boolean) {
  const enabled = allowedWidgets(owner).filter((id) =>
    preferences.enabled.includes(id),
  );
  return groupWidgets(
    enabled,
    defaultGroupOrder.filter((id) => !preferences.hiddenGroups.includes(id)),
  ).flatMap((group) => group.widgets);
}

export function showQuickActions(preferences: Preferences) {
  return preferences.enabled.includes("actions");
}

export function groupWidgets(
  widgetIds: readonly WidgetId[],
  groupOrder: readonly WidgetGroupId[] = defaultGroupOrder,
) {
  const included = new Set(widgetIds);
  return groupOrder
    .map((id) => ({
      id,
      widgets: widgetGroups[id].filter((widget) => included.has(widget)),
    }))
    .filter(({ widgets }) => widgets.length > 0);
}

export function moveGroup(
  order: WidgetGroupId[],
  id: WidgetGroupId,
  step: -1 | 1,
) {
  const index = order.indexOf(id);
  const next = order[index + step];
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
      value
        .map((item) => (item === "salesCount" ? "salesTrend" : item))
        .filter((item): item is WidgetId => widgets.includes(item)),
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
    const legacyEnabled: unknown[] = Array.isArray(saved.enabled)
      ? saved.enabled
      : [];
    const countOnly =
      legacyEnabled.includes("salesCount") &&
      !legacyEnabled.includes("salesTrend");
    const savedGroups = Array.isArray(saved.groupOrder)
      ? saved.groupOrder.filter((id) => defaultGroupOrder.includes(id))
      : [];
    return {
      enabled: widgetList(saved.enabled) ?? defaults.enabled,
      hiddenGroups: Array.isArray(saved.hiddenGroups)
        ? defaultGroupOrder.filter((id) => saved.hiddenGroups?.includes(id))
        : defaults.hiddenGroups,
      groupOrder: [...new Set([...savedGroups, ...defaultGroupOrder])],
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
      salesMetric:
        saved.salesMetric === "count" || countOnly ? "count" : "sales",
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
