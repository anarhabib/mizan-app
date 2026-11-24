import { useSession } from "@/features/auth";
import type { SupplierScope } from "../api/queries";
import { submitFinancialAttempt } from "./financial";

export function useFinancialAttempt<T>(
  scope: SupplierScope,
  operation: string,
) {
  const { userId } = useSession();
  const partition = [
    userId,
    scope.organizationId,
    scope.storeId,
    operation,
  ].join("/");
  return <Result>(
    body: T,
    send: (attempt: { body: T; key: string }) => Promise<Result>,
  ) => submitFinancialAttempt(partition, body, send);
}
