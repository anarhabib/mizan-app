import { expect, test } from "vitest";
import {
  categoryLabel,
  defaultCategoryLabels,
  parseCategoryName,
  parseFullName,
  parseOnboarding,
} from "../src/index.js";

test("accepts international names with punctuation and rejects control characters", () => {
  expect(parseFullName("  Xədicə Əliyeva-İsmayılova  ")).toBe(
    "Xədicə Əliyeva-İsmayılova",
  );
  expect(parseFullName("李 O’Connor")).toBe("李 O’Connor");
  for (const input of [" ", "\tA", "name\u0085second", "a".repeat(121)])
    expect(parseFullName(input)).toBeNull();
  expect(
    parseOnboarding({
      organizationName: "Shop",
      storeName: "Store",
      defaultCurrency: "AZN",
    }),
  ).toBeNull();
});

test("uses all eleven localized defaults and preserves customized category labels", () => {
  expect(Object.keys(defaultCategoryLabels)).toHaveLength(11);
  for (const [code, labels] of Object.entries(defaultCategoryLabels)) {
    for (const locale of ["az", "en", "ru"] as const)
      expect(categoryLabel({ code, name: labels.az }, locale)).toBe(
        labels[locale],
      );
  }
  expect(categoryLabel({ code: "RING", name: "Custom rings" }, "ru")).toBe(
    "Custom rings",
  );
  expect(categoryLabel({ code: null, name: "Custom rings" }, "az")).toBe(
    "Custom rings",
  );
  expect(parseCategoryName("  Şəbəkə  ")).toBe("Şəbəkə");
  for (const input of [" ", "Category\u007f", "a".repeat(81)])
    expect(parseCategoryName(input)).toBeNull();
});
