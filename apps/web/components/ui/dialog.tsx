"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export function Dialog({
  title,
  closeLabel,
  open = false,
  placement = "center",
  scrolled,
  closeDisabled = false,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  open?: boolean;
  placement?: "center" | "side";
  scrolled?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-scrolled={scrolled}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      className={`mizan-dialog fixed box-border max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100%-2rem)] overflow-auto rounded-[23px] p-4 text-mizan-ink backdrop:bg-mizan-ink/55 ${placement === "side" ? "top-[max(1rem,env(safe-area-inset-top))] left-4 m-0 h-full max-w-[320px]" : "inset-0 m-auto max-w-[680px]"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="m-0 text-xl font-bold">
          {title}
        </h2>
        <Button
          variant="secondary"
          aria-label={closeLabel}
          disabled={closeDisabled}
          onClick={onClose}
          className="px-0"
        >
          <X size={20} aria-hidden />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
