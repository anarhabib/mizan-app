import type { MoneyInput as Money } from "./money.js";
import type { GoldPriceKind } from "./gold-prices.js";

export type DashboardPaymentStatus = "PAID" | "PARTIALLY_PAID" | "UNPAID";

export type DashboardSummary = {
  day: string;
  sales: { total: Money[]; count: number; products: number; average: Money[] };
  previousSales: {
    total: Money[];
    count: number;
    products: number;
    average: Money[];
  };
  payments: {
    total: Money[];
    normalized: Money | null;
    repayments: Money[];
    tradeInCredit: Money[];
    methods: { method: string; total: Money[] }[];
  };
  debt: {
    new: Money[];
    outstanding: Money[];
    customers: number;
    partial: number;
    unpaid: number;
  };
  intake: {
    count: number;
    weight: string;
    tradeInWeight: string;
    tradeInValue: Money[];
  };
  inventory: { count: number; weight: string; marketValue: Money | null };
};

export type DashboardOwnerSummary = {
  grossProfit: Money[] | null;
  intakeCost: Money[];
  inventoryCost: Money[];
};

export type DashboardCount = { label: string; count: number };

export type DashboardCharts = {
  days: { day: string; sales: Money[]; payments: Money[]; count: number }[];
  categories: DashboardCount[];
  methods: DashboardCount[];
  purities: DashboardCount[];
  inventoryCategories: DashboardCount[];
  settlement: Record<DashboardPaymentStatus, number>;
};

export type DashboardActivityItem = {
  id: string;
  recordId: string;
  kind: "sale" | "intake" | "tradeIn" | "repayment";
  label: string;
  at: string;
  value: Money | null;
};

export type DashboardActivity = {
  items: DashboardActivityItem[];
  debtors: { id: string; name: string; outstanding: Money }[];
};

export type DashboardAgedStock = {
  count: number;
  items: { id: string; name: string; code: string; receivedAt: string }[];
};

export const marketPeriods = ["24h", "7d", "30d", "90d"] as const;
export type MarketPeriod = (typeof marketPeriods)[number];
export type MarketPoint = { at: string; value: string | null };
export type MarketMovement = {
  absolute: string;
  percent: string;
  direction: "up" | "down" | "flat";
};
export type MarketSeries = {
  points: MarketPoint[];
  high: string | null;
  low: string | null;
  movement: MarketMovement | null;
};
export type DashboardGoldHistory = {
  usd: MarketSeries;
  azn: MarketSeries;
};

export type DashboardGoldRates = {
  stale: boolean;
  quoteId: string | null;
  rates: {
    purity: number;
    reference: Money | null;
    commercial: Record<GoldPriceKind, Money | null>;
  }[];
};
