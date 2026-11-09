import Figure from "./Figure";
import WatchLink from "./WatchLink";
import { EXERCISES, type Exercise } from "@/lib/exercises";

export default function ExerciseDetails({ ex }: { ex: Exercise }) {
  return (
    <div className="space-y-3 text-[15px]">
      <div className="flex justify-center rounded-2xl bg-card p-2">
        <Figure pose={ex.pose} label={`${ex.name} illustration`} />
      </div>
      <WatchLink exerciseKey={ex.key} name={ex.name} className="w-full min-h-11" />
      <p className="text-xs text-muted">Opens in YouTube or Safari. Video links can stop working over time; FitFlow then falls back to a YouTube search.</p>
      <div>
        <h3 className="font-semibold">How to</h3>
        <ol className="ml-5 list-decimal space-y-1">
          {ex.instructions.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="font-semibold">Common mistakes</h3>
        <ul className="ml-5 list-disc space-y-1">
          {ex.mistakes.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Modifications</h3>
        <ul className="ml-5 list-disc space-y-1">
          {ex.modifications.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
      {ex.easier && <p className="text-sm text-muted">Easier alternative: {EXERCISES[ex.easier].name}</p>}
    </div>
  );
}

