"use client";
import { useActionState, type ReactNode } from "react";
import type { Locale } from "../language/messages";
import { updateSettings } from "./settings-actions";
import { settingsCopy } from "./settings-copy";

export const settingsPanel =
  "rounded-2xl border border-solid border-mizan-edge bg-mizan-surface p-4 sm:p-5";

export function SettingsForm({
  organizationId,
  locale,
  intent,
  label,
  children,
}: {
  organizationId: string;
  locale: Locale;
  intent: string;
  label: string;
  children?: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(
    updateSettings.bind(null, organizationId),
    {},
  );
  return (
    <form action={dispatch}>
      <input type="hidden" name="intent" value={intent} />
      {children}
      <button className="justify-self-start" disabled={pending}>
        {pending ? settingsCopy[locale].saving : label}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
    </form>
  );
}
