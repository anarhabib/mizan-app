import { lazy } from "react";

export const SuppliersPage = lazy(() =>
  import("./components/SuppliersPage").then(({ SuppliersPage }) => ({
    default: SuppliersPage,
  })),
);
export { SupplierPicker } from "./components/SupplierPicker";
export {
  refreshSupplierProductStatus,
  useRegisterPurchase,
} from "./api/queries";
export { todayInBaku } from "./lib/financial";
export { useFinancialAttempt } from "./lib/useFinancialAttempt";
