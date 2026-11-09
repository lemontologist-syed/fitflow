"use client";
import { PlayCircle } from "lucide-react";
import { useVideoLink } from "@/lib/videos";
import { cx } from "./ui";

/** Opens the exercise video in YouTube / Safari (not embedded). */
export default function WatchLink({ exerciseKey, name, className }: { exerciseKey: string; name: string; className?: string }) {
  const link = useVideoLink(exerciseKey);
  if (!link) return null;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="watch-how"
      aria-label={`Watch how to do ${name} on YouTube${link.verified ? "" : " (search results)"}`}
      className={cx(
        "inline-flex min-h-9 items-center justify-center gap-1 rounded-2xl bg-card2 px-3 text-sm font-semibold text-fg ring-1 ring-line",
        className,
      )}
    >
      <PlayCircle size={16} aria-hidden className="text-bad" /> {link.verified ? "Watch how" : "Watch how (search)"}
    </a>
  );
}
