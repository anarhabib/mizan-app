import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { UserProfile } from "@mizan/contracts";
import { ApiError, apiRequest } from "@/shared/lib/api";

export function profileQuery(userId: string) {
  return queryOptions({
    queryKey: ["profile", userId] as const,
    queryFn: ({ signal }) => apiRequest<UserProfile>("/me/profile", { signal }),
    staleTime: 60_000,
  });
}

export function useSaveProfile(userId: string) {
  const client = useQueryClient();
  const options = profileQuery(userId);
  return useMutation({
    mutationFn: (fullName: string) =>
      apiRequest<UserProfile>("/me/profile", {
        method: "PATCH",
        body: { fullName },
      }),
    onSuccess: async (profile) => {
      await client.cancelQueries({ queryKey: options.queryKey, exact: true });
      client.setQueryData(options.queryKey, profile);
      const actorReads = client.getQueryCache().findAll({
        predicate: ({ queryKey: [feature, , , resource] }) =>
          (feature === "dashboard" && resource === "activity") ||
          (feature === "gold-prices" && resource === "history") ||
          (feature === "products" && resource === "detail") ||
          (feature === "sales" &&
            (resource === "list" || resource === "detail")) ||
          feature === "team",
      });
      await Promise.all(
        actorReads.map(({ queryKey }) =>
          client.invalidateQueries({ queryKey, exact: true }),
        ),
      );
    },
    onError: (error: ApiError) => {
      if (error.isNetwork)
        return client.invalidateQueries({
          queryKey: options.queryKey,
          exact: true,
        });
    },
  });
}
