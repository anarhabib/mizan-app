import { queryOptions } from "@tanstack/react-query";
import type {
  OnboardingRequest,
  OnboardingResult,
  OrganizationSettings,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest } from "@/shared/lib/api";
import type { StoreScope } from "./selection";

// API_NOTES.md defines the access payload alongside the shared StoreContext.
type StoreAccess = StoreScope & {
  userId: string;
  role: StoreContext["role"];
  settings: OrganizationSettings;
};

export function storeQueryKey(scope: StoreScope) {
  return ["store", scope.organizationId, scope.storeId] as const;
}

export function contextsQuery(userId: string) {
  return queryOptions({
    queryKey: ["workspace", "contexts", userId] as const,
    queryFn: ({ signal }) =>
      apiRequest<StoreContext[]>("/me/contexts", { signal }),
  });
}

export function accessQuery(userId: string, scope: StoreScope) {
  return queryOptions({
    queryKey: [...storeQueryKey(scope), "workspace", "access", userId] as const,
    queryFn: ({ signal }) =>
      apiRequest<StoreAccess>(
        `/organizations/${encodeURIComponent(scope.organizationId)}/stores/${encodeURIComponent(scope.storeId)}/access`,
        { signal },
      ),
  });
}

export function createWorkspace(body: OnboardingRequest) {
  return apiRequest<OnboardingResult>("/onboarding", { method: "POST", body });
}
