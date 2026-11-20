import { createFileRoute } from "@tanstack/react-router";
import { InvitationRoute } from "@/features/workspace";

export const Route = createFileRoute("/invitations/accept")({
  component: InvitationRoute,
});
