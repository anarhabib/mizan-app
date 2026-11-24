import type { SalePaymentInput } from "./sales.js";

export type SaleReturnStatus = "PARTIALLY_RETURNED" | "RETURNED";

export interface SaleRefundInput {
  refundDate: string;
  amount: string;
  method: SalePaymentInput["method"];
}

export interface SaleReturnSelection {
  productId: string;
  resellable: boolean;
}

export interface SaleReturnInput {
  items: SaleReturnSelection[];
  reason: string;
  returnDate: string;
  debtCanceled?: string;
  refund?: SaleRefundInput;
}

export interface SaleReturnQuote {
  currency: string;
  returnedValue: string;
  collected: string;
  minDebtCanceled: string;
  maxDebtCanceled: string;
  debtCanceled: string | null;
  remainingDebt: string | null;
  refundableValue: string | null;
  refundAmount: string;
  refundLimit: string | null;
  remainingRefundable: string | null;
  remainingProductIds: string[];
  confirmation?: string;
}

export interface SaleRefundRecord extends SaleRefundInput {
  id: string;
  actorName: string | null;
}

export interface SaleReturnRecord {
  id: string;
  reason: string;
  returnDate: string;
  actorName: string | null;
  items: SaleReturnSelection[];
  returnedValue: string;
  debtCanceled: string;
  refundableValue: string;
  remainingRefundable: string;
  refundLimit: string;
  refunds: SaleRefundRecord[];
}
