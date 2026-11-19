"use client";

import { useActionState } from "react";
import type { OnboardingRequest } from "@mizan/contracts";
import {
  submitCredentials,
  submitInvitationCredentials,
  submitOwnerSetup,
} from "./owner-actions";
import { messages, type Locale } from "../language/messages";

const defaultValues = {
  organizationName: "",
  storeName: "",
  defaultCurrency: "AZN",
};

export function OwnerSetupFields({
  currencies,
  values = defaultValues,
  error,
  locale = "az",
}: {
  currencies: readonly string[];
  values?: OnboardingRequest;
  error?: string;
  locale?: Locale;
}) {
  const copy = messages[locale];
  return (
    <>
      <label>
        {copy.organization}
        <input
          name="organizationName"
          required
          maxLength={100}
          defaultValue={values.organizationName}
        />
      </label>
      <label>
        {copy.storeName}
        <input
          name="storeName"
          required
          maxLength={100}
          defaultValue={values.storeName}
        />
      </label>
      <label>
        {copy.currency}
        <select
          name="defaultCurrency"
          required
          defaultValue={values.defaultCurrency}
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function OwnerSetupForm({
  locale,
  currencies,
}: {
  locale: Locale;
  currencies: readonly string[];
}) {
  const [state, dispatch, pending] = useActionState(submitOwnerSetup, {});
  return (
    <form action={dispatch}>
      <OwnerSetupFields
        currencies={currencies}
        key={JSON.stringify(state.values)}
        values={state.values}
        error={state.error}
        locale={locale}
      />
      <button disabled={pending}>
        {pending ? messages[locale].saving : messages[locale].createStore}
      </button>
    </form>
  );
}

export function OwnerRegistrationForm({
  locale,
  invitation,
}: {
  locale: Locale;
  invitation?: string;
}) {
  const copy = messages[locale];
  const [state, dispatch, pending] = useActionState(
    invitation
      ? submitInvitationCredentials.bind(null, invitation)
      : submitCredentials,
    {},
  );
  return (
    <form action={dispatch}>
      <label>
        {copy.email}
        <input
          key={state.email}
          type="email"
          name="email"
          defaultValue={state.email}
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label>
        {copy.password}
        <input type="password" name="password" required maxLength={256} />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
      <button name="intent" value="signup" disabled={pending}>
        {copy.signUp}
      </button>
      <button
        name="intent"
        value="signin"
        className="auth-secondary"
        disabled={pending}
      >
        {copy.signIn}
      </button>
    </form>
  );
}
