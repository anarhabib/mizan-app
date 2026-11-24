export type AccessFailure =
  | "UNAUTHENTICATED"
  | "ACCESS_DENIED"
  | "AUTH_UNAVAILABLE"
  | "INVALID_PROFILE"
  | "INVALID_CATEGORY"
  | "CATEGORY_CONFLICT"
  | "CATEGORY_UNAVAILABLE"
  | "INVITATION_UNAVAILABLE"
  | "INVALID_MEMBERSHIP"
  | "INVALID_SETTINGS"
  | "PURITY_CONFLICT"
  | "GOLD_PRICE_CONFLICT"
  | "GOLD_PRICE_UNAVAILABLE"
  | "INVALID_SALE"
  | "SALE_CUSTOMER_REQUIRED"
  | "INVALID_CUSTOMER"
  | "INVALID_SUPPLIER"
  | "SUPPLIER_NOT_FOUND"
  | "SUPPLIER_INACTIVE"
  | "INVALID_PURCHASE"
  | "PURCHASE_NOT_FOUND"
  | "PURCHASE_PRODUCT_CONFLICT"
  | "SUPPLIER_CURRENCY_MISMATCH"
  | "INVALID_SUPPLIER_PAYMENT"
  | "SUPPLIER_OVERPAYMENT"
  | "SUPPLIER_REQUEST_CONFLICT"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DELETE_CONFLICT"
  | "SALE_PAYMENT_NOT_DUE"
  | "SALE_PAYMENT_TOO_SMALL"
  | "SALE_PAYMENT_EXCEEDS_BALANCE"
  | "SALE_CONFLICT"
  | "SALE_NOT_FOUND"
  | "INVALID_PRODUCT"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_CODE_CONFLICT"
  | "PRODUCT_EDIT_CONFLICT"
  | "PRODUCT_DELETE_CONFLICT"
  | "PHOTO_CONFLICT"
  | "PHOTO_UNAVAILABLE";

const details = {
  INVALID_SUPPLIER: {
    statusCode: 400,
    message: "Təchizatçı məlumatlarını yoxlayın.",
  },
  SUPPLIER_NOT_FOUND: { statusCode: 404, message: "Təchizatçı tapılmadı." },
  SUPPLIER_INACTIVE: {
    statusCode: 409,
    message: "Yeni alış üçün aktiv təchizatçı seçin.",
  },
  INVALID_PURCHASE: {
    statusCode: 400,
    message: "Alış məlumatlarını yoxlayın.",
  },
  PURCHASE_NOT_FOUND: { statusCode: 404, message: "Alış sənədi tapılmadı." },
  PURCHASE_PRODUCT_CONFLICT: {
    statusCode: 409,
    message: "Məhsul bu alış sənədinə əlavə edilə bilməz.",
  },
  SUPPLIER_CURRENCY_MISMATCH: {
    statusCode: 400,
    message: "Valyuta alış sənədinin valyutası ilə eyni olmalıdır.",
  },
  INVALID_SUPPLIER_PAYMENT: {
    statusCode: 400,
    message: "Ödəniş məlumatlarını yoxlayın.",
  },
  SUPPLIER_OVERPAYMENT: {
    statusCode: 409,
    message: "Ödəniş qalan borcdan çoxdur.",
  },
  SUPPLIER_REQUEST_CONFLICT: {
    statusCode: 409,
    message: "Bu sorğu açarı fərqli əməliyyat üçün istifadə edilib.",
  },
  INVALID_PROFILE: { statusCode: 400, message: "Ad və soyadı yoxlayın." },
  INVALID_CATEGORY: {
    statusCode: 400,
    message: "Kateqoriya məlumatlarını yoxlayın.",
  },
  CATEGORY_CONFLICT: {
    statusCode: 409,
    message: "Bu adda kateqoriya artıq mövcuddur.",
  },
  CATEGORY_UNAVAILABLE: {
    statusCode: 409,
    message: "Kateqoriya mövcud deyil və ya aktiv deyil.",
  },
  SALE_CUSTOMER_REQUIRED: {
    statusCode: 400,
    message: "Borc üçün müştəri seçin.",
  },
  INVALID_CUSTOMER: {
    statusCode: 400,
    message: "Müştəri məlumatlarını yoxlayın.",
  },
  CUSTOMER_NOT_FOUND: { statusCode: 404, message: "Müştəri tapılmadı." },
  CUSTOMER_DELETE_CONFLICT: {
    statusCode: 409,
    message: "Alış tarixçəsi olan müştərini silmək mümkün deyil.",
  },
  INVALID_SALE: { statusCode: 400, message: "Satış məlumatlarını yoxlayın." },
  SALE_PAYMENT_NOT_DUE: {
    statusCode: 400,
    message: "Bu satış üzrə ödəniş tələb olunmur.",
  },
  SALE_PAYMENT_TOO_SMALL: {
    statusCode: 400,
    message: "Ödəniş məbləği çevirmədən sonra sıfıra yuvarlaqlaşır.",
  },
  SALE_PAYMENT_EXCEEDS_BALANCE: {
    statusCode: 409,
    message: "Ödəniş məbləği qalan borcdan çoxdur.",
  },
  SALE_CONFLICT: {
    statusCode: 409,
    message: "Satışı tamamlamaq mümkün olmadı.",
  },
  SALE_NOT_FOUND: { statusCode: 404, message: "Satış tapılmadı." },
  INVALID_PRODUCT: {
    statusCode: 400,
    message: "Məhsul məlumatlarını yoxlayın.",
  },
  PRODUCT_NOT_FOUND: { statusCode: 404, message: "Məhsul tapılmadı." },
  PRODUCT_CODE_CONFLICT: {
    statusCode: 409,
    message: "Məhsul kodu artıq istifadə olunur.",
  },
  PRODUCT_EDIT_CONFLICT: {
    statusCode: 409,
    message: "Bu məhsulun alış məlumatlarını dəyişmək mümkün deyil.",
  },
  PRODUCT_DELETE_CONFLICT: {
    statusCode: 409,
    message: "Stok və ya satış tarixçəsi olan məhsulu silmək mümkün deyil.",
  },
  PHOTO_CONFLICT: {
    statusCode: 409,
    message: "Fotoşəkli təsdiqləmək və ya yükləmək mümkün olmadı.",
  },
  PHOTO_UNAVAILABLE: {
    statusCode: 503,
    message: "Fotoşəkil xidməti müvəqqəti əlçatan deyil.",
  },
  INVALID_SETTINGS: {
    statusCode: 400,
    message: "Parametr məlumatlarını yoxlayın.",
  },
  PURITY_CONFLICT: {
    statusCode: 409,
    message: "Əyar artıq mövcuddur və ya aktiv deyil.",
  },
  GOLD_PRICE_CONFLICT: {
    statusCode: 409,
    message: "Qiymət dəyişib və ya artıq aktual deyil.",
  },
  GOLD_PRICE_UNAVAILABLE: {
    statusCode: 409,
    message: "Aktual bazar qiyməti əlçatan deyil.",
  },
  UNAUTHENTICATED: {
    statusCode: 401,
    message: "Daxil olmağınız tələb olunur.",
  },
  ACCESS_DENIED: {
    statusCode: 403,
    message: "Bu mağazaya giriş icazəniz yoxdur.",
  },
  AUTH_UNAVAILABLE: {
    statusCode: 503,
    message: "Giriş xidməti müvəqqəti əlçatan deyil.",
  },
  INVITATION_UNAVAILABLE: {
    statusCode: 409,
    message: "Dəvət artıq istifadə edilə bilmir.",
  },
  INVALID_MEMBERSHIP: {
    statusCode: 400,
    message: "Dəvət məlumatlarını yoxlayın.",
  },
} as const;

export class AccessError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: AccessFailure,
    readonly field?: string,
  ) {
    super(details[code].message);
    this.statusCode = details[code].statusCode;
  }
}
