import { useId, useRef } from "react";
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
}: {
  scope: CustomerScope;
  customer?: CustomerContact & Pick<CustomerInput, "note">;
  close: () => void;
  saved: (customer: CustomerContact) => void;
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
      }
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const unknownCreate =
    !customer &&
    mutation.error instanceof ApiError &&
    (mutation.error.isNetwork ||
      mutation.error.status >= 500 ||
      mutation.error.status === 408 ||
      mutation.error.code === "INVALID_RESPONSE");
  const showError =
    mutation.isError &&
    !(
      mutation.error instanceof ApiError &&
      mutation.error.code === "INVALID_CUSTOMER"
    );

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((input) => {
          if (saving.current || unknownCreate) return;
          saving.current = true;
          mutation.mutate(input);
        })(event);
      }}
    >
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
              disabled={mutation.isPending}
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
        <textarea
          id={`${prefix}-note`}
          {...form.register("note")}
          rows={3}
          maxLength={maxCustomerNoteLength}
          disabled={mutation.isPending}
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
      {showError && (
        <p role="alert" className="text-destructive">
          {t(unknownCreate ? "unknownCreate" : "saveFailed")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 lg:min-h-9"
          disabled={mutation.isPending}
          onClick={close}
        >
          {t("cancel")}
        </Button>
        <Button
          className="min-h-11 lg:min-h-9"
          disabled={mutation.isPending || unknownCreate}
        >
          {t(mutation.isPending ? "saving" : "save")}
        </Button>
      </div>
    </form>
  );
}
