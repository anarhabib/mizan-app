import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { ProductForm } from "./product-form";
import { ProductList } from "./product-list";
import { ProductDetail } from "./product-detail";
import { saveProduct } from "./product-actions";
import { productRequest } from "../../lib/api-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../lib/api-client", () => ({ productRequest: vi.fn() }));

const scope = { organizationId: "org", storeId: "store" };
const product = {
  id: "item",
  code: "R1",
  name: "Ring",
  category: "Ring",
  purity: 585,
  weight: "3.125",
  status: "IN_STOCK" as const,
  note: null,
  createdAt: "2026-11-18T00:00:00Z",
  movements: [],
  sale: null,
  photo: null,
};

test("keeps invalid input and reports duplicate codes inline", () => {
  const html = renderToStaticMarkup(
    <ProductForm
      currencies={["AZN", "USD"]}
      locale="en"
      scope={scope}
      options={{ defaultCurrency: "USD", purities: [585] }}
      save={vi.fn()}
      initial={{
        field: "code",
        duplicate: true,
        values: { code: "R1", weight: "3.1259" },
      }}
    />,
  );
  expect(html).toContain("This product code already exists");
  expect(html).toContain('aria-describedby="code-error"');
  expect(html).toContain('value="3.1259"');
  expect(html).toContain('value="USD" selected=""');
});

test("preserves the raw measurement and sends only valid exact decimals", async () => {
  const values = new FormData();
  for (const [key, value] of Object.entries({
    ...scope,
    code: "R1",
    name: "Ring",
    category: "Ring",
    purity: "585",
    weight: "3,1259",
    acquisitionCost: "12,50",
    currency: "AZN",
  }))
    values.set(key, value);
  expect(await saveProduct({}, values)).toMatchObject({
    field: "weight",
    values: { weight: "3,1259" },
  });
  expect(productRequest).not.toHaveBeenCalled();
  values.set("weight", "3,125");
  vi.mocked(productRequest).mockResolvedValueOnce({
    status: 409,
    data: undefined,
    error: { code: "PRODUCT_CODE_CONFLICT" },
  });
  expect(await saveProduct({}, values)).toMatchObject({
    field: "code",
    duplicate: true,
    values: { weight: "3,125" },
  });
  expect(productRequest).toHaveBeenCalledWith(
    "/products",
    scope,
    undefined,
    expect.objectContaining({
      weight: "3.125",
      acquisitionCost: { amount: "12.50", currency: "AZN" },
    }),
  );
});

test("search survives pagination and inventory shows empty and failed states", () => {
  const props = { locale: "en" as const, scope, filters: { q: "Ring" } };
  expect(
    renderToStaticMarkup(
      <ProductList
        {...props}
        result={{ items: [product], nextCursor: "R1" }}
      />,
    ),
  ).toContain("q=Ring&amp;after=R1");
  expect(
    renderToStaticMarkup(<ProductList {...props} result={{ items: [] }} />),
  ).toContain("No products found");
  expect(renderToStaticMarkup(<ProductList {...props} />)).toContain(
    "Could not load products",
  );
});

test("renders a photo fallback and only shows authorized acquisition cost", () => {
  const html = renderToStaticMarkup(
    <ProductDetail locale="en" scope={scope} product={product} />,
  );
  expect(html).toContain("No product photo");
  expect(html).not.toContain("Acquisition cost");
  expect(
    renderToStaticMarkup(
      <ProductDetail
        locale="en"
        scope={scope}
        product={{
          ...product,
          acquisitionCost: { amount: "12.50", currency: "AZN" },
        }}
      />,
    ),
  ).toContain("Acquisition cost");
});
