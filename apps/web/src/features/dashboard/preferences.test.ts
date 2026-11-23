import { describe, expect, it } from "vitest";
import { desktopColumns, packWidgets, widgetSpans } from "./layout";
import {
  defaultPreferences,
  groupWidgets,
  moveGroup,
  preferenceKey,
  readPreferences,
  showQuickActions,
  visibleWidgets,
  widgets,
} from "./preferences";

describe("dashboard preferences", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  const key = preferenceKey("owner", "org", "store");

  it("restores visibility, market defaults and aged-stock threshold for one user and store", () => {
    const defaults = defaultPreferences();
    values.set(
      key,
      JSON.stringify({
        ...defaults,
        order: ["gold", "grossProfit"],
        enabled: ["gold", "grossProfit"],
        purity: 585,
        period: "30d",
        unit: "azn",
        agedDays: 45,
      }),
    );
    const restored = readPreferences(storage, key);
    expect(restored).toMatchObject({
      purity: 585,
      period: "30d",
      unit: "azn",
      agedDays: 45,
    });
    expect(visibleWidgets(restored, true)).toEqual(["grossProfit", "gold"]);
    expect(visibleWidgets(restored, false)).toEqual(["gold"]);
    expect(
      readPreferences(storage, preferenceKey("other", "org", "store")),
    ).toEqual(defaults);
    expect(
      readPreferences(storage, preferenceKey("owner", "org", "other")),
    ).toEqual(defaults);
  });

  it("assigns every business widget to exactly one group in default section order", () => {
    const groups = groupWidgets(widgets);
    expect(groups).toEqual([
      { id: "operations", widgets: ["activity"] },
      {
        id: "sales",
        widgets: [
          "sales",
          "salesTrend",
          "grossProfit",
          "recentSales",
          "categories",
        ],
      },
      {
        id: "payments",
        widgets: [
          "payments",
          "paymentTrend",
          "debt",
          "paymentMethods",
          "settlement",
          "recentRepayments",
          "debtors",
        ],
      },
      {
        id: "inventory",
        widgets: [
          "inventory",
          "intake",
          "intakeCost",
          "inventoryCost",
          "agedStock",
          "distribution",
          "recentIntake",
          "recentTradeIns",
        ],
      },
      { id: "market", widgets: ["gold", "exchange", "storeRates"] },
    ]);
  });

  it("preserves individual selections when a hidden group is saved and restored", () => {
    values.set(
      key,
      JSON.stringify({
        ...defaultPreferences(),
        enabled: ["payments", "inventory", "debtors"],
        hiddenGroups: ["payments", "unknown", "payments"],
      }),
    );
    const hidden = readPreferences(storage, key);
    const sections = (preferences: typeof hidden) =>
      groupWidgets(visibleWidgets(preferences, true));
    expect(hidden.hiddenGroups).toEqual(["payments"]);
    expect(hidden.enabled).toEqual(["payments", "inventory", "debtors"]);
    expect(sections(hidden)).toEqual([
      { id: "inventory", widgets: ["inventory"] },
    ]);
    expect(sections({ ...hidden, hiddenGroups: [] })).toEqual([
      { id: "payments", widgets: ["payments", "debtors"] },
      { id: "inventory", widgets: ["inventory"] },
    ]);
  });

  it("suppresses empty groups, including groups containing only restricted widgets", () => {
    const preferences = {
      ...defaultPreferences(),
      enabled: ["grossProfit", "intakeCost", "inventoryCost"] as const,
    };
    const saved = { ...preferences, enabled: [...preferences.enabled] };
    expect(groupWidgets(visibleWidgets(saved, true))).toEqual([
      { id: "sales", widgets: ["grossProfit"] },
      { id: "inventory", widgets: ["intakeCost", "inventoryCost"] },
    ]);
    expect(groupWidgets(visibleWidgets(saved, false))).toEqual([]);
  });

  it("retains legacy visibility and places widgets in business priority order", () => {
    values.set(
      key,
      JSON.stringify({
        order: [
          "exchange",
          "payments",
          "salesTrend",
          "gold",
          "sales",
          "actions",
        ],
        enabled: [
          "exchange",
          "payments",
          "salesTrend",
          "gold",
          "sales",
          "actions",
        ],
      }),
    );
    const legacy = readPreferences(storage, key);
    expect(legacy.hiddenGroups).toEqual(defaultPreferences().hiddenGroups);
    expect(legacy.groupOrder).toEqual(defaultPreferences().groupOrder);
    expect(legacy.enabled).toEqual([
      "exchange",
      "payments",
      "salesTrend",
      "gold",
      "sales",
      "actions",
    ]);
    expect(legacy).not.toHaveProperty("order");
    expect(groupWidgets(visibleWidgets(legacy, true))).toEqual([
      { id: "sales", widgets: ["sales", "salesTrend"] },
      { id: "payments", widgets: ["payments"] },
      { id: "market", widgets: ["gold", "exchange"] },
    ]);
  });

  it("deduplicates historical layouts and recovers malformed preferences", () => {
    values.set(
      "malformed",
      JSON.stringify({
        order: ["payments", "payments", "unknown"],
        enabled: ["payments", "payments", "unknown"],
        agedDays: 366,
        period: "invalid",
      }),
    );
    const restored = readPreferences(storage, "malformed");
    expect(restored.enabled).toEqual(["payments"]);
    expect(restored).toMatchObject({ period: "7d", agedDays: 90 });
    expect(visibleWidgets(restored, true)).toEqual(["payments"]);
    expect(readPreferences({ getItem: () => "bad JSON" }, key)).toEqual(
      defaultPreferences(),
    );
  });

  it("migrates a count-only sales chart and remembers its selected metric", () => {
    values.set(
      key,
      JSON.stringify({
        order: ["salesTrend", "debt", "salesCount", "gold"],
        enabled: ["debt", "salesCount", "gold"],
      }),
    );
    const restored = readPreferences(storage, key);
    expect(visibleWidgets(restored, true)).toEqual([
      "salesTrend",
      "debt",
      "gold",
    ]);
    expect(restored.salesMetric).toBe("count");
    values.set(key, JSON.stringify({ ...restored, salesMetric: "sales" }));
    expect(readPreferences(storage, key).salesMetric).toBe("sales");
  });

  it("keeps the quick actions preference separate from business groups", () => {
    const legacy = readPreferences(
      {
        getItem: () =>
          JSON.stringify({
            enabled: ["actions"],
            hiddenGroups: ["operations"],
          }),
      },
      key,
    );
    expect(showQuickActions(legacy)).toBe(true);
    expect(groupWidgets(visibleWidgets(legacy, true))).toEqual([]);
    expect(showQuickActions({ ...legacy, enabled: ["activity"] })).toBe(false);
  });

  it("persists group moves independently of visibility and restores default ordering on reset", () => {
    const defaults = defaultPreferences();
    const order = moveGroup(defaults.groupOrder, "inventory", -1);
    expect(moveGroup(order, "operations", -1)).toBe(order);
    expect(moveGroup(order, "market", 1)).toBe(order);
    const preferences = {
      ...defaults,
      groupOrder: order,
      hiddenGroups: ["inventory"],
      enabled: ["actions", "intake", "grossProfit", "sales", "debt"],
    };
    values.set(key, JSON.stringify(preferences));
    const saved = readPreferences(storage, key);
    expect(saved).toEqual(preferences);
    expect(
      groupWidgets(visibleWidgets(saved, false), saved.groupOrder),
    ).toEqual([
      { id: "sales", widgets: ["sales"] },
      { id: "payments", widgets: ["debt"] },
    ]);
    const restored = { ...saved, hiddenGroups: [] };
    expect(
      groupWidgets(visibleWidgets(restored, true), restored.groupOrder),
    ).toEqual([
      { id: "sales", widgets: ["sales", "grossProfit"] },
      { id: "inventory", widgets: ["intake"] },
      { id: "payments", widgets: ["debt"] },
    ]);
    expect(defaultPreferences().groupOrder).toEqual([
      "operations",
      "sales",
      "payments",
      "inventory",
      "market",
    ]);
  });

  it("retains known saved group order and appends missing or new groups once", () => {
    values.set(
      key,
      JSON.stringify({
        groupOrder: ["market", "unknown", "sales", "market"],
        enabled: ["exchange", "sales"],
      }),
    );
    const restored = readPreferences(storage, key);
    expect(restored.groupOrder).toEqual([
      "market",
      "sales",
      "operations",
      "payments",
      "inventory",
    ]);
  });
});

describe("dashboard layout", () => {
  it("balances a pair of standard summaries while keeping compact widgets narrow", () => {
    expect(desktopColumns(["inventory", "intake"])).toBe(2);
    expect(desktopColumns(["payments", "debt"])).toBe(2);
    expect(desktopColumns(["grossProfit", "recentSales"])).toBe(3);
    expect(desktopColumns(["sales", "salesTrend"])).toBe(3);
  });

  it("keeps recent sales narrow, gives charts more space and puts complex tables across columns", () => {
    expect(widgetSpans(["recentSales"], 3)).toEqual([1]);
    expect(widgetSpans(["exchange"], 2)).toEqual([1]);
    expect(
      widgetSpans(["recentSales", "salesTrend", "grossProfit"], 3),
    ).toEqual([1, 2, 1]);
    expect(widgetSpans(["gold", "exchange", "storeRates"], 3)).toEqual([
      2, 1, 3,
    ]);
    expect(widgetSpans(["inventory", "intake", "intakeCost"], 3)).toEqual([
      1, 1, 1,
    ]);
  });

  it("pairs charts beside single-column neighbors only when the container has room", () => {
    expect(
      widgetSpans(["recentSales", "salesTrend", "grossProfit"], 2),
    ).toEqual([1, 2, 1]);
    expect(
      widgetSpans(["recentSales", "salesTrend", "grossProfit"], 2, true),
    ).toEqual([1, 1, 1]);
    expect(widgetSpans(["gold", "exchange", "storeRates"], 2, true)).toEqual([
      1, 1, 2,
    ]);
    expect(widgetSpans(["paymentTrend", "payments", "debt"], 2, true)).toEqual([
      2, 1, 1,
    ]);
    expect(widgetSpans(["payments", "paymentTrend", "debt"], 2, true)).toEqual([
      1, 1, 1,
    ]);
    expect(
      widgetSpans(["sales", "grossProfit", "salesTrend"], 2, true),
    ).toEqual([1, 1, 2]);
    expect(widgetSpans(["exchange", "storeRates"], 2, true)).toEqual([1, 2]);
  });

  it("packs below a short widget without reordering a later card or stretching a tall card", () => {
    expect(
      packWidgets(
        [
          { span: 1, height: 250 },
          { span: 1, height: 70 },
          { span: 1, height: 46 },
          { span: 1, height: 33 },
        ],
        2,
        12,
      ),
    ).toEqual([
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 2, top: 82 },
      { column: 2, top: 140 },
    ]);
  });

  it("uses the first available position when a later card fits just below the preceding card's top", () => {
    expect(
      packWidgets(
        [
          { span: 1, height: 101 },
          { span: 1, height: 100 },
          { span: 1, height: 20 },
          { span: 1, height: 40 },
        ],
        2,
        12,
      ),
    ).toEqual([
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 2, top: 112 },
      { column: 1, top: 113 },
    ]);
  });

  it("keeps a later card below a delayed wide chart even if an earlier column has space", () => {
    expect(
      packWidgets(
        [
          { span: 1, height: 190 },
          { span: 1, height: 100 },
          { span: 1, height: 240 },
          { span: 2, height: 100 },
          { span: 1, height: 45 },
        ],
        3,
        12,
      ),
    ).toEqual([
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 3, top: 0 },
      { column: 1, top: 202 },
      { column: 3, top: 252 },
    ]);
  });
});
