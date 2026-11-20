import { createContext, useContext } from "react";
import type { OrganizationSettings, StoreContext } from "@mizan/contracts";
import type { StoreScope } from "./selection";

export const WorkspaceContext = createContext<
  | (StoreContext & {
      settings: OrganizationSettings;
      salespersonDisplay?: true;
      contexts: StoreContext[];
      selectStore: (scope: StoreScope) => void;
    })
  | null
>(null);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  const canSwitchDisplayMode = workspace.role === "OWNER";
  const canManageAsOwner =
    canSwitchDisplayMode && !workspace.salespersonDisplay;
  return {
    ...workspace,
    canSwitchDisplayMode,
    canManageAsOwner,
    canViewAcquisition:
      !workspace.salespersonDisplay &&
      (canManageAsOwner ||
        workspace.settings.salespersonCanViewAcquisitionCost),
  };
}
