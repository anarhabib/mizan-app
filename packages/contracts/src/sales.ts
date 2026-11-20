import type { MoneyInput } from "./money.js";

export type SaleCreateInput = SaleTerms &
  (
    | { productId: string; saleAmount: string; items?: never }
    | { items: SaleItemInput[]; productId?: never; saleAmount?: never }
  );

export interface SaleItemInput {
  productId: string;
  saleAmount: string;
}

export interface SaleTradeInInput {
  purity: number;
  weight: string;
  rateId: string;
  overrideAmount?: string;
}

export interface SalePreviewInput {
  expectedCurrency?: string;
  tradeIns: SaleTradeInInput[];
}

export interface SaleTradeInPreview {
  purity: number;
  weight: string;
  rateId: string;
  appliedRate: string;
  calculatedValue: string;
  acceptedValue: string;
  overridden: boolean;
}

export interface SalePreview {
  currency: string;
  tradeInTotal: string;
  tradeIns: SaleTradeInPreview[];
}

export const maxSaleItems = 100;

interface SaleTerms {
  expectedCurrency?: string;
  tradeIns?: SaleTradeInInput[];
  payment?: {
    currency: string;
    amount: string;
    exchangeRate?: string;
  };
}

export interface SaleLoss {
  productId: string;
  code: string;
  acquisitionCost: string;
  saleAmount: string;
  expectedLoss: string;
}

export interface SaleConfirmation {
  token: string;
  financials?: { currency: string; losses: SaleLoss[] };
}

export interface SaleProfit {
  acquisitionCost: MoneyInput | null;
  grossProfit: string | null;
  marginPercent: string | null;
}

export interface SaleItem {
  product: SaleResult["product"];
  saleAmount: string;
  profit?: SaleProfit & { acquisitionCostPerGram: MoneyInput | null };
}

export interface SaleList {
  items: Array<
    Pick<
      SaleResult,
      | "id"
      | "createdAt"
      | "actorId"
      | "currency"
      | "saleAmount"
      | "product"
      | "balance"
    > & { paymentCurrency: string | null; itemCount: number }
  >;
  nextCursor?: string;
}

export interface SaleResult {
  id: string;
  actorId: string;
  createdAt: string;
  currency: string;
  saleAmount: string;
  tradeInTotal: string;
  balance: string;
  payout: string;
  items: SaleItem[];
  profit?: SaleProfit;
  payment: {
    currency: string;
    amount: string;
    exchangeRate: string;
    convertedAmount: string;
    change: string;
  } | null;
  product: {
    id: string;
    code: string;
    name: string;
    category: string;
    purity: number;
    weight: string;
    status: "SOLD";
  };
  tradeIns: Array<SaleTradeInPreview & { id: string }>;
}
