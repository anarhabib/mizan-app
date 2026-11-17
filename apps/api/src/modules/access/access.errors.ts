export type AccessFailure =
  | "UNAUTHENTICATED"
  | "ACCESS_DENIED"
  | "AUTH_UNAVAILABLE"
  | "INVITATION_UNAVAILABLE"
  | "INVALID_MEMBERSHIP"
  | "INVALID_SETTINGS"
  | "PURITY_CONFLICT";

const details = {
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

  constructor(readonly code: AccessFailure) {
    super(details[code].message);
    this.statusCode = details[code].statusCode;
  }
}
