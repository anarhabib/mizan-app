import type { StoreContext } from "@mizan/contracts";
import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { sameScope, type StoreScope } from "./selection";

export function StoreSwitcher({
  active,
  contexts,
  onSelect,
}: {
  active: StoreContext;
  contexts: StoreContext[];
  onSelect: (scope: StoreScope) => void;
}) {
  const { t } = useTranslation("workspace");
  const [open, setOpen] = useState(false);
  if (contexts.length < 2)
    return <p className="truncate font-medium">{active.storeName}</p>;

  const trigger = (
    <Button
      variant="outline"
      className="min-h-11 max-w-full gap-2 lg:min-h-9"
      aria-label={t("switchFrom", { name: active.storeName })}
    >
      <span className="truncate">{active.storeName}</span>
      <ChevronsUpDown aria-hidden="true" className="shrink-0" />
    </Button>
  );
  return (
    <>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{t("switchStore")}</SheetTitle>
              <SheetDescription>{t("chooseStore")}</SheetDescription>
            </SheetHeader>
            <ul className="grid max-h-[60dvh] gap-2 overflow-auto px-4 pb-6">
              {contexts.map((context) => (
                <li key={`${context.organizationId}/${context.storeId}`}>
                  <Button
                    variant={sameScope(active, context) ? "secondary" : "ghost"}
                    aria-current={sameScope(active, context)}
                    className="min-h-11 w-full justify-start whitespace-normal text-left"
                    onClick={() => {
                      setOpen(false);
                      onSelect(context);
                    }}
                  >
                    <span className="min-w-0 break-words">
                      {context.storeName} · {context.organizationName}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden lg:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {contexts.map((context) => (
              <DropdownMenuItem
                key={`${context.organizationId}/${context.storeId}`}
                aria-current={sameScope(active, context)}
                onSelect={() => onSelect(context)}
              >
                {context.storeName} · {context.organizationName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
