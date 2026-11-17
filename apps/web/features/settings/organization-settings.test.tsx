import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { OrganizationSettingsForm } from "./organization-settings-form";
import { PurityRateManager } from "./purity-rate-manager";

vi.mock("./settings-actions", () => ({ updateSettings: vi.fn() }));

test("shows the organization currency and the saved cost visibility setting", () => {
  const html = renderToStaticMarkup(
    <OrganizationSettingsForm
      organizationId="test"
      locale="en"
      settings={{
        defaultCurrency: "USD",
        salespersonCanViewAcquisitionCost: true,
      }}
    />,
  );
  expect(html).toContain("Default currency");
  expect(html).toContain("USD");
  expect(html).toContain('name="salespersonCanViewAcquisitionCost" checked=""');
});

test("excludes inactive grades from rate entry and keeps their history visible", () => {
  const html = renderToStaticMarkup(
    <PurityRateManager
      organizationId="test"
      locale="az"
      defaultCurrency="AZN"
      purities={[
        { value: 585, active: true },
        { value: 610, active: false },
      ]}
      rates={[
        {
          id: "old",
          purity: 610,
          currency: "USD",
          amountPerGram: "32.7901",
          effectiveAt: "2026-11-18T00:00:00Z",
          current: false,
        },
      ]}
    />,
  );
  expect(html).toMatch(/<option value="585"[^>]*>/);
  expect(html).not.toMatch(/<option value="610"[^>]*>/);
  expect(html).toContain('value="AZN" selected=""');
  expect(html).toContain("USD");
  expect(html).toContain("610");
  expect(html).toContain("Tarixçə");
});
