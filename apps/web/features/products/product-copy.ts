export const productCopy = {
  en: {
    title: "Products",
    add: "Add product",
    search: "Search by code or name",
    find: "Search",
    all: "All statuses",
    IN_STOCK: "In stock",
    SOLD: "Sold",
    reset: "Reset",
    next: "Next page",
    empty: "No products found",
    unavailable: "Could not load products",
    missing: "Product not found",
    code: "Product code",
    name: "Name",
    category: "Category",
    purity: "Purity",
    weight: "Total weight (g)",
    acquisitionCost: "Acquisition cost",
    currency: "Currency",
    note: "Note",
    save: "Save product",
    saving: "Saving…",
    invalid: "Check this value.",
    duplicate: "This product code already exists",
    failed: "Could not save the product.",
    back: "Back to products",
    loading: "Loading…",
    noPhoto: "No product photo",
    photo: "Product photo",
    upload: "Save photo",
    cancel: "Cancel",
    photoFailed: "Could not save the photo. Try again.",
    history: "Inventory history",
    sale: "Recorded sale",
    PRODUCT_ADDED: "Product added",
    PRODUCT_SOLD: "Product sold",
    OLD_GOLD_RECEIVED: "Old gold received",
  },
  az: {
    title: "Məhsullar",
    add: "Məhsul əlavə et",
    search: "Kod və ya ad üzrə axtarış",
    find: "Axtar",
    all: "Bütün statuslar",
    IN_STOCK: "Anbardadır",
    SOLD: "Satılıb",
    reset: "Sıfırla",
    next: "Növbəti səhifə",
    empty: "Məhsul tapılmadı",
    unavailable: "Məhsulları yükləmək mümkün olmadı",
    missing: "Məhsul tapılmadı",
    code: "Məhsul kodu",
    name: "Ad",
    category: "Kateqoriya",
    purity: "Əyar",
    weight: "Ümumi çəki (q)",
    acquisitionCost: "Alış dəyəri",
    currency: "Valyuta",
    note: "Qeyd",
    save: "Məhsulu yadda saxla",
    saving: "Saxlanılır…",
    invalid: "Bu dəyəri yoxlayın.",
    duplicate: "Bu məhsul kodu artıq istifadə olunur",
    failed: "Məhsulu saxlamaq mümkün olmadı.",
    back: "Məhsullara qayıt",
    loading: "Yüklənir…",
    noPhoto: "Məhsulun fotoşəkli yoxdur",
    photo: "Məhsulun fotoşəkli",
    upload: "Fotoşəkli saxla",
    cancel: "Ləğv et",
    photoFailed: "Fotoşəkli saxlamaq mümkün olmadı. Yenidən cəhd edin.",
    history: "Anbar tarixçəsi",
    sale: "Qeydə alınmış satış",
    PRODUCT_ADDED: "Məhsul əlavə edildi",
    PRODUCT_SOLD: "Məhsul satıldı",
    OLD_GOLD_RECEIVED: "Köhnə qızıl qəbul edildi",
  },
};

export type ProductScope = { organizationId: string; storeId: string };
export type ProductOptions = { defaultCurrency: string; purities: number[] };
export type ProductFilters = {
  q?: string;
  status?: string;
  after?: string;
  date?: string;
  category?: string;
  purity?: string;
  facets?: string;
};

export function productHref(
  path: string,
  { organizationId, storeId }: ProductScope,
  filters: ProductFilters = {},
) {
  const params = new URLSearchParams({ organizationId, storeId });
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  return path + "?" + params.toString();
}
