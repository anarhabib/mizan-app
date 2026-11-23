import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import dashboard from "@/locales/az/dashboard.json";
import "@/shared/lib/i18n";
import { QuickActions } from "./components/QuickActions";
import {
  availableQuickActions,
  visibleQuickActionCount,
} from "./quick-actions";

describe("quick actions", () => {
  it("keeps sale first and limits gold pricing to owners", () => {
    expect(availableQuickActions(true).map(({ id }) => id)).toEqual([
      "sale",
      "product",
      "find",
      "customer",
      "debtors",
      "pricing",
    ]);
    expect(availableQuickActions(false).map(({ id }) => id)).toEqual([
      "sale",
      "product",
      "find",
      "customer",
      "debtors",
    ]);
  });

  it("fits all available actions without reserving room for an ellipsis", () => {
    expect(visibleQuickActionCount([120, 110, 140], 386, 8, 44)).toBe(3);
    expect(visibleQuickActionCount([120, 110, 140], 385, 8, 44)).toBe(2);
  });

  it("keeps overflow in priority order as container or localized label widths change", () => {
    expect(visibleQuickActionCount([120, 140, 80, 70], 320, 8, 44)).toBe(2);
    expect(visibleQuickActionCount([145, 150, 80, 70], 320, 8, 44)).toBe(1);
    expect(visibleQuickActionCount([145, 150, 80, 70], 363, 8, 44)).toBe(2);
    expect(visibleQuickActionCount([145, 150], 190, 8, 44)).toBe(0);
  });

  it("removes the ellipsis when the remaining permitted actions fit", () => {
    expect(
      visibleQuickActionCount([100, 90, 90, 90, 90, 130], 500, 8, 44),
    ).toBe(4);
    expect(visibleQuickActionCount([100, 90, 90, 90, 90], 500, 8, 44)).toBe(5);
  });

  it("labels the overflow trigger and keeps measurement copies out of navigation", () => {
    const html = renderToStaticMarkup(
      createElement(QuickActions, { owner: true }),
    );
    expect(html).toContain(`aria-label="${dashboard.moreActions}"`);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<a ");
  });
});
