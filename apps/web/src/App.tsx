import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { AppProviders } from "./app/providers";
import "./shared/lib/i18n";
import { captureInvitationLink } from "./features/workspace";
captureInvitationLink();
const router = createRouter({
  routeTree,
  defaultPendingComponent: ListSkeleton,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
