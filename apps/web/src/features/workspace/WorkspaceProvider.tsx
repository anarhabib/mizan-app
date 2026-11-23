import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { StoreContext } from "@mizan/contracts";
import { AuthPanel, SignOutButton } from "@/features/auth";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/shared/lib/api";
import { ErrorState } from "@/shared/ui/ErrorState";
import { accessQuery, contextsQuery } from "./api";
import { WorkspaceContext } from "./context";
import {
  pendingSalespersonDisplay,
  restrictDisplay,
  watchDisplayModeChanges,
} from "./display-mode";
import { OnboardingForm } from "./OnboardingForm";
import {
  readSelection,
  resolveSelection,
  saveSelection,
  type StoreScope,
} from "./selection";
import { StoreSwitcher } from "./StoreSwitcher";

export function WorkspaceProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState(() => readSelection(userId));
  const [pendingMode, setPendingMode] = useState(() =>
    pendingSalespersonDisplay(userId),
  );
  const resumeMode = useMutation({
    mutationFn: (scope: StoreScope) => restrictDisplay(userId, scope),
    onSuccess: () => setPendingMode(null),
  });
  const { mutate: resumeRestriction } = resumeMode;
  useEffect(() => {
    if (pendingMode) resumeRestriction(pendingMode);
  }, [pendingMode, resumeRestriction]);

  const contexts = useQuery(contextsQuery(userId));
  const active = contexts.data && resolveSelection(contexts.data, selection);
  useEffect(
    () =>
      watchDisplayModeChanges(userId, () => {
        document.documentElement.style.display = "none";
        queryClient.clear();
        window.location.reload();
      }),
    [queryClient, userId],
  );

  function selectStore(scope: StoreScope) {
    setSelection(scope);
  }

  if (pendingMode && resumeMode.isError)
    return (
      <WorkspaceError
        error={resumeMode.error}
        retry={() => resumeRestriction(pendingMode)}
        pending={resumeMode.isPending}
      />
    );
  if (pendingMode) return <WorkspaceLoading />;
  if (contexts.isError) {
    return (
      <WorkspaceError
        error={contexts.error}
        retry={() => void contexts.refetch()}
        pending={contexts.isFetching}
      />
    );
  }
  if (!contexts.data) return <WorkspaceLoading />;
  if (!active) {
    return (
      <OnboardingForm
        onCreated={selectStore}
        reloadContexts={() => contexts.refetch()}
      />
    );
  }
  return (
    <SelectedWorkspace
      userId={userId}
      active={active}
      contexts={contexts.data}
      selectStore={selectStore}
      reloadContexts={async () => {
        await contexts.refetch();
      }}
    >
      {children}
    </SelectedWorkspace>
  );
}

function SelectedWorkspace({
  userId,
  active,
  contexts,
  children,
  selectStore,
  reloadContexts,
}: {
  userId: string;
  active: StoreContext;
  contexts: StoreContext[];
  children: ReactNode;
  selectStore: (scope: StoreScope) => void;
  reloadContexts: () => Promise<void>;
}) {
  const access = useQuery(accessQuery(userId, active));
  const { organizationId, storeId } = active;
  useEffect(() => {
    saveSelection(userId, { organizationId, storeId });
  }, [userId, organizationId, storeId]);

  if (access.isError) {
    return (
      <WorkspaceError
        error={access.error}
        pending={access.isFetching}
        retry={() =>
          void (async () => {
            await reloadContexts();
            await access.refetch();
          })()
        }
      >
        <StoreSwitcher
          active={active}
          contexts={contexts}
          onSelect={selectStore}
        />
      </WorkspaceError>
    );
  }
  if (!access.data) return <WorkspaceLoading />;
  return (
    <WorkspaceContext
      value={{
        ...active,
        role: access.data.role,
        salespersonDisplay: access.data.salespersonDisplay,
        settings: access.data.settings,
        contexts,
        selectStore,
      }}
    >
      {children}
    </WorkspaceContext>
  );
}

export function WorkspaceLoading() {
  const { t } = useTranslation("workspace");
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 150);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <span className="sr-only">{t("loading")}</span>
      {show && (
        <Spinner
          role="presentation"
          aria-hidden="true"
          className="size-8 text-brand-accent motion-reduce:animate-none"
        />
      )}
    </div>
  );
}

function WorkspaceError({
  error,
  retry,
  pending,
  children,
}: {
  error: Error;
  retry: () => void;
  pending: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation("workspace");
  return (
    <AuthPanel title={t("title")}>
      <ErrorState
        error={
          error instanceof ApiError
            ? error
            : new ApiError(500, "INTERNAL_ERROR", "")
        }
        retry={retry}
        pending={pending}
      />
      {children}
      <div className="self-start">
        <SignOutButton />
      </div>
    </AuthPanel>
  );
}
