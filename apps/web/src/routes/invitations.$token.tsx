import { createFileRoute, redirect } from "@tanstack/react-router";
import { rememberInvitationToken } from "@/features/workspace";

export const Route = createFileRoute("/invitations/$token")({
  beforeLoad: ({ params, preload }) => {
    if (!preload) rememberInvitationToken(params.token);
    throw redirect({ to: "/invitations/accept", replace: true });
  },
});
