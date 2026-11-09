"use client";
import { useRef, useState } from "react";
import { formatDateShort } from "@/lib/hooks";

export interface Point {
  date: string;
  value: number;
}

const W = 340;
const H = 190;
const PAD = { l: 34, r: 10, t: 14, b: 24 };

/** Interactive weight line chart: tap or drag to read values. */
export function LineChart({ points, goal, unit, label }: { points: Point[]; goal?: number; unit: string; label: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (points.length === 0) return <p className="text-sm text-muted">No entries yet.</p>;
  const vals = points.map((p) => p.value).concat(goal != null ? [goal] : []);
  let min = Math.floor(Math.min(...vals) - 0.5);
  let max = Math.ceil(Math.max(...vals) + 0.5);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const active = sel != null ? points[sel] : points[points.length - 1];
  const ai = sel ?? points.length - 1;

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setSel(best);
  };

  return (
    <figure>
      <figcaption className="mb-1 text-sm" aria-live="polite">
        <span className="font-semibold tabular">
          {active.value} {unit}
        </span>{" "}
        <span className="text-muted">on {formatDateShort(active.date)}</span>
      </figcaption>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`${label}. ${points.length} entries from ${points[0].value} to ${points[points.length - 1].value} ${unit}.`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.buttons && pick(e.clientX)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} stroke="var(--good)" strokeDasharray="5 4" strokeWidth="1.5" />
            <text x={W - PAD.r} y={y(goal) - 4} textAnchor="end" fontSize="10" fill="var(--good)">
              goal {goal}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === ai ? 5.5 : 3} fill={i === ai ? "var(--accent)" : "var(--card)"} stroke="var(--accent)" strokeWidth="2" />
        ))}
        <line x1={x(ai)} x2={x(ai)} y1={PAD.t} y2={H - PAD.b} stroke="var(--accent)" strokeOpacity="0.3" />
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)">
          {formatDateShort(points[0].date)}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {formatDateShort(points[points.length - 1].date)}
        </text>
      </svg>
    </figure>
  );
}

/** Daily bars with a shaded target band. */
export function BarChart({ points, band, unit, label }: { points: Point[]; band: [number, number]; unit: string; label: string }) {
  const max = Math.max(band[1] * 1.15, ...points.map((p) => p.value), 1);
  const bw = (W - PAD.l - PAD.r) / Math.max(points.length, 1);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const logged = points.filter((p) => p.value > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, p) => s + p.value, 0) / logged.length) : 0;
  return (
    <figure>
      <figcaption className="mb-1 text-sm text-muted">
        Average on logged days: <span className="tabular font-semibold text-fg">{avg} {unit}</span> · band = target {band[0]}–{band[1]}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label}. Average ${avg} ${unit} on ${logged.length} logged days.`}>
        <rect x={PAD.l} width={W - PAD.l - PAD.r} y={y(band[1])} height={y(band[0]) - y(band[1])} fill="var(--accent)" opacity="0.12" />
        {[0, band[0], band[1]].map((t) => (
          <text key={t} x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {t}
          </text>
        ))}
        {points.map((p, i) => (
          <rect key={p.date} x={PAD.l + i * bw + bw * 0.18} width={bw * 0.64} y={y(p.value)} height={Math.max(0, y(0) - y(p.value))} rx="3" fill="var(--accent)">
            <title>
              {formatDateShort(p.date)}: {p.value} {unit}
            </title>
          </rect>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {points.length > 0 && (
          <>
            <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)">
              {formatDateShort(points[0].date)}
            </text>
            <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
              {formatDateShort(points[points.length - 1].date)}
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}
