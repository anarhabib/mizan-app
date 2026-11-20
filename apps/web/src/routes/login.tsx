import { createFileRoute } from "@tanstack/react-router";
import { AuthPage, safeReturnPath } from "@/features/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnPath(search.returnTo),
  }),
  component: Login,
});

function Login() {
  const { returnTo } = Route.useSearch();
  return <AuthPage returnTo={returnTo} />;
}
