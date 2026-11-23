import { PendingButton } from "@/shared/ui/PendingButton";
import { useId, type ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { normalizeInvitationEmail, type StoreOption } from "@mizan/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import type { TeamAction } from "../api/team";

export type RunTeamAction = (
  action: TeamAction,
  onError?: (message: string) => void,
) => Promise<boolean>;

function StoreSelect({
  stores,
  ...props
}: Omit<ComponentProps<typeof OptionSelect>, "options"> & {
  stores: StoreOption[];
}) {
  const { t } = useTranslation("team");
  return (
    <OptionSelect
      options={stores.map(({ id, name }) => ({ value: id, label: name }))}
      placeholder={t("chooseStore")}
      {...props}
    />
  );
}

export function InviteForm({
  stores,
  currentStoreId,
  busy,
  run,
}: {
  stores: StoreOption[];
  currentStoreId: string;
  busy: boolean;
  run: RunTeamAction;
}) {
  const { t } = useTranslation("team");
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    resetField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; storeId: string }>({
    defaultValues: {
      email: "",
      storeId: stores.some((store) => store.id === currentStoreId)
        ? currentStoreId
        : "",
    },
  });
  const submit = handleSubmit(async ({ email, storeId }) => {
    if (busy) return;
    const normalized = normalizeInvitationEmail(email);
    if (!normalized) {
      setError("email", { type: "validate" }, { shouldFocus: true });
      return;
    }
    if (!stores.some((store) => store.id === storeId)) {
      setError("storeId", { type: "validate" }, { shouldFocus: true });
      return;
    }
    if (await run({ kind: "invite", email: normalized, storeId }))
      resetField("email");
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="font-heading text-base font-semibold">
        {t("inviteHeading")}
      </h2>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-email`}>{t("email")}</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            enterKeyHint="send"
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            className="min-h-11 lg:min-h-8"
            {...register("email")}
          />
          {errors.email && (
            <p id={`${id}-email-error`} className="text-destructive">
              {t("errors.email")}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-store`}>{t("store")}</Label>
          <Controller
            control={control}
            name="storeId"
            render={({ field }) => (
              <StoreSelect
                id={`${id}-store`}
                stores={stores}
                disabled={busy}
                invalid={Boolean(errors.storeId)}
                describedBy={errors.storeId ? `${id}-store-error` : undefined}
                {...field}
              />
            )}
          />
          {errors.storeId && (
            <p id={`${id}-store-error`} className="text-destructive">
              {t("errors.store")}
            </p>
          )}
        </div>
        <PendingButton
          pending={isSubmitting}
          type="submit"
          disabled={busy || isSubmitting || stores.length === 0}
          className="min-h-11 lg:mt-[22px] lg:min-h-8"
        >
          {t("actions.invite")}
        </PendingButton>
      </div>
      {stores.length === 0 && (
        <p className="text-muted-foreground">{t("noStores")}</p>
      )}
    </form>
  );
}

export function AssignStoreForm({
  stores,
  userId,
  busy,
  run,
}: {
  stores: StoreOption[];
  userId: string;
  busy: boolean;
  run: RunTeamAction;
}) {
  const { t } = useTranslation("team");
  const id = useId();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ storeId: string }>({ defaultValues: { storeId: "" } });
  const submit = handleSubmit(async ({ storeId }) => {
    if (busy || !stores.some((store) => store.id === storeId)) return;
    if (await run({ kind: "assign", userId, storeId })) reset();
  });
  return (
    <form
      onSubmit={submit}
      className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <Label htmlFor={id} className="sr-only">
        {t("chooseStore")}
      </Label>
      <div className="grid gap-2">
        <Controller
          control={control}
          name="storeId"
          rules={{ validate: (value) => stores.some(({ id }) => id === value) }}
          render={({ field }) => (
            <StoreSelect
              id={id}
              stores={stores}
              disabled={busy}
              invalid={Boolean(errors.storeId)}
              describedBy={errors.storeId ? `${id}-error` : undefined}
              {...field}
            />
          )}
        />
        {errors.storeId && (
          <p id={`${id}-error`} className="text-destructive">
            {t("errors.store")}
          </p>
        )}
      </div>
      <PendingButton
        pending={isSubmitting}
        type="submit"
        variant="outline"
        size="sm"
        disabled={busy || isSubmitting || !stores.length}
        className="min-h-11 lg:min-h-8"
      >
        {t("actions.assign")}
      </PendingButton>
    </form>
  );
}
