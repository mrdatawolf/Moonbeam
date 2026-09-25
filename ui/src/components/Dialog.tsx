// Modal dialog on the native <dialog> element: showModal() makes the rest of
// the page inert and traps focus, Escape closes it, and focus returns to the
// trigger (CONTRACT-003 UX-2). Entered text lives in the caller's state, so
// closing with Escape keeps it until the action succeeds.
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** The footer: dismiss on the left, the named action on the right. */
  footer: ReactNode;
  onSubmit?: () => void;
}

export function Dialog({ open, onClose, title, children, footer, onSubmit }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      trigger.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      if (trigger.current instanceof HTMLElement) trigger.current.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-card border border-border bg-card p-0 text-foreground shadow-xl"
    >
      {open ? (
        <form
          method="dialog"
          className="flex max-h-[calc(100vh-2rem)] flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
        >
          <h2 id={titleId} className="border-b border-border px-5 py-3 text-lg font-semibold">
            {title}
          </h2>
          <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm">{children}</div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">{footer}</div>
        </form>
      ) : null}
    </dialog>
  );
}
