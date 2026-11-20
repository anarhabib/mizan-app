import type { SaleCreateInput } from "@mizan/contracts";

export type SaleAttempt = { key: string; payload: SaleCreateInput };

export function saleAttempt(
  previous: SaleAttempt | undefined,
  payload: SaleCreateInput,
  makeKey: () => string = () => crypto.randomUUID(),
): SaleAttempt {
  if (
    previous &&
    JSON.stringify(previous.payload) === JSON.stringify(payload)
  ) {
    return previous;
  }
  return { key: makeKey(), payload };
}
