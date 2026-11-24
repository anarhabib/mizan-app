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
  rateId: string | null;
  marketQuoteId?: string;
  rateExchangeRate?: string;
  overrideAmount?: string;
}

export interface SalePreviewInput {
  expectedCurrency?: string;
  saleAmounts?: string[];
  tradeIns: SaleTradeInInput[];
  payments?: SalePaymentInput[];
  customerReportingRate?: string;
}

export interface SaleTradeInPreview {
  purity: number;
  weight: string;
  rateId: string | null;
  marketQuoteId?: string;
  rateExchangeRate?: string;
  appliedRate: string | null;
  calculatedValue: string | null;
  acceptedValue: string;
  overridden: boolean;
}

export interface SaleOptions {
  currency: string;
  retailRates?: { purity: number; amountPerGram: string }[];
  rates: {
    id: string | null;
    purity: number;
    amountPerGram: string | null;
    marketQuoteId?: string;
    rateExchangeRate?: string;
  }[];
}

export interface SalePreview {
  currency: string;
  tradeInTotal: string;
  amountDue?: string;
  saleAmount?: string;
  paidAmount?: string;
  outstandingDebt?: string;
  overpayment?: string;
  payments?: Array<Pick<SalePayment, "convertedAmount" | "amountAzn">>;
  tradeIns: SaleTradeInPreview[];
}

export const maxSaleItems = 100;
export const maxSalePayments = 20;
export const salePaymentMethods = ["CASH", "CARD", "TRANSFER"] as const;

export interface SalePaymentInput extends MoneyInput {
  method: (typeof salePaymentMethods)[number];
  exchangeRate?: string;
}

export interface SalePayment extends Omit<SalePaymentInput, "method"> {
  id: string;
  actorId?: string;
  actorName?: string | null;
  createdAt: string;
  kind: "CHECKOUT" | "REPAYMENT";
  method: SalePaymentInput["method"] | null;
  exchangeRate: string;
  convertedAmount: string;
  amountAzn: string | null;
  change: string;
}

export type SalePaymentStatus = "PAID" | "PARTIALLY_PAID" | "UNPAID";

interface SaleTerms {
  expectedCurrency?: string;
  customerId?: string;
  customerReportingRate?: string;
  recordDebt?: boolean;
  tradeIns?: SaleTradeInInput[];
  payments?: SalePaymentInput[];
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
  debt?: {
    total: MoneyInput;
    tradeIn: MoneyInput;
    paid: MoneyInput;
    outstanding: MoneyInput;
  };
  belowCost?: boolean;
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
      | "actorName"
      | "currency"
      | "saleAmount"
      | "product"
      | "balance"
      | "paymentStatus"
      | "outstandingDebt"
    > & {
      paymentCurrency: string | null;
      itemCount: number;
      thumbnailUrl?: string;
    }
  >;
  nextCursor?: string;
}

export interface SaleResult {
  id: string;
  customerId?: string;
  customerName?: string;
  outstandingDebt: string;
  paymentStatus: SalePaymentStatus;
  paidAmount: string;
  payments: SalePayment[];
  actorId: string;
  actorName?: string | null;
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
    categoryCode?: string;
    purity: number;
    weight: string;
    status: "SOLD";
  };
  tradeIns: Array<SaleTradeInPreview & { id: string }>;
}
