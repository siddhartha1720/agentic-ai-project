import { createContext, useContext } from "react";

export const AppShellContext = createContext({
  pendingApprovalCount: 0,
  refreshPendingApprovals: async () => {},
});

export function useAppShell() {
  return useContext(AppShellContext);
}
