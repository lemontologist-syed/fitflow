"use client";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Page({ title, subtitle, children, action }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="safe-top pb-tabbar mx-auto w-full max-w-xl px-4 fade-in">
      <header className="mb-4 mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {subtitle && <p className="text-sm font-medium text-muted">{subtitle}</p>}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </header>
      <div className="space-y-4">{children}</div>
    </main>
  );
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {right}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg" | "sm";
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-50",
        size === "lg" && "min-h-14 px-5 text-[17px]",
        size === "md" && "min-h-11 px-4 text-[15px]",
        size === "sm" && "min-h-9 px-3 text-sm",
        variant === "primary" && "bg-accent text-accentfg",
        variant === "secondary" && "bg-card2 text-fg ring-1 ring-line",
        variant === "ghost" && "text-accent",
        variant === "danger" && "bg-card2 text-bad ring-1 ring-line",
        className,
      )}
      {...rest}
    />
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: React.ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-[2px]",
          )}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-xl bg-card2 px-3 py-2 text-fg ring-1 ring-line outline-none focus:ring-2 focus:ring-accent";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="fade-in max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-bg px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 outline-none"
      >
        <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between bg-bg px-4 pb-2 pt-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-card2">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "good" | "bad"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cx(
        "rounded-2xl p-3 text-sm ring-1",
        tone === "info" && "bg-accentsoft ring-accent/30",
        tone === "warn" && "bg-card ring-warn/50",
        tone === "good" && "bg-card ring-good/50",
        tone === "bad" && "bg-card ring-bad/60",
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-card2 p-3">
      <div className="truncate text-xs font-medium text-muted">{label}</div>
      <div className="tabular truncate text-xl font-bold">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function download(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Shares a file via the iOS share sheet when possible, else downloads it. */
export async function shareOrDownload(filename: string, text: string, type: string) {
  try {
    const file = new File([text], filename, { type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  download(filename, text, type);
}
