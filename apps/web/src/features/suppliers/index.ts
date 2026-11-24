import { lazy } from "react";

export const SuppliersPage = lazy(() =>
  import("./components/SuppliersPage").then(({ SuppliersPage }) => ({
    default: SuppliersPage,
  })),
);
export { SupplierPicker } from "./components/SupplierPicker";
export { CalendarDate, PurchaseStatus } from "./components/ledger";
export {
  refreshSupplierProductStatus,
  refreshSupplierActivity,
  refreshSupplierPurchase,
  useRegisterPurchase,
} from "./api/queries";
export { formatPayable, todayInBaku } from "./lib/financial";
export { useFinancialAttempt } from "./lib/useFinancialAttempt";
