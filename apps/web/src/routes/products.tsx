import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/shared/ui/PlaceholderPage";
export const Route = createFileRoute("/products")({
  component: () => <PlaceholderPage namespace="products" />,
});
