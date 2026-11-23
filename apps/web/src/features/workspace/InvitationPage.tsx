import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthPanel, SignOutButton, useSession } from "@/features/auth";
import { ApiError, apiRequest } from "@/shared/lib/api";
import { ErrorState } from "@/shared/ui/ErrorState";
import { contextsQuery } from "./api";
import { clearInvitationToken, getInvitationToken } from "./invitation-link";

export function InvitationPage({ userId }: { userId: string }) {
  const { t } = useTranslation(["workspace", "errors"]);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const token = getInvitationToken();
      if (!token) throw new ApiError(409, "INVITATION_UNAVAILABLE", "");
      await apiRequest<unknown>("/invitations/accept", {
        method: "POST",
        body: { token },
      });
    },
    onSuccess: () => {
      clearInvitationToken();
      toast.success(t("invitationAccepted"));
      return queryClient.invalidateQueries({
        queryKey: contextsQuery(userId).queryKey,
        exact: true,
      });
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.code === "INVITATION_UNAVAILABLE")
        clearInvitationToken();
      if (error instanceof ApiError && error.isNetwork) {
        await queryClient
          .fetchQuery({ ...contextsQuery(userId), staleTime: 0 })
          .catch(() => undefined);
      }
    },
  });

  return (
    <AuthPanel title={t("invitation")}>
      {mutation.isSuccess ? (
        <p role="status">{t("invitationAccepted")}</p>
      ) : !getInvitationToken() && !mutation.isPending ? (
        <p role="alert">{t("INVITATION_UNAVAILABLE", { ns: "errors" })}</p>
      ) : mutation.error instanceof ApiError ? (
        <ErrorState
          error={mutation.error}
          retry={() => mutation.mutate()}
          pending={mutation.isPending}
        />
      ) : (
        <PendingButton
          pending={mutation.isPending}
          className="min-h-11 lg:min-h-9"
          onClick={() => mutation.mutate()}
        >
          {t(mutation.isPending ? "acceptingInvitation" : "acceptInvitation")}
        </PendingButton>
      )}
      <Link
        to="/products"
        className="self-start underline"
        onClick={clearInvitationToken}
      >
        {t("openWorkspace")}
      </Link>
      <div className="self-start">
        <SignOutButton />
      </div>
    </AuthPanel>
  );
}

export function InvitationRoute() {
  const { userId } = useSession();
  return userId && <InvitationPage key={userId} userId={userId} />;
}
