import type { SalePaymentStatus } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function SalePaymentStatusBadge({
  status,
}: {
  status: SalePaymentStatus;
}) {
  const { t } = useTranslation("sales");
  return (
    <Badge variant={status === "PAID" ? "success" : "warning"}>
      {t(`paymentStatus.${status}`)}
    </Badge>
  );
}
