import type { MetadataRoute } from "next";

const SITE_URL = "https://dental-ai-receptionist-eta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["/", 1],
    ["/demo", 0.9],
    ["/book-a-demo", 0.9],
    ["/how-it-works", 0.8],
    ["/pricing", 0.8],
    ["/integrations", 0.6],
    ["/handover", 0.6],
    ["/security", 0.6],
    ["/privacy", 0.3],
    ["/terms", 0.3],
  ];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority }));
}
