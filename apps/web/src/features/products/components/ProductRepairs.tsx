import { useQuery } from "@tanstack/react-query";
import type {
  ProductDetail,
  RepairDetail,
  RepairMeasurements,
  RepairStatus,
} from "@mizan/contracts";
import { useId, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDate, formatPayable } from "@/features/suppliers";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { formatDateTime, formatDecimal } from "@/shared/lib/format";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { WeightText } from "@/shared/ui/WeightText";
import { repairDetailQuery, repairHistoryQuery } from "../api/repairs";
import type { ProductScope } from "../api/queries";

export type RepairEditorView =
  | { action: "send" }
  | {
      action: "complete" | "cancel" | "progress" | "pay";
      repair: RepairDetail;
    };

function RepairBadge({ status }: { status: RepairStatus }) {
  const { t } = useTranslation("products");
  return (
    <Badge
      variant={
        status === "ACTIVE"
          ? "warning"
          : status === "COMPLETED"
            ? "success"
            : "outline"
      }
    >
      {t(`repairs.status.${status}`)}
    </Badge>
  );
}

export function ProductRepairs({
  scope,
  product,
  owner,
  selected,
  onSelect,
  onEdit,
  headingRef,
}: {
  scope: ProductScope;
  product: ProductDetail;
  owner: boolean;
  selected?: string;
  onSelect: (id: string) => void;
  onEdit: (view: RepairEditorView) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const { t } = useTranslation("products");
  const historyId = useId();
  const [historyOpen, setHistoryOpen] = useState(false);
  const pagination = useCursorPagination(product.id);
  const underRepair = product.status === "IN_REPAIR";
  const firstPage = useQuery({
    ...repairHistoryQuery(scope, product.id, { limit: 10 }),
    enabled: underRepair,
  });
  const history = useQuery({
    ...repairHistoryQuery(scope, product.id, pagination.request),
    enabled: historyOpen,
  });
  const latest = firstPage.data?.items[0];
  const activeId =
    underRepair && latest?.status === "ACTIVE" ? latest.id : undefined;
  const detail = useQuery(
    repairDetailQuery(scope, product.id, selected ?? activeId),
  );
  const record = detail.data;
  return (
    <section
      aria-labelledby={`${historyId}-title`}
      className="grid min-w-0 gap-3 border-t pt-4"
    >
      <h3
        id={`${historyId}-title`}
        ref={headingRef}
        tabIndex={-1}
        className="font-medium"
      >
        {t("repairs.title")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {owner && product.status === "IN_STOCK" && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 lg:min-h-9"
            onClick={() => onEdit({ action: "send" })}
          >
            {t("repairs.actions.send")}
          </Button>
        )}
        {activeId && activeId !== selected && selected && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 lg:min-h-9"
            onClick={() => onSelect(activeId)}
          >
            {t("repairs.active")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 lg:min-h-9"
          aria-expanded={historyOpen}
          aria-controls={historyId}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          {t("repairs.history")}
        </Button>
      </div>
      <div id={historyId} hidden={!historyOpen} className="space-y-3">
        {historyOpen && (
          <>
            {history.isPending && <ListSkeleton rows={2} />}
            {history.isError && (
              <ErrorState
                error={history.error}
                pending={history.isFetching}
                retry={() => void history.refetch()}
              />
            )}
            {history.data &&
              (history.data.items.length ? (
                <>
                  <ul className="grid gap-2">
                    {history.data.items.map((item) => (
                      <li key={item.id}>
                        <Button
                          type="button"
                          variant="outline"
                          aria-pressed={item.id === record?.id}
                          className="h-auto min-h-11 w-full flex-wrap justify-between gap-2 px-3 py-2 text-left whitespace-normal lg:min-h-9"
                          onClick={() => onSelect(item.id)}
                        >
                          <span className="min-w-0 flex-1 wrap-anywhere">
                            <span className="block">{item.description}</span>
                            <span className="text-xs text-muted-foreground">
                              <CalendarDate value={item.sentDate} />
                            </span>
                          </span>
                          <RepairBadge status={item.status} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {(pagination.page > 1 || history.data.nextCursor) && (
                    <CursorPagination
                      pagination={pagination}
                      nextCursor={history.data.nextCursor}
                      pending={history.isFetching}
                      label={t("repairs.history")}
                    />
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{t("repairs.empty")}</p>
              ))}
          </>
        )}
      </div>
      {underRepair && firstPage.isPending && !selected && (
        <ListSkeleton rows={2} />
      )}
      {underRepair && firstPage.isError && !selected && (
        <ErrorState
          error={firstPage.error}
          pending={firstPage.isFetching}
          retry={() => void firstPage.refetch()}
        />
      )}
      {(selected || activeId) && detail.isPending && <ListSkeleton rows={2} />}
      {detail.isError && (
        <ErrorState
          error={detail.error}
          pending={detail.isFetching}
          retry={() => void detail.refetch()}
        />
      )}
      {record && (
        <RepairRecord repair={record} onEdit={owner ? onEdit : undefined} />
      )}
    </section>
  );
}

function RepairRecord({
  repair,
  onEdit,
}: {
  repair: RepairDetail;
  onEdit?: (view: RepairEditorView) => void;
}) {
  const { t, i18n } = useTranslation(["products", "sales", "auth"]);
  const financial = repair.financial;
  const locale = i18n.resolvedLanguage ?? "az";
  const charge = Boolean(
    financial?.actualCost && /[1-9]/.test(financial.actualCost.amount),
  );
  return (
    <article className="grid min-w-0 gap-4 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 font-medium wrap-anywhere whitespace-pre-wrap">
          {repair.description}
        </h4>
        <RepairBadge status={repair.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 wrap-anywhere">
        <div>
          <dt className="text-muted-foreground">{t("repairs.repairer")}</dt>
          <dd>{repair.repairerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("repairs.sentDate")}</dt>
          <dd>
            <CalendarDate value={repair.sentDate} />
          </dd>
        </div>
        {repair.expectedReturnDate && (
          <div>
            <dt className="text-muted-foreground">
              {t("repairs.expectedReturnDate")}
            </dt>
            <dd>
              <CalendarDate value={repair.expectedReturnDate} />
            </dd>
          </div>
        )}
        {repair.completedDate && (
          <div>
            <dt className="text-muted-foreground">
              {t("repairs.completedDate")}
            </dt>
            <dd>
              <CalendarDate value={repair.completedDate} />
            </dd>
          </div>
        )}
      </dl>
      <div className={repair.after ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
        <RepairMeasurementSnapshot
          label={t("repairs.before")}
          measurement={repair.before}
        />
        {repair.after && (
          <RepairMeasurementSnapshot
            label={t("repairs.after")}
            measurement={repair.after}
          />
        )}
      </div>
      {financial && (
        <dl className="grid grid-cols-2 gap-3 wrap-anywhere">
          <div>
            <dt className="text-muted-foreground">
              {t("repairs.estimatedCost")}
            </dt>
            <dd className="tabular-nums">
              {financial.estimatedCost
                ? formatPayable(financial.estimatedCost, locale)
                : "—"}
            </dd>
          </div>
          {financial.actualCost && (
            <>
              <div>
                <dt className="text-muted-foreground">
                  {t("repairs.actualCost")}
                </dt>
                <dd className="tabular-nums">
                  {formatPayable(financial.actualCost, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("repairs.paymentStatus")}
                </dt>
                <dd>
                  <Badge
                    variant={
                      financial.payment
                        ? "success"
                        : charge
                          ? "warning"
                          : "outline"
                    }
                  >
                    {t(
                      financial.payment
                        ? "repairs.paid"
                        : charge
                          ? "repairs.unpaid"
                          : "repairs.noCharge",
                    )}
                  </Badge>
                </dd>
              </div>
              {financial.payment && (
                <div>
                  <dt className="text-muted-foreground">
                    {t(`methods.${financial.payment.method}`, { ns: "sales" })}
                  </dt>
                  <dd>
                    <CalendarDate value={financial.payment.date} />
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      )}
      <ol className="grid gap-2 border-t pt-3">
        {repair.events.map(({ id, kind, note, actorName, createdAt }) => (
          <li key={id} className="border-s-2 ps-3 wrap-anywhere">
            <span className="font-medium">{t(`repairs.events.${kind}`)}</span>
            <div className="text-xs text-muted-foreground">
              <time dateTime={createdAt}>
                {formatDateTime(createdAt, locale)}
              </time>
              {" · "}
              {actorName ?? t("unknownActor", { ns: "auth" })}
            </div>
            {note && <p className="mt-1 whitespace-pre-wrap">{note}</p>}
          </li>
        ))}
      </ol>
      {onEdit && repair.status === "ACTIVE" && (
        <div className="flex flex-wrap gap-2">
          {(["complete", "progress", "cancel"] as const).map((action) => (
            <Button
              type="button"
              key={action}
              variant={action === "complete" ? "default" : "outline"}
              className="min-h-11 lg:min-h-9"
              onClick={() => onEdit({ action, repair })}
            >
              {t(`repairs.actions.${action}`)}
            </Button>
          ))}
        </div>
      )}
      {onEdit &&
        repair.status === "COMPLETED" &&
        charge &&
        !financial?.payment && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-self-start lg:min-h-9"
            onClick={() => onEdit({ action: "pay", repair })}
          >
            {t("repairs.actions.pay")}
          </Button>
        )}
    </article>
  );
}

export function RepairMeasurementSnapshot({
  label,
  measurement,
}: {
  label: string;
  measurement: RepairMeasurements;
}) {
  const { t, i18n } = useTranslation("products");
  const locale = i18n.resolvedLanguage ?? "az";
  return (
    <section className="grid min-w-0 content-start gap-2 rounded-md border bg-muted/40 p-2 wrap-anywhere">
      <h5 className="font-medium">{label}</h5>
      <dl className="grid gap-2">
        <div>
          <dt className="text-muted-foreground">{t("fields.weight")}</dt>
          <dd>
            <WeightText value={measurement.weight} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.netGoldWeight")}</dt>
          <dd>
            {measurement.netGoldWeight ? (
              <WeightText value={measurement.netGoldWeight} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("jewelry.gemstones")}</dt>
          <dd>
            {measurement.gemstones.length ? (
              <ul className="grid gap-1">
                {measurement.gemstones.map((group, index) => (
                  <li key={index}>
                    <details>
                      <summary className="min-h-10 cursor-pointer content-center lg:min-h-8">
                        {group.gemstoneType} × {group.stoneCount}
                        {group.totalCarats && (
                          <>
                            {" "}
                            ·{" "}
                            {t("jewelry.carats", {
                              amount: formatDecimal(group.totalCarats, locale),
                            })}
                          </>
                        )}
                      </summary>
                      <dl className="grid gap-1 pb-2">
                        <div>
                          <dt className="text-muted-foreground">
                            {t("jewelry.stoneFields.origin")}
                          </dt>
                          <dd>
                            {t(`jewelry.origins.${group.origin ?? "UNKNOWN"}`)}
                          </dd>
                        </div>
                        {(
                          [
                            "individualCarats",
                            "shape",
                            "color",
                            "clarity",
                            "cutGrade",
                            "treatment",
                            "laboratory",
                            "reportNumber",
                            "note",
                          ] as const
                        ).map((field) => {
                          const value = group[field];
                          return (
                            value && (
                              <div key={field}>
                                <dt className="text-muted-foreground">
                                  {t(`jewelry.stoneFields.${field}`)}
                                </dt>
                                <dd>
                                  {field === "individualCarats"
                                    ? t("jewelry.carats", {
                                        amount: formatDecimal(value, locale),
                                      })
                                    : value}
                                </dd>
                              </div>
                            )
                          );
                        })}
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
