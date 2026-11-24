import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  jewelrySetLimits,
  parseJewelrySetInput,
  type JewelrySetDetail,
  type JewelrySetInput,
  type JewelrySetProduct,
} from "@mizan/contracts";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/shared/lib/api";
import { resources } from "@/shared/lib/i18n";
import { ConfirmationContent } from "@/shared/ui/ConfirmationContent";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PendingButton } from "@/shared/ui/PendingButton";
import {
  cacheJewelrySet,
  dissolveJewelrySet,
  jewelrySetDetailQuery,
  jewelrySetPreviewQuery,
  refreshJewelrySets,
  saveJewelrySet,
} from "../api/jewelry-sets";
import { refreshSetPicker, type ProductScope } from "../api/queries";
import { ProductPanel } from "./ProductPanel";
import { ProductPicker } from "./ProductPicker";
import { SetAvailability, SetProduct, SetTotals } from "./JewelrySetRecord";

function errorKey(error: unknown) {
  return error instanceof ApiError &&
    Object.hasOwn(resources.az.errors, error.code)
    ? (error.code as keyof typeof resources.az.errors)
    : "generic";
}

export function JewelrySetPanel({
  scope,
  id,
  owner,
  opener,
  close,
  show,
  restoreFallbackFocus,
}: {
  scope: ProductScope;
  id?: string;
  owner: boolean;
  opener: HTMLElement;
  close: () => void;
  show: (id: string) => void;
  restoreFallbackFocus: () => void;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const formId = useId();
  const client = useQueryClient();
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);
  const [edit, setEdit] = useState<JewelrySetDetail>();
  const [confirmation, setConfirmation] = useState<JewelrySetDetail>();
  const detail = useQuery(jewelrySetDetailQuery(scope, id));
  const set = detail.error?.status === 404 ? undefined : detail.data;
  const confirmationOutdated =
    confirmation && confirmation.revision !== set?.revision;
  const refresh = (ids: string[]) =>
    Promise.all([
      refreshJewelrySets(client, scope),
      refreshSetPicker(client, scope, ids),
    ]);
  const save = useMutation<JewelrySetDetail, ApiError, JewelrySetInput>({
    mutationFn: (input: JewelrySetInput) => saveJewelrySet(scope, input, edit),
    onSuccess: (saved) => {
      cacheJewelrySet(client, scope, saved);
      void refresh(
        [...saved.products, ...(edit?.products ?? [])].map(({ id }) => id),
      );
      toast.success(t(edit ? "sets.updated" : "sets.created"));
      restoreEditFocus.current = true;
      setEdit(undefined);
      show(saved.id);
    },
    onError: (error, input) => {
      if (error.isNetwork || error.status === 409)
        return refresh(input.productIds);
    },
  });
  const removal = useMutation<void, ApiError, JewelrySetDetail>({
    mutationFn: (set: JewelrySetDetail) => dissolveJewelrySet(scope, set),
    onSuccess: (_, removed) => {
      close();
      void refresh(removed.products.map(({ id }) => id));
      toast.success(t("sets.dissolved"));
    },
    onError: (error, set) => {
      if (error.isNetwork || error.status === 409)
        return refresh(set.products.map(({ id }) => id));
    },
  });
  const editing = !id || !!edit;
  useEffect(() => {
    if (!editing && restoreEditFocus.current && editButton.current) {
      restoreEditFocus.current = false;
      editButton.current.focus();
    }
  }, [editing, set]);
  const actions = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 lg:flex">
      <Button
        type="button"
        variant="outline"
        disabled={save.isPending}
        className="min-h-11 lg:min-h-9"
        onClick={() => {
          if (edit) {
            restoreEditFocus.current = true;
            setEdit(undefined);
          } else {
            close();
          }
        }}
      >
        {t("cancel")}
      </Button>
      <PendingButton
        type="submit"
        form={formId}
        pending={save.isPending}
        className="h-auto min-h-11 whitespace-normal lg:min-h-9"
      >
        {t("sets.save")}
      </PendingButton>
    </div>
  );

  return (
    <ProductPanel
      title={
        edit
          ? t("sets.edit")
          : id
            ? (set?.name ?? t("sets.detail"))
            : t("sets.create")
      }
      opener={opener}
      close={close}
      restoreFallbackFocus={restoreFallbackFocus}
      busy={save.isPending || removal.isPending}
      mobileFooter={editing ? actions : undefined}
    >
      {editing ? (
        <JewelrySetForm
          scope={scope}
          formId={formId}
          initial={edit}
          busy={save.isPending}
          save={save.mutateAsync}
          actions={actions}
        />
      ) : (
        <>
          {detail.isPending && <ListSkeleton rows={3} />}
          {detail.isError && (
            <ErrorState
              error={detail.error}
              pending={detail.isFetching}
              retry={() => void detail.refetch()}
            />
          )}
          {set && (
            <div className="grid gap-4">
              {set.description && (
                <p className="whitespace-pre-wrap wrap-anywhere">
                  {set.description}
                </p>
              )}
              <p className="text-muted-foreground">
                {t("sets.individualTracking")}
              </p>
              <div>
                <SetAvailability totals={set.totals} />
              </div>
              <SetTotals totals={set.totals} />
              <section className="grid gap-2">
                <h3 className="font-semibold">{t("sets.components")}</h3>
                <ul className="divide-y rounded-lg border">
                  {set.products.map((product) => (
                    <li key={product.id} className="px-3 py-2">
                      <SetProduct product={product} link />
                    </li>
                  ))}
                </ul>
              </section>
              {owner && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    ref={editButton}
                    type="button"
                    variant="outline"
                    className="min-h-11 lg:min-h-9"
                    onClick={() => setEdit(set)}
                  >
                    {t("sets.edit")}
                  </Button>
                  <AlertDialog
                    open={!!confirmation}
                    onOpenChange={(open) => {
                      if (removal.isPending) return;
                      removal.reset();
                      setConfirmation(open ? set : undefined);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        className="min-h-11 lg:min-h-9"
                      >
                        {t("sets.dissolve")}
                      </Button>
                    </AlertDialogTrigger>
                    <ConfirmationContent
                      onEscapeKeyDown={(event) => {
                        if (removal.isPending) event.preventDefault();
                      }}
                    >
                      <AlertDialogTitle>{t("sets.dissolve")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("sets.dissolveDescription", {
                          name: confirmation?.name,
                        })}
                      </AlertDialogDescription>
                      {(removal.error || confirmationOutdated) && (
                        <p role="alert" className="text-destructive">
                          {t(
                            confirmationOutdated
                              ? "JEWELRY_SET_CHANGED"
                              : errorKey(removal.error),
                            { ns: "errors" },
                          )}
                        </p>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <AlertDialogCancel asChild>
                          <Button
                            variant="secondary"
                            disabled={removal.isPending}
                            className="min-h-11 lg:min-h-9"
                          >
                            {t("cancel")}
                          </Button>
                        </AlertDialogCancel>
                        <PendingButton
                          pending={removal.isPending}
                          variant="destructive"
                          className="min-h-11 lg:min-h-9"
                          disabled={!confirmation || confirmationOutdated}
                          onClick={() =>
                            confirmation && removal.mutate(confirmation)
                          }
                        >
                          {t("sets.dissolve")}
                        </PendingButton>
                      </div>
                    </ConfirmationContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </ProductPanel>
  );
}

function JewelrySetForm({
  scope,
  formId,
  initial,
  busy,
  save,
  actions,
}: {
  scope: ProductScope;
  formId: string;
  initial?: JewelrySetDetail;
  busy: boolean;
  save: (input: JewelrySetInput) => Promise<JewelrySetDetail>;
  actions: ReactNode;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const [picking, setPicking] = useState(false);
  const formElement = useRef<HTMLFormElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [selected, setSelected] = useState(
    () => new Map(initial?.products.map((product) => [product.id, product])),
  );
  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<JewelrySetInput>({
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      productIds: initial?.products.map(({ id }) => id) ?? [],
    },
  });
  const ids = useWatch({ control, name: "productIds" });
  useEffect(() => {
    if (initial) formElement.current?.focus();
  }, [initial]);
  const preview = useQuery(jewelrySetPreviewQuery(scope, ids));
  const products = new Map(
    preview.data?.products.map((product) => [product.id, product]),
  );
  const closePicker = () => {
    setPicking(false);
    pickerButton.current?.focus({ preventScroll: true });
  };
  const select = (product: JewelrySetProduct) => {
    if (ids.includes(product.id) || ids.length >= jewelrySetLimits.products)
      return;
    closePicker();
    setSelected((previous) => new Map(previous).set(product.id, product));
    setValue("productIds", [...ids, product.id]);
    clearErrors("productIds");
  };
  const remove = (id: string) => {
    pickerButton.current?.focus({ preventScroll: true });
    const remaining = new Map(selected);
    remaining.delete(id);
    setSelected(remaining);
    setValue(
      "productIds",
      ids.filter((productId) => productId !== id),
    );
    clearErrors("productIds");
  };
  const saveForm = async (values: JewelrySetInput) => {
    const parsed = parseJewelrySetInput(values);
    if ("field" in parsed) {
      setError(
        parsed.field,
        { message: t(`sets.validation.${parsed.field}`) },
        { shouldFocus: true },
      );
      if (parsed.field === "productIds") pickerButton.current?.focus();
      return;
    }
    try {
      await save(parsed.input);
    } catch (error) {
      const message = t(errorKey(error), { ns: "errors" });
      if (error instanceof ApiError && error.field === "productIds") {
        setError("productIds", { message });
      } else {
        setError("root", { message });
      }
    }
  };
  return (
    <form
      ref={formElement}
      id={formId}
      tabIndex={-1}
      onSubmit={(event) => {
        if (busy || submitting.current) {
          event.preventDefault();
          return;
        }
        submitting.current = true;
        void handleSubmit(saveForm)(event).finally(() => {
          submitting.current = false;
        });
      }}
      className="grid gap-4 outline-none"
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-name`}>{t("sets.name")}</Label>
          <Input
            {...register("name")}
            id={`${formId}-name`}
            required
            maxLength={jewelrySetLimits.name}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
            className="min-h-11 lg:min-h-9"
          />
          {errors.name && (
            <p
              id={`${formId}-name-error`}
              role="alert"
              className="text-destructive"
            >
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-description`}>
            {t("sets.description")}
          </Label>
          <Textarea
            {...register("description")}
            id={`${formId}-description`}
            maxLength={jewelrySetLimits.description}
            rows={2}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? `${formId}-description-error` : undefined
            }
          />
          {errors.description && (
            <p
              id={`${formId}-description-error`}
              role="alert"
              className="text-destructive"
            >
              {errors.description.message}
            </p>
          )}
        </div>
        <section className="grid min-w-0 gap-2">
          <h3 className="font-semibold">{t("sets.components")}</h3>
          <p className="text-muted-foreground">
            {t("sets.individualTracking")}
          </p>
          {ids.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {ids.map((id) => {
                const product = products.get(id) ?? selected.get(id);
                if (!product) return null;
                return (
                  <li
                    key={id}
                    className="flex items-start justify-between gap-2 p-3"
                  >
                    <SetProduct product={product} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("sets.remove", { name: product.name })}
                      onClick={() => remove(id)}
                      className="min-h-11 min-w-11 shrink-0 lg:min-h-9 lg:min-w-9"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <Button
            ref={pickerButton}
            type="button"
            variant="outline"
            className="min-h-11 justify-self-start lg:min-h-9"
            aria-expanded={picking}
            aria-describedby={
              errors.productIds ? `${formId}-product-error` : undefined
            }
            disabled={ids.length >= jewelrySetLimits.products}
            onClick={() => setPicking(!picking)}
          >
            <Plus aria-hidden="true" />
            {t("sets.add")}
          </Button>
          {errors.productIds && (
            <p
              id={`${formId}-product-error`}
              role="alert"
              className="text-destructive"
            >
              {errors.productIds.message}
            </p>
          )}
          {picking && (
            <ProductPicker
              scope={scope}
              setEligible
              excluded={ids}
              select={select}
              close={closePicker}
            />
          )}
        </section>
      </fieldset>
      {ids.length > 0 && (
        <>
          {preview.isPending && <ListSkeleton rows={2} />}
          {preview.isError && (
            <ErrorState
              error={preview.error}
              pending={preview.isFetching}
              retry={() => void preview.refetch()}
            />
          )}
          {preview.data && <SetTotals totals={preview.data.totals} />}
        </>
      )}
      {errors.root && (
        <p role="alert" className="text-destructive">
          {errors.root.message}
        </p>
      )}
      <div className="hidden lg:block">{actions}</div>
    </form>
  );
}
