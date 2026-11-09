"use client";
// "Watch how" video links. The links live in exercise-videos.json next to
// index.html, so a dead link can be replaced by editing that file on GitHub
// (no rebuild). Any exercise without a valid entry gets a YouTube search link.
import { useEffect, useState } from "react";
import { BASE_PATH } from "./backend";
import { EXERCISES } from "./exercises";

export interface VideoEntry {
  url?: string | null;
  title?: string;
  channel?: string;
  /** Optional custom search words for the fallback link. */
  search?: string;
}

export interface VideoLink {
  href: string;
  verified: boolean; // true = a specific checked video; false = YouTube search
  label: string;
}

const ALLOWED = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//;

export function searchTerm(key: string, entry?: VideoEntry | null): string {
  if (entry?.search) return entry.search;
  const name = EXERCISES[key]?.name ?? key;
  return `${name.replace(/\s*\(.*?\)\s*/g, " ").trim()} exercise how to`;
}

export function videoLink(key: string, videos: Record<string, VideoEntry | null | undefined>): VideoLink {
  const entry = videos[key];
  if (entry?.url && ALLOWED.test(entry.url)) {
    return {
      href: entry.url,
      verified: true,
      label: entry.channel ? `Watch how (${entry.channel})` : "Watch how",
    };
  }
  return {
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm(key, entry))}`,
    verified: false,
    label: "Watch how (YouTube search)",
  };
}

let cache: Record<string, VideoEntry | null> | null = null;
let loading: Promise<Record<string, VideoEntry | null>> | null = null;

export function loadVideos(): Promise<Record<string, VideoEntry | null>> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch(`${BASE_PATH}/exercise-videos.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: { videos?: Record<string, VideoEntry | null> }) => (cache = j.videos ?? {}))
    .catch(() => (cache = {}));
  return loading;
}

export function useVideoLink(key: string | undefined): VideoLink | null {
  const [videos, setVideos] = useState(cache);
  useEffect(() => {
    if (!videos) void loadVideos().then(setVideos);
  }, [videos]);
  if (!key) return null;
  return videoLink(key, videos ?? {});
}
