import {
  ArrowDownLeft,
  ContactRound,
  PackagePlus,
  ReceiptText,
  Search,
  Settings,
} from "lucide-react";

const actions = [
  {
    id: "sale",
    label: "recordSale",
    icon: ReceiptText,
    link: { to: "/products", search: { intent: "sale" } },
  },
  {
    id: "product",
    label: "products:create",
    icon: PackagePlus,
    link: { to: "/products", search: { intent: "create" } },
  },
  {
    id: "find",
    label: "find",
    icon: Search,
    link: { to: "/products", hash: "product-search" },
  },
  {
    id: "customer",
    label: "customers:create",
    icon: ContactRound,
    link: { to: "/customers", search: { create: true } },
  },
  {
    id: "debtors",
    label: "viewDebtors",
    icon: ArrowDownLeft,
    link: { to: "/customers", search: { outstanding: true } },
  },
  {
    id: "pricing",
    label: "pricingSettings",
    icon: Settings,
    link: { to: "/settings", hash: "gold-pricing" },
    ownerOnly: true,
  },
] as const;

export function availableQuickActions(owner: boolean) {
  return actions.filter((action) => !("ownerOnly" in action) || owner);
}

export function visibleQuickActionCount(
  widths: readonly number[],
  available: number,
  gap: number,
  overflow: number,
) {
  const all =
    widths.reduce((total, width) => total + width, 0) +
    Math.max(0, widths.length - 1) * gap;
  if (all <= available) return widths.length;
  let taken = overflow;
  for (const [index, width] of widths.entries()) {
    taken += width + gap;
    if (taken > available) return index;
  }
  return widths.length;
}
