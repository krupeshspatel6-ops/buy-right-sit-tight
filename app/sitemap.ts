import type { MetadataRoute } from "next";
import { loadChapters } from "@/lib/chapters";

const BASE = "https://buyrightsittight.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
  ];
  const chapters = loadChapters().map((c) => ({
    url: `${BASE}/chapter/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...home, ...chapters];
}
