import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/lib/exercises";
import { videoLink } from "@/lib/videos";
import { buildSession } from "@/lib/program";

const file = JSON.parse(readFileSync("public/exercise-videos.json", "utf8")) as { videos: Record<string, { url: string | null } | null> };

describe("exercise video links", () => {
  it("has an entry for every exercise in the library", () => {
    expect(Object.keys(file.videos).sort()).toEqual(Object.keys(EXERCISES).sort());
  });

  it("every exercise used in any session resolves to a YouTube link", () => {
    for (const type of ["strength", "conditioning", "mixed", "rest"] as const) {
      for (const w of [1, 2, 3, 4]) {
        for (const s of buildSession(type, w).steps) {
          if (s.kind !== "exercise") continue;
          for (const key of [s.key, EXERCISES[s.key].easier].filter(Boolean) as string[]) {
            expect(videoLink(key, file.videos).href).toMatch(/^https:\/\/www\.youtube\.com\//);
          }
        }
      }
    }
  });

  it("stored video URLs are plain YouTube watch links", () => {
    for (const v of Object.values(file.videos)) {
      if (v?.url) expect(v.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
    }
  });

  it("falls back to a search link for missing, empty or non-YouTube entries", () => {
    expect(videoLink("pushup", {}).href).toBe("https://www.youtube.com/results?search_query=Push-up%20exercise%20how%20to");
    expect(videoLink("chair-squat", { "chair-squat": null }).href).toContain("Chair%20squat%20exercise");
    const evil = videoLink("pushup", { pushup: { url: "https://evil.example/x" } });
    expect(evil.verified).toBe(false);
    expect(videoLink("pushup", { pushup: { url: "https://www.youtube.com/watch?v=abcdefghijk", channel: "X" } })).toMatchObject({ verified: true });
  });
});
