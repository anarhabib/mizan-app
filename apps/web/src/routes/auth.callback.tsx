import { createFileRoute } from "@tanstack/react-router";
import { AuthCallback } from "@/features/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});
