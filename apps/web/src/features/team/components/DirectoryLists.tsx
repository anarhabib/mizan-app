import type { MembershipDirectory } from "@mizan/contracts";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/shared/lib/format";
import { ConfirmAction } from "./ConfirmAction";
import { AssignStoreForm, type RunTeamAction } from "./TeamForms";

export function DirectoryLists({
  directory: { members, invitations, stores },
  busy,
  run,
}: {
  directory: MembershipDirectory;
  busy: boolean;
  run: RunTeamAction;
}) {
  const { t, i18n } = useTranslation("team");
  const storeNames = new Map(stores.map(({ id, name }) => [id, name]));
  const storeName = (id: string) => storeNames.get(id) ?? t("unknownStore");
  const pendingInvitations = invitations.filter(
    ({ status }) => status === "pending",
  );
  return (
    <>
      <section aria-labelledby="team-members" className="grid gap-3">
        <h2 id="team-members" className="font-heading text-base font-semibold">
          {t("members")}
        </h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground">{t("noMembers")}</p>
        ) : (
          <ul className="divide-y">
            {members.map(({ userId, email, status, storeIds }) => {
              const displayName = email ?? t("unknownEmail");
              const availableStores = stores.filter(
                ({ id }) => !storeIds.includes(id),
              );
              return (
                <li key={userId} className="grid gap-3 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="font-medium wrap-anywhere">
                        {displayName}
                      </h3>
                      <Badge
                        variant={status === "active" ? "success" : "danger"}
                      >
                        {t(`status.${status}`)}
                      </Badge>
                    </div>
                    {status === "active" ? (
                      <ConfirmAction
                        kind="deactivate"
                        target={displayName}
                        busy={busy}
                        onConfirm={(onError) =>
                          run({ kind: "deactivate", userId }, onError)
                        }
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        disabled={busy}
                        className="min-h-11 lg:min-h-8"
                        onClick={() => void run({ kind: "reactivate", userId })}
                      >
                        <RotateCcw aria-hidden="true" />
                        {t("actions.reactivate")}
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <p className="text-muted-foreground">
                      {t("assignedStores")}
                    </p>
                    {storeIds.length === 0 ? (
                      <p>{t("noAssignedStores")}</p>
                    ) : (
                      <ul className="grid gap-2">
                        {storeIds.map((storeId) => (
                          <li
                            key={storeId}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="wrap-anywhere">
                              {storeName(storeId)}
                            </span>
                            <ConfirmAction
                              kind="remove"
                              target={t("assignment", {
                                email: displayName,
                                store: storeName(storeId),
                              })}
                              busy={busy}
                              onConfirm={(onError) =>
                                run(
                                  { kind: "remove", userId, storeId },
                                  onError,
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {availableStores.length > 0 && (
                    <AssignStoreForm
                      stores={availableStores}
                      userId={userId}
                      busy={busy}
                      run={run}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="team-invitations" className="grid gap-3">
        <h2
          id="team-invitations"
          className="font-heading text-base font-semibold"
        >
          {t("invitations")}
        </h2>
        {pendingInvitations.length === 0 ? (
          <p className="text-muted-foreground">{t("noInvitations")}</p>
        ) : (
          <ul className="divide-y">
            {pendingInvitations.map(({ id, email, storeId, expiresAt }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium wrap-anywhere">{email}</h3>
                    <Badge variant="warning">{t("status.pending")}</Badge>
                  </div>
                  <p className="text-muted-foreground wrap-anywhere">
                    {storeName(storeId)}
                  </p>
                  <p className="text-muted-foreground">
                    {t("expires")}{" "}
                    <time dateTime={expiresAt} className="tabular-nums">
                      {formatDateTime(expiresAt, i18n.resolvedLanguage)}
                    </time>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ConfirmAction
                    kind="resend"
                    target={email}
                    busy={busy}
                    onConfirm={(onError) =>
                      run({ kind: "resend", invitationId: id }, onError)
                    }
                  />
                  <ConfirmAction
                    kind="revoke"
                    target={email}
                    busy={busy}
                    onConfirm={(onError) =>
                      run({ kind: "revoke", invitationId: id }, onError)
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="team-stores" className="grid gap-3">
        <h2 id="team-stores" className="font-heading text-base font-semibold">
          {t("stores")}
        </h2>
        {stores.length === 0 ? (
          <p className="text-muted-foreground">{t("noStores")}</p>
        ) : (
          <ul className="grid gap-2">
            {stores.map(({ id, name }) => (
              <li key={id} className="wrap-anywhere">
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
