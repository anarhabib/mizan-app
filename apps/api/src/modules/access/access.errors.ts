export type AccessFailure =
  | "UNAUTHENTICATED"
  | "ACCESS_DENIED"
  | "AUTH_UNAVAILABLE"
  | "INVITATION_UNAVAILABLE"
  | "INVALID_MEMBERSHIP";

const details = {
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
