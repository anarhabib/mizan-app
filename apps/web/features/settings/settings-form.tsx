"use client";
import { useActionState, type ReactNode } from "react";
import type { Locale } from "../language/messages";
import { updateSettings } from "./settings-actions";
import { settingsCopy } from "./settings-copy";
import { Button } from "../../components/ui/button";

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
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {pending ? settingsCopy[locale].saving : label}
      </Button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
    </form>
  );
}
