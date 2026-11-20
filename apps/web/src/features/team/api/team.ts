import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  InvitationDelivery,
  InvitationSummary,
  MembershipDirectory,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";

export type TeamScope = Pick<StoreContext, "organizationId" | "storeId">;

export type TeamAction =
  | { kind: "invite"; email: string; storeId: string }
  | { kind: "revoke" | "resend"; invitationId: string }
  | { kind: "deactivate" | "reactivate"; userId: string }
  | { kind: "assign" | "remove"; userId: string; storeId: string };

const organizationPath = ({ organizationId }: TeamScope) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

export const teamKeys = {
  directory: ({ organizationId, storeId }: TeamScope) =>
    ["team", organizationId, storeId, "directory"] as const,
};

export function teamDirectoryQuery(scope: TeamScope) {
  return queryOptions<MembershipDirectory, ApiError>({
    queryKey: teamKeys.directory(scope),
    queryFn: ({ signal }) =>
      apiRequest<MembershipDirectory>(
        `${organizationPath(scope)}/memberships`,
        {
          signal,
        },
      ),
    refetchOnMount: "always",
  });
}

// The invitation endpoints expose delivery alongside the summary (API_NOTES.md).
type InvitationResponse = InvitationSummary & { delivery: InvitationDelivery };

export async function applyTeamAction(scope: TeamScope, action: TeamAction) {
  const path = organizationPath(scope);
  const post = { method: "POST" };
  switch (action.kind) {
    case "invite": {
      const { email, storeId } = action;
      const result = await apiRequest<InvitationResponse>(
        `${path}/invitations`,
        {
          ...post,
          body: { email, storeId },
        },
      );
      return result.delivery;
    }
    case "revoke":
    case "resend": {
      const id = encodeURIComponent(action.invitationId);
      const result = await apiRequest<InvitationResponse>(
        `${path}/invitations/${id}/${action.kind}`,
        post,
      );
      return result.delivery;
    }
    case "deactivate":
    case "reactivate":
      await apiRequest<unknown>(
        `${path}/members/${encodeURIComponent(action.userId)}/${action.kind}`,
        post,
      );
      break;
    case "assign":
    case "remove":
      await apiRequest<unknown>(
        `${path}/members/${encodeURIComponent(action.userId)}/stores/${encodeURIComponent(action.storeId)}/${action.kind}`,
        post,
      );
  }
}

export function useTeamAction(scope: TeamScope) {
  const client = useQueryClient();
  return useMutation<InvitationDelivery | undefined, ApiError, TeamAction>({
    retry: false,
    mutationFn: (action) => applyTeamAction(scope, action),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: teamKeys.directory(scope),
        exact: true,
      }),
  });
}
