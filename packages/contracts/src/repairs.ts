import { categoryIdPattern } from "./product-categories.js";
import { parseDecimal } from "./decimal.js";
import type { MoneyInput } from "./money.js";
import {
  parseProductGemstones,
  parseProductWeights,
  type ProductGemstone,
} from "./products.js";
import {
  isSupplierCurrency,
  isSupplierDate,
  supplierPaymentMethods,
  type SupplierPaymentMethod,
} from "./suppliers.js";

export type RepairStatus = "ACTIVE" | "COMPLETED" | "CANCELED";
export type RepairEventKind =
  "SENT" | "PROGRESS" | "COMPLETED" | "CANCELED" | "PAID";

export interface RepairMeasurements {
  weight: string;
  netGoldWeight: string | null;
  gemstones: ProductGemstone[];
}

export interface RepairSummary {
  id: string;
  status: RepairStatus;
  description: string;
  repairerName: string;
  sentDate: string;
  expectedReturnDate: string | null;
  completedDate: string | null;
}

export interface RepairDetail extends RepairSummary {
  before: RepairMeasurements;
  after: RepairMeasurements | null;
  financial?: {
    estimatedCost: MoneyInput | null;
    actualCost: MoneyInput | null;
    payment: { date: string; method: SupplierPaymentMethod } | null;
  };
  events: {
    id: number;
    kind: RepairEventKind;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }[];
}

export interface RepairHistory {
  items: RepairSummary[];
  nextCursor?: string;
}

export type RepairCommand =
  | {
      action: "send";
      description: string;
      supplierId?: string;
      repairerName?: string;
      sentDate: string;
      expectedReturnDate?: string;
      estimatedCost?: MoneyInput;
      note?: string;
    }
  | ({
      action: "complete";
      repairId: string;
      completedDate: string;
      netGoldWeight: string;
      actualCost: MoneyInput;
      note?: string;
    } & Omit<RepairMeasurements, "netGoldWeight">)
  | { action: "progress"; repairId: string; note: string }
  | { action: "cancel"; repairId: string; note?: string }
  | {
      action: "pay";
      repairId: string;
      paymentDate: string;
      method: SupplierPaymentMethod;
    };

function text(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > limit || value.includes("\0"))
    return undefined;
  return value.trim() || undefined;
}

function uuid(value: unknown) {
  if (typeof value === "string" && categoryIdPattern.test(value))
    return value.toLowerCase();
}

function repairCost(raw: unknown) {
  const value = raw as Partial<MoneyInput> | null;
  if (
    !isSupplierCurrency(value?.currency) ||
    typeof value?.amount !== "string" ||
    !/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/.test(value.amount)
  )
    return undefined;
  return { amount: parseDecimal(value.amount, 4), currency: value.currency };
}

export function parseRepairCommand(
  value: unknown,
): { command: RepairCommand } | { field: string } {
  const raw = (value ?? {}) as Record<string, unknown>;
  const note = text(raw.note, 2000);
  if (raw.note !== undefined && !note) return { field: "note" };
  if (raw.action === "send") {
    const description = text(raw.description, 1000);
    if (!description) return { field: "description" };
    const supplierId = uuid(raw.supplierId);
    if (raw.supplierId !== undefined && !supplierId)
      return { field: "supplierId" };
    const repairerName = text(raw.repairerName, 120);
    if (supplierId ? raw.repairerName !== undefined : !repairerName)
      return { field: "repairerName" };
    if (!isSupplierDate(raw.sentDate)) return { field: "sentDate" };
    const expectedReturnDate = raw.expectedReturnDate;
    if (
      expectedReturnDate !== undefined &&
      (!isSupplierDate(expectedReturnDate) || expectedReturnDate < raw.sentDate)
    )
      return { field: "expectedReturnDate" };
    const estimatedCost = repairCost(raw.estimatedCost);
    if (raw.estimatedCost !== undefined && !estimatedCost)
      return { field: "estimatedCost" };
    return {
      command: {
        action: "send",
        description,
        supplierId,
        repairerName,
        sentDate: raw.sentDate,
        expectedReturnDate,
        estimatedCost,
        note,
      },
    };
  }
  const repairId = uuid(raw.repairId);
  if (!repairId) return { field: "repairId" };
  if (raw.action === "progress") {
    if (!note) return { field: "note" };
    return { command: { action: "progress", repairId, note } };
  }
  if (raw.action === "cancel")
    return { command: { action: "cancel", repairId, note } };
  if (raw.action === "pay") {
    if (raw.amount !== undefined || raw.currency !== undefined)
      return { field: "amount" };
    if (!isSupplierDate(raw.paymentDate)) return { field: "paymentDate" };
    const method = supplierPaymentMethods.find(
      (method) => method === raw.method,
    );
    if (!method) return { field: "method" };
    return {
      command: {
        action: "pay",
        repairId,
        paymentDate: raw.paymentDate,
        method,
      },
    };
  }
  if (raw.action !== "complete") return { field: "action" };
  if (!isSupplierDate(raw.completedDate)) return { field: "completedDate" };
  const weights = parseProductWeights(raw.weight, raw.netGoldWeight);
  if ("field" in weights) return weights;
  if (!weights.netGoldWeight) return { field: "netGoldWeight" };
  const groups = parseProductGemstones(raw.gemstones);
  if ("field" in groups) return groups;
  const actualCost = repairCost(raw.actualCost);
  if (!actualCost) return { field: "actualCost" };
  return {
    command: {
      action: "complete",
      repairId,
      completedDate: raw.completedDate,
      weight: weights.weight,
      netGoldWeight: weights.netGoldWeight,
      ...groups,
      actualCost,
      note,
    },
  };
}
