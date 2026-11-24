export const maxFullNameLength = 120;

export interface UserProfile {
  fullName: string | null;
  hasMembership: boolean;
}

export function parseFullName(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    /[\p{Cc}\p{Cs}\p{Bidi_Control}]/u.test(value)
  )
    return null;
  const name = value.trim();
  return name && name.length <= maxFullNameLength && /[^\p{Cf}]/u.test(name)
    ? name
    : null;
}
