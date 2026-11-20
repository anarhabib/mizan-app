import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/features/team";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});
