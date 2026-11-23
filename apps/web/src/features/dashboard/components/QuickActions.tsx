import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  responsiveMenuItem,
  responsiveMenuWidth,
} from "@/shared/ui/responsive-menu";
import {
  availableQuickActions,
  visibleQuickActionCount,
} from "../quick-actions";

const actionClass = "min-h-11 px-2! transition-colors lg:min-h-9 lg:px-3!";
const overflowClass =
  "min-h-11 min-w-11 transition-colors lg:min-h-9 lg:min-w-9";

export function QuickActions({ owner }: { owner: boolean }) {
  const { t } = useTranslation(["dashboard", "products", "customers"]);
  const actions = availableQuickActions(owner).map((action) => ({
    ...action,
    text: t(action.label),
  }));
  const labelKey = JSON.stringify(actions.map(({ text }) => text));
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(-1);
  const nextFocus = useRef<string | null>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const items = Array.from(measure.children);
    const ellipsis = items.pop();
    if (!ellipsis) return;

    const fit = () => {
      const widths = items.map((item) => item.getBoundingClientRect().width);
      const gap = Number.parseFloat(getComputedStyle(row).columnGap);
      const next = visibleQuickActionCount(
        widths,
        row.getBoundingClientRect().width,
        gap,
        ellipsis.getBoundingClientRect().width,
      );
      if (next === lastCount.current) return;
      lastCount.current = next;

      const active = document.activeElement?.closest<HTMLElement>(
        "[data-quick-action]",
      );
      const index = Number(active?.dataset.quickAction);
      if (active && row.contains(active) && index >= next) {
        nextFocus.current =
          next < widths.length
            ? "[data-quick-overflow]"
            : `[data-quick-action="${next - 1}"]`;
      } else if (
        next === widths.length &&
        ((active && menuRef.current?.contains(active)) ||
          document.activeElement === row.querySelector("[data-quick-overflow]"))
      ) {
        nextFocus.current = `[data-quick-action="${Number.isInteger(index) && index < next ? index : next - 1}"]`;
      }

      setOpen(false);
      setCount(next);
    };

    fit();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(row, { box: "border-box" });
    for (const item of [...items, ellipsis])
      observer.observe(item, { box: "border-box" });
    return () => observer.disconnect();
  }, [labelKey]);

  useLayoutEffect(() => {
    if (!nextFocus.current) return;
    rowRef.current?.querySelector<HTMLElement>(nextFocus.current)?.focus();
    nextFocus.current = null;
  }, [count, actions.length]);

  return (
    <nav
      aria-label={t("widgets.actions")}
      className="relative overflow-clip rounded-lg border bg-card p-2 lg:p-3"
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-0 items-start overflow-hidden"
      >
        {actions.map(({ id, icon: Icon, text }, index) => (
          <span
            key={id}
            className={buttonVariants({
              variant: index === 0 ? "default" : "outline",
              className: actionClass,
            })}
          >
            <Icon />
            {text}
          </span>
        ))}
        <span
          className={buttonVariants({
            size: "icon",
            variant: "outline",
            className: overflowClass,
          })}
        >
          <Ellipsis />
        </span>
      </div>
      <div
        ref={rowRef}
        className="flex min-h-11 min-w-0 items-center gap-2 lg:min-h-9"
      >
        {actions
          .slice(0, count)
          .map(({ id, icon: Icon, text, link }, index) => (
            <Button
              key={id}
              asChild
              variant={index === 0 ? "default" : "outline"}
              className={actionClass}
            >
              <Link {...link} data-quick-action={index}>
                <Icon aria-hidden="true" />
                {text}
              </Link>
            </Button>
          ))}
        {count < actions.length && (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className={overflowClass}
                aria-label={t("moreActions")}
                data-quick-overflow=""
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              ref={menuRef}
              align="end"
              className={responsiveMenuWidth}
              collisionPadding={8}
            >
              {actions
                .slice(count)
                .map(({ id, icon: Icon, text, link }, index) => (
                  <DropdownMenuItem
                    key={id}
                    asChild
                    className={responsiveMenuItem}
                  >
                    <Link {...link} data-quick-action={count + index}>
                      <Icon aria-hidden="true" />
                      <span className="min-w-0 wrap-anywhere">{text}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
