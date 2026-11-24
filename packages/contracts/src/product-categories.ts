export const defaultCategoryLabels = {
  RING: { az: "Üzük", en: "Ring", ru: "Кольцо" },
  EARRINGS: { az: "Sırğa", en: "Earrings", ru: "Серьги" },
  NECKLACE: { az: "Boyunbağı", en: "Necklace", ru: "Ожерелье" },
  BRACELET: { az: "Qolbaq", en: "Bracelet", ru: "Браслет" },
  CHAIN: { az: "Zəncir", en: "Chain", ru: "Цепочка" },
  PENDANT: { az: "Kulon", en: "Pendant", ru: "Кулон" },
  MEDALLION: { az: "Medalyon", en: "Medallion", ru: "Медальон" },
  BROOCH: { az: "Bros", en: "Brooch", ru: "Брошь" },
  ANKLET: { az: "Ayaq bilərziyi", en: "Anklet", ru: "Браслет на ногу" },
  SET: { az: "Komplekt", en: "Set", ru: "Комплект" },
  OTHER: { az: "Digər", en: "Other", ru: "Другое" },
} as const;

export const maxCategoryNameLength = 80;
export const maxCategorySortOrder = 1000000;
export const categoryIdPattern =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export interface ProductCategoryLabel {
  code: string | null;
  name: string;
}

export interface ProductCategory extends ProductCategoryLabel {
  id: string;
  isActive: boolean;
  sortOrder: number;
}

export type ProductCategoryUpdate = Partial<
  Pick<ProductCategory, "name" | "isActive" | "sortOrder">
>;

export function parseCategoryName(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    /[\p{Cc}\p{Cs}\p{Bidi_Control}]/u.test(value)
  )
    return null;
  const name = value.trim();
  return name && name.length <= maxCategoryNameLength && /[^\p{Cf}]/u.test(name)
    ? name
    : null;
}

export function categoryLabel(
  { code, name }: ProductCategoryLabel,
  language?: string,
) {
  if (!code || !Object.hasOwn(defaultCategoryLabels, code)) return name;
  const labels =
    defaultCategoryLabels[code as keyof typeof defaultCategoryLabels];
  if (name !== labels.az) return name;
  const locale = language?.split("-")[0];
  return locale === "en" || locale === "ru" ? labels[locale] : labels.az;
}
