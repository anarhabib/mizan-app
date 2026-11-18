export type AccessFailure =
  | "UNAUTHENTICATED"
  | "ACCESS_DENIED"
  | "AUTH_UNAVAILABLE"
  | "INVITATION_UNAVAILABLE"
  | "INVALID_MEMBERSHIP"
  | "INVALID_SETTINGS"
  | "PURITY_CONFLICT"
  | "INVALID_PRODUCT"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_CODE_CONFLICT"
  | "PHOTO_CONFLICT"
  | "PHOTO_UNAVAILABLE";

const details = {
  INVALID_PRODUCT: {
    statusCode: 400,
    message: "Məhsul məlumatlarını yoxlayın.",
  },
  PRODUCT_NOT_FOUND: { statusCode: 404, message: "Məhsul tapılmadı." },
  PRODUCT_CODE_CONFLICT: {
    statusCode: 409,
    message: "Məhsul kodu artıq istifadə olunur.",
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
