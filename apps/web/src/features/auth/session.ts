import { createContext, useContext } from "react";

export interface SessionState {
  userId: string | null;
  email: string | null;
  ready: boolean;
  recovery: boolean;
  finishRecovery: () => void;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required");
  return session;
}
