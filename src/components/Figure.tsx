// Simple animated stick-figure illustrations (two poses, SVG/SMIL).
import type { PoseKey } from "@/lib/exercises";

type P = [number, number];
interface Pose {
  head: P;
  neck: P;
  hip: P;
  kneeL: P;
  footL: P;
  kneeR: P;
  footR: P;
  elbowL: P;
  handL: P;
  elbowR: P;
  handR: P;
}

const stand: Pose = {
  head: [50, 14], neck: [50, 25], hip: [50, 54], kneeL: [46, 71], footL: [45, 88], kneeR: [54, 71], footR: [55, 88],
  elbowL: [43, 39], handL: [41, 53], elbowR: [57, 39], handR: [59, 53],
};
const m = (p: Partial<Pose>): Pose => ({ ...stand, ...p });

const POSES: Record<PoseKey, [Pose, Pose]> = {
  squat: [
    m({ elbowL: [42, 33], handL: [32, 32], elbowR: [58, 33], handR: [68, 32] }),
    m({ head: [44, 34], neck: [47, 44], hip: [60, 64], kneeL: [42, 66], footL: [45, 88], kneeR: [48, 67], footR: [54, 88],
      elbowL: [38, 46], handL: [28, 45], elbowR: [42, 47], handR: [32, 46] }),
  ],
  pushup: [
    { head: [18, 57], neck: [25, 62], hip: [56, 74], kneeL: [72, 81], footL: [88, 88], kneeR: [72, 81], footR: [88, 88],
      elbowL: [25, 75], handL: [25, 88], elbowR: [26, 75], handR: [26, 88] },
    { head: [18, 76], neck: [25, 80], hip: [56, 83], kneeL: [72, 86], footL: [88, 88], kneeR: [72, 86], footR: [88, 88],
      elbowL: [36, 74], handL: [25, 88], elbowR: [37, 74], handR: [26, 88] },
  ],
  lunge: [
    m({ elbowL: [44, 44], handL: [46, 55], elbowR: [56, 44], handR: [54, 55] }),
    m({ head: [50, 28], neck: [50, 38], hip: [52, 64], kneeL: [38, 68], footL: [38, 88], kneeR: [62, 84], footR: [76, 88],
      elbowL: [44, 52], handL: [47, 63], elbowR: [56, 52], handR: [55, 63] }),
  ],
  bridge: [
    { head: [12, 82], neck: [20, 83], hip: [50, 85], kneeL: [64, 70], footL: [74, 88], kneeR: [66, 70], footR: [76, 88],
      elbowL: [30, 86], handL: [40, 87], elbowR: [31, 86], handR: [41, 87] },
    { head: [12, 82], neck: [20, 83], hip: [50, 68], kneeL: [66, 66], footL: [74, 88], kneeR: [68, 66], footR: [76, 88],
      elbowL: [30, 86], handL: [40, 87], elbowR: [31, 86], handR: [41, 87] },
  ],
  climber: [
    { head: [18, 57], neck: [25, 62], hip: [56, 72], kneeL: [40, 76], footL: [50, 87], kneeR: [72, 80], footR: [88, 88],
      elbowL: [25, 75], handL: [25, 88], elbowR: [26, 75], handR: [26, 88] },
    { head: [18, 57], neck: [25, 62], hip: [56, 72], kneeL: [72, 80], footL: [88, 88], kneeR: [40, 76], footR: [50, 87],
      elbowL: [25, 75], handL: [25, 88], elbowR: [26, 75], handR: [26, 88] },
  ],
  plank: [
    { head: [18, 70], neck: [25, 74], hip: [56, 78], kneeL: [72, 83], footL: [88, 88], kneeR: [72, 83], footR: [88, 88],
      elbowL: [25, 88], handL: [38, 88], elbowR: [26, 88], handR: [39, 88] },
    { head: [18, 71], neck: [25, 74], hip: [56, 77], kneeL: [72, 83], footL: [88, 88], kneeR: [72, 83], footR: [88, 88],
      elbowL: [25, 88], handL: [38, 88], elbowR: [26, 88], handR: [39, 88] },
  ],
  jack: [
    stand,
    m({ kneeL: [41, 71], footL: [35, 88], kneeR: [59, 71], footR: [65, 88], elbowL: [38, 15], handL: [33, 4], elbowR: [62, 15], handR: [67, 4] }),
  ],
  knees: [
    m({ kneeL: [40, 56], footL: [45, 72], elbowL: [44, 38], handL: [50, 30], elbowR: [58, 40], handR: [62, 52] }),
    m({ kneeR: [60, 56], footR: [55, 72], elbowR: [56, 38], handR: [50, 30], elbowL: [42, 40], handL: [38, 52] }),
  ],
  skater: [
    m({ head: [38, 20], neck: [40, 30], hip: [44, 58], kneeL: [38, 72], footL: [36, 88], kneeR: [54, 74], footR: [62, 86],
      elbowL: [48, 40], handL: [56, 48], elbowR: [32, 38], handR: [26, 46] }),
    m({ head: [62, 20], neck: [60, 30], hip: [56, 58], kneeR: [62, 72], footR: [64, 88], kneeL: [46, 74], footL: [38, 86],
      elbowR: [52, 40], handR: [44, 48], elbowL: [68, 38], handL: [74, 46] }),
  ],
  burpee: [
    m({ head: [40, 50], neck: [44, 58], hip: [58, 70], kneeL: [46, 74], footL: [52, 88], kneeR: [48, 75], footR: [54, 88],
      elbowL: [40, 72], handL: [38, 88], elbowR: [42, 72], handR: [40, 88] }),
    m({ head: [50, 10], neck: [50, 21], hip: [50, 50], kneeL: [47, 66], footL: [46, 82], kneeR: [53, 66], footR: [54, 82],
      elbowL: [44, 10], handL: [42, 0], elbowR: [56, 10], handR: [58, 0] }),
  ],
  arms: [
    m({ elbowL: [38, 26], handL: [26, 26], elbowR: [62, 26], handR: [74, 26] }),
    m({ elbowL: [38, 20], handL: [28, 12], elbowR: [62, 20], handR: [72, 12] }),
  ],
  hips: [
    m({ hip: [46, 54], kneeL: [43, 71], kneeR: [51, 71], elbowL: [40, 40], handL: [44, 52], elbowR: [56, 40], handR: [50, 52] }),
    m({ hip: [54, 54], kneeL: [49, 71], kneeR: [57, 71], elbowL: [44, 40], handL: [50, 52], elbowR: [60, 40], handR: [56, 52] }),
  ],
  hinge: [
    m({ elbowL: [44, 42], handL: [47, 53], elbowR: [56, 42], handR: [53, 53] }),
    m({ head: [30, 34], neck: [38, 38], hip: [56, 54], kneeL: [52, 71], footL: [50, 88], kneeR: [56, 71], footR: [56, 88],
      elbowL: [44, 46], handL: [52, 54], elbowR: [46, 47], handR: [54, 55] }),
  ],
  stretch: [
    m({ kneeR: [56, 70], footR: [62, 56], elbowR: [60, 44], handR: [62, 56], elbowL: [38, 30], handL: [30, 30] }),
    m({ kneeR: [56, 70], footR: [61, 57], elbowR: [60, 44], handR: [61, 57], elbowL: [38, 28], handL: [30, 26] }),
  ],
  kneel: [
    { head: [24, 80], neck: [32, 78], hip: [62, 76], kneeL: [52, 88], footL: [74, 88], kneeR: [52, 88], footR: [74, 88],
      elbowL: [20, 86], handL: [10, 88], elbowR: [21, 86], handR: [11, 88] },
    { head: [25, 79], neck: [33, 77], hip: [62, 75], kneeL: [52, 88], footL: [74, 88], kneeR: [52, 88], footR: [74, 88],
      elbowL: [20, 86], handL: [10, 88], elbowR: [21, 86], handR: [11, 88] },
  ],
  breathe: [stand, m({ elbowL: [40, 30], handL: [36, 18], elbowR: [60, 30], handR: [64, 18] })],
};

const SEGMENTS: Array<[keyof Pose, keyof Pose]> = [
  ["neck", "hip"],
  ["hip", "kneeL"],
  ["kneeL", "footL"],
  ["hip", "kneeR"],
  ["kneeR", "footR"],
  ["neck", "elbowL"],
  ["elbowL", "handL"],
  ["neck", "elbowR"],
  ["elbowR", "handR"],
];

export default function Figure({ pose, animate = true, size = 168, label }: { pose: PoseKey; animate?: boolean; size?: number; label: string }) {
  const [a, b] = POSES[pose] ?? POSES.breathe;
  const dur = pose === "plank" || pose === "kneel" ? "3s" : "1.6s";
  const anim = (from: number, to: number, attr: string) =>
    animate && from !== to ? (
      <animate attributeName={attr} values={`${from};${to};${from}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
    ) : null;
  return (
    <svg viewBox="0 0 100 92" width={size} height={size * 0.92} role="img" aria-label={label} className="text-accent">
      <line x1="2" y1="89.5" x2="98" y2="89.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none">
        {SEGMENTS.map(([p1, p2]) => (
          <line key={`${p1}-${p2}`} x1={a[p1][0]} y1={a[p1][1]} x2={a[p2][0]} y2={a[p2][1]}>
            {anim(a[p1][0], b[p1][0], "x1")}
            {anim(a[p1][1], b[p1][1], "y1")}
            {anim(a[p2][0], b[p2][0], "x2")}
            {anim(a[p2][1], b[p2][1], "y2")}
          </line>
        ))}
      </g>
      <circle cx={a.head[0]} cy={a.head[1]} r="6.5" fill="currentColor">
        {anim(a.head[0], b.head[0], "cx")}
        {anim(a.head[1], b.head[1], "cy")}
      </circle>
    </svg>
  );
}
