import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  categoryLabel,
  maxCategoryNameLength,
  maxCategorySortOrder,
  parseCategoryName,
  type ProductCategory,
  type ProductCategoryUpdate,
} from "@mizan/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryPath, categoryQuery } from "@/features/product-categories";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import { resources } from "@/shared/lib/i18n";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PendingButton } from "@/shared/ui/PendingButton";

type CategoryChange =
  { name: string } | { id: string; patch: ProductCategoryUpdate };

export function ProductCategoriesSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const { t, i18n } = useTranslation(["settings", "errors"]);
  const client = useQueryClient();
  const options = categoryQuery(organizationId, true);
  const query = useQuery(options);
  const [editing, setEditing] = useState<string>();
  const base = categoryPath(organizationId);
  const refresh = async () => {
    const queries = client.getQueryCache().findAll({
      predicate: ({ queryKey: [feature, organization, , resource] }) =>
        organization === organizationId &&
        (feature === "product-categories" ||
          (feature === "products" &&
            ["list", "detail", "facets"].includes(String(resource))) ||
          (feature === "dashboard" && resource === "charts")),
    });
    await Promise.all(
      queries.map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
    );
  };
  const mutation = useMutation({
    mutationFn: (change: CategoryChange) =>
      "id" in change
        ? apiRequest<ProductCategory>(`${base}/${change.id}`, {
            method: "PATCH",
            body: change.patch,
          })
        : apiRequest<ProductCategory>(base, { method: "POST", body: change }),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork) return refresh();
    },
  });
  const busy = mutation.isPending;
  async function save(change: CategoryChange) {
    if (busy) return false;
    try {
      await mutation.mutateAsync(change);
      toast.success(t("categories.saved"));
      return true;
    } catch {
      return false;
    }
  }
  const code = mutation.error?.code;
  const errorKey =
    code && Object.hasOwn(resources.az.errors, code)
      ? (code as keyof typeof resources.az.errors)
      : "generic";
  return (
    <section
      aria-labelledby="product-categories-title"
      className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4"
    >
      <h2
        id="product-categories-title"
        className="font-heading text-base font-semibold"
      >
        {t("categories.title")}
      </h2>
      {query.isPending && <ListSkeleton rows={3} />}
      {query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      {query.data && (
        <>
          <CategoryForm name="" busy={busy} save={(name) => save({ name })} />
          {mutation.isError && (
            <p role="alert" className="text-destructive">
              {t(errorKey, { ns: "errors" })}
            </p>
          )}
          {!query.data.length && (
            <p className="text-muted-foreground">{t("categories.empty")}</p>
          )}
          <ul className="divide-y border-t">
            {query.data.map((category) => {
              const { id, isActive, sortOrder } = category;
              const label = categoryLabel(category, i18n.resolvedLanguage);
              return (
                <li key={id}>
                  {editing === id ? (
                    <div className="py-2">
                      <CategoryForm
                        name={label}
                        sortOrder={sortOrder}
                        busy={busy}
                        cancel={() => setEditing(undefined)}
                        save={async (name, priority) => {
                          const saved = await save({
                            id,
                            patch: {
                              ...(name !== label && { name }),
                              sortOrder: priority,
                            },
                          });
                          if (saved) setEditing(undefined);
                          return saved;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="min-w-0 truncate font-medium"
                          title={label}
                        >
                          {label}
                        </span>
                        <Badge variant={isActive ? "success" : "secondary"}>
                          {t(isActive ? "active" : "inactive")}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-10 px-2 sm:px-3 lg:min-h-8"
                          disabled={busy}
                          aria-label={t("categories.editNamed", {
                            name: label,
                          })}
                          onClick={() => {
                            mutation.reset();
                            setEditing(id);
                          }}
                        >
                          {t("categories.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-10 px-2 sm:px-3 lg:min-h-8"
                          disabled={busy}
                          aria-label={t(
                            isActive
                              ? "categories.deactivateNamed"
                              : "categories.reactivateNamed",
                            { name: label },
                          )}
                          onClick={() =>
                            void save({ id, patch: { isActive: !isActive } })
                          }
                        >
                          {t(isActive ? "deactivate" : "reactivate")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function CategoryForm({
  name,
  sortOrder,
  busy,
  save,
  cancel,
}: {
  name: string;
  sortOrder?: number;
  busy: boolean;
  save: (name: string, sortOrder?: number) => Promise<boolean>;
  cancel?: () => void;
}) {
  const { t } = useTranslation("settings");
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name, sortOrder: (sortOrder ?? 0) + 1 },
  });
  return (
    <form
      className={
        sortOrder === undefined
          ? "grid gap-2 sm:align-form-fields sm:grid-cols-[minmax(0,1fr)_auto]"
          : "grid gap-2 sm:align-form-fields sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
      }
      noValidate
      onSubmit={(event) =>
        void handleSubmit(async (fields) => {
          const parsed = parseCategoryName(fields.name);
          if (
            parsed &&
            (await save(
              parsed,
              sortOrder === undefined ? undefined : fields.sortOrder - 1,
            )) &&
            !cancel
          )
            reset();
        })(event)
      }
    >
      <div data-form-field className="grid min-w-0 gap-2">
        <Label htmlFor={id}>{t("categories.name")}</Label>
        <Input
          id={id}
          maxLength={maxCategoryNameLength}
          className="min-h-11 lg:min-h-9"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          {...register("name", {
            validate: (value) =>
              !!parseCategoryName(value) || t("categories.invalidName"),
          })}
        />
        {errors.name && (
          <span id={`${id}-name-error`} className="text-destructive">
            {errors.name.message}
          </span>
        )}
      </div>
      {sortOrder !== undefined && (
        <div data-form-field className="grid min-w-0 gap-2">
          <Label htmlFor={`${id}-order`}>{t("categories.order")}</Label>
          <Input
            id={`${id}-order`}
            type="number"
            min={1}
            max={maxCategorySortOrder + 1}
            step={1}
            aria-invalid={!!errors.sortOrder}
            aria-describedby={
              errors.sortOrder ? `${id}-order-error` : undefined
            }
            className="min-h-11 lg:min-h-9"
            {...register("sortOrder", {
              valueAsNumber: true,
              validate: (value) =>
                (Number.isInteger(value) &&
                  value >= 1 &&
                  value <= maxCategorySortOrder + 1) ||
                t("categories.invalidOrder"),
            })}
          />
          {errors.sortOrder && (
            <span id={`${id}-order-error`} className="text-destructive">
              {errors.sortOrder.message}
            </span>
          )}
        </div>
      )}
      <div
        className={
          sortOrder === undefined
            ? "flex flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-2"
            : "flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-2"
        }
      >
        {cancel && (
          <Button
            variant="ghost"
            type="button"
            className="min-h-11 lg:min-h-9"
            disabled={busy}
            onClick={cancel}
          >
            {t("cancel")}
          </Button>
        )}
        <PendingButton
          type="submit"
          className="min-h-11 lg:min-h-9"
          pending={isSubmitting}
          disabled={busy}
        >
          {t(cancel ? "categories.save" : "categories.add")}
        </PendingButton>
      </div>
    </form>
  );
}
