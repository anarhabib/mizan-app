import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import {
  ApiError,
  setAccessTokenGetter,
  setOnUnauthorized,
} from "@/shared/lib/api";
import { auth } from "@/shared/lib/auth";
import { SessionContext } from "./session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(!auth);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const client = auth;
    let current: Session | null = null;
    let refresh:
      { generation: number; promise: Promise<string | null> } | undefined;
    // An auth response for an earlier account must never be replayed as a new account.
    let accountGeneration = 0;

    const {
      data: { subscription },
    } = client.onAuthStateChange((event, session) => {
      if (current?.user.id !== session?.user.id || event === "SIGNED_OUT") {
        accountGeneration++;
        queryClient.clear();
      }
      current = session;
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      setReady(true);
    });

    setAccessTokenGetter(() =>
      current
        ? { token: current.access_token, generation: accountGeneration }
        : null,
    );

    setOnUnauthorized(async (_error, credentials, retried) => {
      if (
        !current ||
        !credentials ||
        typeof credentials === "string" ||
        credentials.generation !== accountGeneration
      )
        return;
      const { token } = credentials;
      if (retried) {
        if (current.access_token === token)
          await client.signOut({ scope: "local" });
        return;
      }
      if (current.access_token !== token) return current.access_token;
      const generation = accountGeneration;
      if (refresh?.generation === generation) return refresh.promise;
      const promise = (async () => {
        const { data, error } = await client.refreshSession();
        if (generation !== accountGeneration) return null;
        if (data.session && !error) return data.session.access_token;
        if (
          error &&
          (!error.status || error.status >= 500 || error.status === 429)
        ) {
          throw new ApiError(
            503,
            "AUTH_UNAVAILABLE",
            "Authentication is unavailable",
          );
        }
        await client.signOut({ scope: "local" });
        return null;
      })().finally(() => {
        if (refresh?.generation === generation) refresh = undefined;
      });
      refresh = { generation, promise };
      return promise;
    });

    return () => {
      subscription.unsubscribe();
      setAccessTokenGetter(() => null);
      setOnUnauthorized(() => {});
    };
  }, [queryClient]);

  return (
    <SessionContext
      value={{
        userId,
        email,
        ready,
        recovery,
        finishRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </SessionContext>
  );
}
