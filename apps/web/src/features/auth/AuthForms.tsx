import { PendingButton } from "@/shared/ui/PendingButton";
import { Link, Navigate } from "@tanstack/react-router";
import type { AuthError } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/shared/lib/auth";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./session";
import googleMark from "./google-mark.svg";
import { readOAuthCallback, startOAuth, type SocialProvider } from "./oauth";

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

export function AuthPage({ returnTo }: { returnTo?: string }) {
  const { userId, ready } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  if (ready && userId) return <Navigate to="/" href={returnTo} replace />;
  return (
    <AuthForm key={mode} mode={mode} setMode={setMode} returnTo={returnTo} />
  );
}

export function AuthCallback() {
  const [callback] = useState(() =>
    readOAuthCallback(new URL(window.location.href)),
  );
  return callback ? <OAuthCallback callback={callback} /> : <RecoveryPage />;
}

function OAuthCallback({
  callback,
}: {
  callback: NonNullable<ReturnType<typeof readOAuthCallback>>;
}) {
  const { t } = useTranslation("auth");
  const { ready, userId } = useSession();
  const invitation = callback.returnTo === "/invitations/accept";
  const finished = ready && Boolean(userId) && !callback.error;
  useEffect(() => {
    if (finished && invitation) window.close();
  }, [finished, invitation]);
  if (finished && !invitation)
    return <Navigate to="/" href={callback.returnTo} replace />;

  return (
    <AuthPanel title={t("login")}>
      {callback.error || (ready && !userId) ? (
        <>
          <p role="alert" className="text-destructive">
            {t(callback.error ?? "oauthError")}
          </p>
          {!invitation && (
            <Link
              to="/login"
              search={{ returnTo: callback.returnTo }}
              className="underline"
            >
              {t("backToLogin")}
            </Link>
          )}
          {invitation && (
            <Button type="button" onClick={() => window.close()}>
              {t("closeOAuthTab")}
            </Button>
          )}
        </>
      ) : finished ? (
        <p role="status">{t("oauthInvitationReturn")}</p>
      ) : (
        <ListSkeleton rows={2} />
      )}
    </AuthPanel>
  );
}

function RecoveryPage() {
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
  returnTo,
}: {
  mode: Mode;
  setMode?: (mode: Mode) => void;
  returnTo?: string;
}) {
  const { t } = useTranslation("auth");
  const { ready, finishRecovery } = useSession();
  const [notice, setNotice] = useState<
    "checkEmail" | "resetSent" | "passwordUpdated"
  >();
  const activeRequest = useRef(false);
  const [provider, setProvider] = useState<SocialProvider>();
  const [popup, setPopup] = useState<Window>();
  const [oauthError, setOAuthError] = useState<
    "oauthError" | "oauthCanceled" | "oauthPopupBlocked"
  >();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ mode: "onBlur" });
  const isNewPassword = mode === "signup" || mode === "recovery";

  useEffect(() => {
    if (!popup) return;
    const timer = window.setInterval(() => {
      if (!popup.closed) return;
      setPopup(undefined);
      setProvider(undefined);
      setOAuthError("oauthCanceled");
      activeRequest.current = false;
    }, 500);
    return () => window.clearInterval(timer);
  }, [popup]);

  async function socialSignIn(selected: SocialProvider) {
    if (!auth || !ready || isSubmitting || activeRequest.current) return;
    setOAuthError(undefined);
    clearErrors("root");
    // Keep the scrubbed invitation token in the original tab's memory.
    const invitation = returnTo === "/invitations/accept";
    const tab = invitation ? window.open("about:blank", "_blank") : null;
    if (invitation && !tab) {
      setOAuthError("oauthPopupBlocked");
      return;
    }
    if (tab) tab.opener = null;
    activeRequest.current = true;
    setProvider(selected);
    try {
      await startOAuth(
        auth,
        selected,
        window.location.origin,
        returnTo,
        tab ?? undefined,
      );
      if (tab) setPopup(tab);
    } catch {
      tab?.close();
      setOAuthError("oauthError");
      setProvider(undefined);
      activeRequest.current = false;
    }
  }

  async function submit({ email, password }: Fields) {
    if (!auth || !ready || activeRequest.current) return;
    activeRequest.current = true;
    setOAuthError(undefined);
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
    } finally {
      activeRequest.current = false;
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
            disabled={!auth || !ready || !!provider}
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
      {!notice && (mode === "login" || mode === "signup") && (
        <>
          <PendingButton
            type="button"
            variant="outline"
            pending={provider === "google"}
            disabled={!auth || !ready || isSubmitting || !!provider}
            className="min-h-11 w-full justify-center gap-2 px-2 py-1 text-center whitespace-normal lg:min-h-9"
            onClick={() => void socialSignIn("google")}
          >
            {provider !== "google" && (
              <img src={googleMark} alt="" className="size-4 shrink-0" />
            )}
            <span className="min-w-0">{t("google")}</span>
          </PendingButton>
          {oauthError && (
            <p role="alert" className="text-destructive">
              {t(oauthError)}
            </p>
          )}
        </>
      )}
      {setMode && (
        <div className="flex flex-wrap gap-2">
          {mode === "login" ? (
            <>
              <Button
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                disabled={isSubmitting || !!provider}
                onClick={() => setMode("signup")}
              >
                {t("signup")}
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                disabled={isSubmitting || !!provider}
                onClick={() => setMode("requestReset")}
              >
                {t("requestReset")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="min-h-11 lg:min-h-9"
              disabled={isSubmitting || !!provider}
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
