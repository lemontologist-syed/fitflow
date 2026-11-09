import { AlertCircle, CheckCircle2, Circle, CircleDot, SkipForward } from "lucide-react";
import type { ItemState } from "@/lib/schedule";
import { STATE_LABEL } from "@/lib/schedule";
import { cx } from "./ui";

// Each state has its own icon, label text and border style, never colour alone.
export default function StateBadge({ state }: { state: ItemState }) {
  const Icon = {
    upcoming: Circle,
    in_progress: CircleDot,
    completed: CheckCircle2,
    skipped: SkipForward,
    missed: AlertCircle,
  }[state];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        state === "completed" && "bg-accentsoft text-good",
        state === "in_progress" && "bg-accent text-accentfg",
        state === "upcoming" && "text-muted ring-1 ring-line",
        state === "skipped" && "text-muted ring-1 ring-dashed ring-line line-through decoration-1",
        state === "missed" && "text-bad ring-1 ring-bad/50",
      )}
    >
      <Icon size={14} aria-hidden />
      {STATE_LABEL[state]}
    </span>
  );
}
