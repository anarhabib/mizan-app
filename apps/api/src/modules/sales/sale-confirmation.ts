import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SaleConfirmation, SaleLoss } from "@mizan/contracts";

const signingKey = randomBytes(32);

export class SaleConfirmationRequired extends Error {
  constructor(readonly confirmation: SaleConfirmation) {
    super("Satışı tamamlamaq üçün təsdiq tələb olunur.");
  }
}

export function requireSaleConfirmation(
  suppliedToken: string | undefined,
  binding: unknown[],
  currency: string,
  losses: SaleLoss[],
  showCosts: boolean,
) {
  if (!losses.length) return;
  const signature = createHmac("sha256", signingKey)
    .update(JSON.stringify([binding, currency, losses]))
    .digest();
  if (
    suppliedToken &&
    /^[A-Za-z0-9_-]{43}$/.test(suppliedToken) &&
    timingSafeEqual(signature, Buffer.from(suppliedToken, "base64url"))
  )
    return;
  throw new SaleConfirmationRequired({
    token: signature.toString("base64url"),
    ...(showCosts && { financials: { currency, losses } }),
  });
}
