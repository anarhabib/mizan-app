export interface SaleCreateInput {
  expectedCurrency?: string;
  productId: string;
  saleAmount: string;
  tradeIns?: Array<{
    purity: number;
    weight: string;
    rateId: string;
    overrideAmount?: string;
  }>;
  payment?: {
    currency: string;
    amount: string;
    exchangeRate?: string;
  };
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
  tradeIns: Array<{
    id: string;
    purity: number;
    rateId: string;
    weight: string;
    appliedRate: string;
    calculatedValue: string;
    acceptedValue: string;
    overridden: boolean;
  }>;
}
