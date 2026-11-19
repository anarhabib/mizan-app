import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { OrganizationSettingsForm } from "./organization-settings-form";
import { PurchaseRates, PurityGrades } from "./purity-rate-manager";
import { RateHistory } from "./rate-history";

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
    <>
      <PurchaseRates
        currencies={["AZN", "SLE", "USD"]}
        organizationId="test"
        locale="az"
        purities={[
          { value: 585, active: true },
          { value: 610, active: false },
        ]}
      />
      <RateHistory
        locale="az"
        rates={[
          {
            id: "old",
            purity: 610,
            currency: "USD",
            amountPerGram: "32.7951",
            effectiveAt: "2026-11-18T00:00:00Z",
            current: false,
          },
        ]}
      />
    </>,
  );
  expect(html).toMatch(/<option value="585"[^>]*>/);
  expect(html).not.toMatch(/<option value="610"[^>]*>/);
  expect(html).toContain('value="AZN" selected=""');
  expect(html).toContain('<option value="SLE">SLE</option>');
  expect(html).toContain("32,80 USD");
  expect(html).toContain("610");
  expect(html).toContain("Tarixçə");
});

test("offers reactivation for an already inactive grade in Azerbaijani", () => {
  const html = renderToStaticMarkup(
    <PurityGrades
      organizationId="test"
      locale="az"
      purities={[{ value: 375, active: false }]}
    />,
  );
  expect(html).toContain('name="intent" value="reactivate"');
  expect(html).toContain("Aktiv et");
});
