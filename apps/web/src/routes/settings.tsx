import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/shared/ui/PlaceholderPage";
export const Route = createFileRoute("/settings")({
  component: () => <PlaceholderPage namespace="settings" />,
});
