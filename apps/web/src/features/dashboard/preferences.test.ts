import { describe, expect, it } from "vitest";
import {
  allowedWidgets,
  defaultPreferences,
  moveWidget,
  preferenceKey,
  readPreferences,
  visibleWidgets,
} from "./preferences";

describe("dashboard preferences", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  const key = preferenceKey("owner", "org", "store");

  it("restores the visible order, market defaults and aged-stock threshold for one user and store", () => {
    const defaults = defaultPreferences();
    const order = moveWidget(defaults.order, allowedWidgets(true), "gold", -1);
    values.set(
      key,
      JSON.stringify({
        ...defaults,
        order,
        enabled: ["gold", "grossProfit"],
        purity: 585,
        period: "30d",
        unit: "azn",
        agedDays: 45,
      }),
    );
    const restored = readPreferences(storage, key);
    expect(restored).toMatchObject({
      order,
      purity: 585,
      period: "30d",
      unit: "azn",
      agedDays: 45,
    });
    expect(visibleWidgets(restored, true)).toEqual(["gold", "grossProfit"]);
    expect(visibleWidgets(restored, false)).toEqual(["gold"]);
    expect(
      readPreferences(storage, preferenceKey("other", "org", "store")),
    ).toEqual(defaults);
    expect(
      readPreferences(storage, preferenceKey("owner", "org", "other")),
    ).toEqual(defaults);
  });

  it("deduplicates historical layouts and recovers malformed preferences", () => {
    values.set(
      "malformed",
      JSON.stringify({
        order: ["payments", "payments", "unknown"],
        enabled: [],
        agedDays: 366,
        period: "invalid",
      }),
    );
    const restored = readPreferences(storage, "malformed");
    expect(restored.order[0]).toBe("payments");
    expect(restored.order.filter((id) => id === "payments")).toHaveLength(1);
    expect(restored).toMatchObject({ period: "7d", agedDays: 90 });
    expect(visibleWidgets(restored, true)).toEqual([]);
    expect(readPreferences({ getItem: () => "bad JSON" }, key)).toEqual(
      defaultPreferences(),
    );
  });
});
