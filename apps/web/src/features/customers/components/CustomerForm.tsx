import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useId, useRef, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  maxCustomerNoteLength,
  parseCustomerInput,
  type CustomerContact,
  type CustomerInput,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, ApiError } from "@/shared/lib/api";
import {
  customerPath,
  invalidateCustomers,
  type CustomerScope,
} from "../api/queries";

export function CustomerForm({
  scope,
  customer,
  close,
  saved,
  onSubmittingChange,
}: {
  scope: CustomerScope;
  customer?: CustomerContact & Pick<CustomerInput, "note">;
  close: () => void;
  saved: (customer: CustomerContact) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const { t } = useTranslation("customers");
  const prefix = useId();
  const saving = useRef(false);
  const client = useQueryClient();
  const form = useForm<CustomerInput>({
    defaultValues: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      note: customer?.note ?? "",
    },
    resolver: (values) => {
      const parsed = parseCustomerInput(values);
      return "input" in parsed
        ? { values: parsed.input, errors: {} }
        : { values: {}, errors: { [parsed.field]: { type: "validate" } } };
    },
  });
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (body: CustomerInput) => {
      const result = await apiRequest<CustomerContact>(
        customerPath(scope, customer?.id),
        {
          method: customer ? "PATCH" : "POST",
          body,
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!result?.id)
        throw new ApiError(200, "INVALID_RESPONSE", "Missing customer");
      return result;
    },
    onSuccess: (result) => {
      void invalidateCustomers(client, scope, result.id);
      toast.success(t(customer ? "updated" : "created"));
      saved(result);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === "INVALID_CUSTOMER" &&
        (error.field === "name" ||
          error.field === "phone" ||
          error.field === "note")
      ) {
        form.setError(error.field, { type: "validate" });
      } else {
        void invalidateCustomers(client, scope, customer?.id);
        if (customer || !isUncertainCustomerSave(error))
          toast.error(t("saveFailed"));
      }
    },
  });
  const unknownCreate = !customer && isUncertainCustomerSave(mutation.error);

  const pending = mutation.isPending || form.formState.isSubmitting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || unknownCreate) return;
    saving.current = true;
    onSubmittingChange(true);
    try {
      await form.handleSubmit((input) =>
        mutation.mutateAsync(input).catch(() => undefined),
      )(event);
    } finally {
      saving.current = false;
      onSubmittingChange(false);
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      {(["name", "phone"] as const).map((field) => {
        const id = `${prefix}-${field}`;
        const invalid = Boolean(form.formState.errors[field]);
        return (
          <div key={field} className="grid gap-2">
            <Label htmlFor={id}>{t(field)}</Label>
            <Input
              id={id}
              {...form.register(field)}
              autoComplete={field === "phone" ? "tel" : "name"}
              type={field === "phone" ? "tel" : "text"}
              maxLength={field === "phone" ? 40 : 120}
              className="min-h-11 lg:min-h-9"
              disabled={pending}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${id}-error` : undefined}
            />
            {invalid && (
              <p id={`${id}-error`} role="alert" className="text-destructive">
                {t(field === "name" ? "invalidName" : "invalidPhone")}
              </p>
            )}
          </div>
        );
      })}
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-note`}>{t("optionalNote")}</Label>
        <Textarea
          id={`${prefix}-note`}
          {...form.register("note")}
          rows={3}
          maxLength={maxCustomerNoteLength}
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.note)}
          aria-describedby={
            form.formState.errors.note ? `${prefix}-note-error` : undefined
          }
          className="w-full rounded-lg border border-control-border bg-control px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive lg:text-sm"
        />
        {form.formState.errors.note && (
          <p
            id={`${prefix}-note-error`}
            role="alert"
            className="text-destructive"
          >
            {t("invalidNote", { max: maxCustomerNoteLength })}
          </p>
        )}
      </div>
      {unknownCreate && (
        <p role="alert" className="text-destructive">
          {t("unknownCreate")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 lg:min-h-9"
          disabled={pending}
          onClick={close}
        >
          {t("cancel")}
        </Button>
        <PendingButton
          pending={pending}
          className="min-h-11 lg:min-h-9"
          disabled={unknownCreate}
        >
          {t(pending ? "saving" : "save")}
        </PendingButton>
      </div>
    </form>
  );
}

function isUncertainCustomerSave(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.isNetwork ||
      error.status >= 500 ||
      error.status === 408 ||
      error.code === "INVALID_RESPONSE")
  );
}
