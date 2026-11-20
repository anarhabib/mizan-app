import { createFileRoute } from "@tanstack/react-router";
import { RecoveryPage } from "@/features/auth";

export const Route = createFileRoute("/auth/callback")({
  component: RecoveryPage,
});
