import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { OwnerSetupFields } from "./owner-registration-form";
import { ContextPicker, chooseContext } from "../context/context-picker";
import { parseLocale } from "../language/messages";

vi.mock("./owner-actions", () => ({
  submitCredentials: vi.fn(),
  submitOwnerSetup: vi.fn(),
}));

const context = {
  organizationId: "organization",
  organizationName: "Mizan",
  storeId: "store",
  storeName: "Bakı",
  role: "OWNER" as const,
};
const other = { ...context, storeId: "other", storeName: "Gəncə" };

test("renders labeled required setup fields and preserves submitted values after an error", () => {
  const html = renderToStaticMarkup(
    <OwnerSetupFields
      currencies={["AZN", "USD"]}
      values={{
        organizationName: "Zərgər",
        storeName: "Bakı",
        defaultCurrency: "USD",
      }}
      error="Məlumatları yoxlayın."
    />,
  );
  expect(html).toContain("Biznesin adı");
  expect(html).toContain("Mağazanın adı");
  expect(html).toContain("Əsas valyuta");
  expect(html.match(/required=""/g)).toHaveLength(3);
  expect(html).toContain('value="Zərgər"');
  expect(html).toContain('value="USD" selected=""');
  expect(html).toContain('role="alert"');
});

test("automatically selects one context, requires a choice for several and ignores unauthorized selection", () => {
  expect(chooseContext([context])).toEqual(context);
  expect(chooseContext([context, other])).toBeUndefined();
  expect(
    chooseContext([context, other], "organization", "unauthorized"),
  ).toBeUndefined();
  expect(chooseContext([context, other], "organization", "other")).toEqual(
    other,
  );
  expect(
    renderToStaticMarkup(<ContextPicker contexts={[context]} />),
  ).not.toContain("Mağaza seçin");
  expect(
    renderToStaticMarkup(<ContextPicker contexts={[context, other]} />),
  ).toContain("Gəncə");
});

test("renders English when selected and defaults to Azerbaijani for unsupported locales", () => {
  expect(parseLocale("en")).toBe("en");
  expect(parseLocale("unsupported")).toBe("az");
  const html = renderToStaticMarkup(
    <OwnerSetupFields locale="en" currencies={["AZN"]} />,
  );
  expect(html).toContain("Business name");
  expect(html).toContain("Default currency");
  expect(html).not.toContain("Biznesin adı");
  expect(
    renderToStaticMarkup(
      <ContextPicker contexts={[context, other]} locale="en" />,
    ),
  ).toContain("Choose a store");
});
