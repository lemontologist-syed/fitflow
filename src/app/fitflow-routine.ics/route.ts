// Static default routine calendar, generated at build time
// (served as /fitflow/fitflow-routine.ics for import in Safari).
import { defaultCycle, defaultSchedule, PROGRAM_START } from "@/lib/defaults";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-static";

export function GET() {
  const ics = buildIcs({
    items: defaultSchedule(),
    timeZone: "Asia/Seoul",
    startDate: PROGRAM_START,
    cycles: [defaultCycle()],
    includeWorkouts: true,
    now: new Date("2026-11-09T00:00:00Z"),
  });
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
