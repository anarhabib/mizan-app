import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { ApiError } from "@/shared/lib/api";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PageHeader } from "@/shared/ui/PageHeader";
import { teamDirectoryQuery, useTeamAction, type TeamScope } from "../api/team";
import { teamErrorKey } from "../lib/errors";
import { DirectoryLists } from "./DirectoryLists";
import { InviteForm, type RunTeamAction } from "./TeamForms";

export function TeamPage() {
  const workspace = useWorkspace();
  const { t } = useTranslation("team");
  return (
    <>
      <PageHeader title={t("title")} />
      {workspace.canManageAsOwner ? (
        <OwnerTeam
          key={JSON.stringify([workspace.organizationId, workspace.storeId])}
          scope={workspace}
        />
      ) : (
        <p role="alert" className="rounded-lg border border-border bg-card p-6">
          {t("errors.accessDenied")}
        </p>
      )}
    </>
  );
}

function OwnerTeam({ scope }: { scope: TeamScope }) {
  const { t } = useTranslation("team");
  const directory = useQuery(teamDirectoryQuery(scope));
  const mutation = useTeamAction(scope);
  const running = useRef(false);
  const run: RunTeamAction = async (action) => {
    if (running.current) return false;
    running.current = true;
    try {
      const delivery = await mutation.mutateAsync(action);
      if (delivery === "failed") toast.warning(t("delivery.failed"));
      else if (delivery) toast.success(t(`delivery.${delivery}`));
      else toast.success(t("updated"));
      return true;
    } catch (error) {
      toast.error(
        t(error instanceof ApiError ? teamErrorKey(error) : "errors.generic"),
      );
      return false;
    } finally {
      running.current = false;
    }
  };

  if (directory.isPending) return <ListSkeleton rows={3} />;
  if (directory.isError) {
    return (
      <div className="grid justify-items-start gap-3 rounded-lg border border-border bg-card p-6">
        <p role="alert">{t(teamErrorKey(directory.error))}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void directory.refetch()}
          disabled={directory.isFetching || mutation.isPending}
          className="min-h-11 lg:min-h-8"
        >
          <RotateCw aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
        <InviteForm
          stores={directory.data.stores}
          currentStoreId={scope.storeId}
          busy={mutation.isPending}
          run={run}
        />
      </div>
      <div className="grid gap-6 [&>section]:rounded-lg [&>section]:border [&>section]:border-border [&>section]:bg-card [&>section]:p-4 lg:col-span-2 lg:grid-cols-subgrid lg:[&>section:first-child]:row-span-2">
        <DirectoryLists
          directory={directory.data}
          busy={mutation.isPending}
          run={run}
        />
      </div>
      <span role="status" className="sr-only">
        {mutation.isPending ? t("saving") : ""}
      </span>
    </div>
  );
}
