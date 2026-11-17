import { currencyMinorUnits } from "./money.js";

export interface OnboardingRequest {
  organizationName: string;
  storeName: string;
  defaultCurrency: string;
}

export interface OnboardingResult {
  organizationId: string;
  storeId: string;
  membershipId: string;
}

export interface StoreContext {
  organizationId: string;
  organizationName: string;
  storeId: string;
  storeName: string;
  role: "OWNER" | "SALESPERSON";
}

export function parseOnboarding(input: unknown): OnboardingRequest | null {
  if (!input || typeof input !== "object") return null;
  const { organizationName, storeName, defaultCurrency } =
    input as Partial<OnboardingRequest>;
  if (
    typeof organizationName !== "string" ||
    typeof storeName !== "string" ||
    typeof defaultCurrency !== "string"
  )
    return null;
  const organization = organizationName.trim();
  const store = storeName.trim();
  if (
    !organization ||
    !store ||
    organization.length > 100 ||
    store.length > 100 ||
    [...(organization + store)].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  try {
    currencyMinorUnits(defaultCurrency);
  } catch {
    return null;
  }
  return { organizationName: organization, storeName: store, defaultCurrency };
}
