"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "../../components/ui/button";
import { Feedback } from "../../components/ui/feedback";
import { Field } from "../../components/ui/field";
import { messages, type Locale } from "../language/messages";
import { submitSignIn } from "./owner-actions";

export function SignInFields({
  locale,
  email,
  error,
  pending = false,
}: {
  locale: Locale;
  email?: string;
  error?: string;
  pending?: boolean;
}) {
  const copy = messages[locale];
  const [visible, setVisible] = useState(false);
  const PasswordIcon = visible ? EyeOff : Eye;
  return (
    <>
      {error && <Feedback error>{error}</Feedback>}
      <Field
        id="signin-email"
        name="email"
        label={copy.email}
        type="email"
        autoComplete="email"
        defaultValue={email}
        maxLength={254}
        required
      />
      <Field
        id="signin-password"
        name="password"
        label={copy.password}
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        maxLength={256}
        required
        action={
          <Button
            variant="secondary"
            aria-controls="signin-password"
            aria-label={visible ? copy.hidePassword : copy.showPassword}
            onClick={() => setVisible(!visible)}
            className="shrink-0 px-0"
          >
            <PasswordIcon size={18} aria-hidden />
          </Button>
        }
      />
      <Button type="submit" disabled={pending}>
        {pending ? copy.signingIn : copy.signIn}
      </Button>
    </>
  );
}

export function SignInForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(submitSignIn, {});
  return (
    <form action={action} className="grid gap-3.5">
      <SignInFields
        key={state.email}
        locale={locale}
        {...state}
        pending={pending}
      />
    </form>
  );
}
