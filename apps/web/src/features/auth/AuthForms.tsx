import { PendingButton } from "@/shared/ui/PendingButton";
import { Link, Navigate } from "@tanstack/react-router";
import type { AuthError } from "@supabase/supabase-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/shared/lib/auth";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./session";

type Mode = "login" | "signup" | "requestReset" | "recovery";
type Fields = { email: string; password: string };

function errorKey(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "user_already_exists":
    case "email_exists":
      return "emailExists";
    case "same_password":
      return "samePassword";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    default:
      return "genericError";
  }
}

export function safeReturnPath(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character < " " || character === "\u007f")
  ) {
    return undefined;
  }
  const url = new URL(value, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    url.pathname.startsWith("//") ||
    /^\/(?:login|auth\/callback)\/?$/.test(url.pathname) ||
    (url.pathname.startsWith("/invitations/") &&
      url.pathname !== "/invitations/accept")
  ) {
    return undefined;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthPage({ returnTo }: { returnTo?: string }) {
  const { userId, ready } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  if (ready && userId) return <Navigate to="/" href={returnTo} replace />;
  return <AuthForm key={mode} mode={mode} setMode={setMode} />;
}

export function RecoveryPage() {
  const { t } = useTranslation("auth");
  const { ready, recovery } = useSession();
  if (!ready)
    return (
      <AuthPanel title={t("recovery")}>
        <ListSkeleton rows={2} />
      </AuthPanel>
    );
  if (recovery) return <AuthForm mode="recovery" />;
  return (
    <AuthPanel title={t("recovery")}>
      <p role="alert">{t("recoveryUnavailable")}</p>
      <Link to="/login" search={{}} className="underline">
        {t("login")}
      </Link>
    </AuthPanel>
  );
}

function AuthForm({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode?: (mode: Mode) => void;
}) {
  const { t } = useTranslation("auth");
  const { ready, finishRecovery } = useSession();
  const [notice, setNotice] = useState<
    "checkEmail" | "resetSent" | "passwordUpdated"
  >();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ mode: "onBlur" });
  const isNewPassword = mode === "signup" || mode === "recovery";

  async function submit({ email, password }: Fields) {
    if (!auth) return;
    clearErrors("root");
    try {
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) setError("root", { message: t(errorKey(error)) });
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) setError("root", { message: t(errorKey(error)) });
        else if (!data.session) setNotice("checkEmail");
      } else if (mode === "requestReset") {
        const { error } = await auth.resetPasswordForEmail(email.trim(), {
          redirectTo: new URL("/auth/callback", window.location.origin).href,
        });
        if (error) setError("root", { message: t(errorKey(error)) });
        else setNotice("resetSent");
      } else {
        const { error } = await auth.updateUser({ password });
        if (error) setError("root", { message: t(errorKey(error)) });
        else setNotice("passwordUpdated");
      }
    } catch {
      setError("root", { message: t("genericError") });
    }
  }

  return (
    <AuthPanel title={t(mode)}>
      {!auth && <p role="alert">{t("configurationMissing")}</p>}
      {notice ? (
        <div role="status" className="flex flex-col items-start gap-3">
          <p>{t(notice)}</p>
          {notice === "passwordUpdated" && (
            <Link to="/" onClick={finishRecovery} className="underline">
              {t("continue")}
            </Link>
          )}
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(submit)(event)}
          className="flex flex-col gap-4"
        >
          {mode !== "recovery" && (
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="min-h-11 lg:min-h-9"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email", {
                  required: t("required"),
                  validate: (value) =>
                    /^[^\s@]+@[^\s@]+$/.test(value.trim()) || t("invalidEmail"),
                })}
              />
              {errors.email && (
                <p id="email-error" className="text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          )}
          {mode !== "requestReset" && (
            <div className="grid gap-2">
              <Label htmlFor="password">
                {t(isNewPassword ? "newPassword" : "password")}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  isNewPassword ? "new-password" : "current-password"
                }
                className="min-h-11 lg:min-h-9"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                {...register("password", {
                  required: t("required"),
                  minLength: isNewPassword
                    ? { value: 6, message: t("weakPassword") }
                    : undefined,
                })}
              />
              {errors.password && (
                <p id="password-error" className="text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}
          {errors.root && (
            <p role="alert" className="text-destructive">
              {errors.root.message}
            </p>
          )}
          <PendingButton
            pending={isSubmitting}
            className="min-h-11 lg:min-h-9"
            disabled={!auth || !ready}
          >
            {t(
              isSubmitting
                ? "working"
                : mode === "recovery"
                  ? "savePassword"
                  : mode === "requestReset"
                    ? "sendResetLink"
                    : mode,
            )}
          </PendingButton>
        </form>
      )}
      {setMode && (
        <div className="flex flex-wrap gap-2">
          {mode === "login" ? (
            <>
              <Button
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                disabled={isSubmitting}
                onClick={() => setMode("signup")}
              >
                {t("signup")}
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                disabled={isSubmitting}
                onClick={() => setMode("requestReset")}
              >
                {t("requestReset")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="min-h-11 lg:min-h-9"
              disabled={isSubmitting}
              onClick={() => setMode("login")}
            >
              {t("backToLogin")}
            </Button>
          )}
        </div>
      )}
    </AuthPanel>
  );
}
