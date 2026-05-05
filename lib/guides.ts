import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  category: string;
};

export type Guide = GuideMeta & {
  contentMd: string;
  contentHtml: string;
};

function readGuideFile(filename: string): Guide {
  const fullPath = path.join(GUIDES_DIR, filename);
  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);

  const slug = (data.slug as string) ?? filename.replace(/\.md$/, "");
  const html = marked.parse(content, { async: false }) as string;

  return {
    slug,
    title: (data.title as string) ?? slug,
    description: (data.description as string) ?? "",
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [],
    publishedAt: (data.publishedAt as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? (data.publishedAt as string) ?? "",
    readingMinutes: Number(data.readingMinutes) || 5,
    category: (data.category as string) ?? "Ümumi",
    contentMd: content,
    contentHtml: html,
  };
}

export function getAllGuides(): GuideMeta[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md"));
  const guides = files.map((f) => readGuideFile(f));
  return guides
    .map((g) => ({
      slug: g.slug,
      title: g.title,
      description: g.description,
      keywords: g.keywords,
      publishedAt: g.publishedAt,
      updatedAt: g.updatedAt,
      readingMinutes: g.readingMinutes,
      category: g.category,
    }))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export function getGuideBySlug(slug: string): Guide | null {
  if (!fs.existsSync(GUIDES_DIR)) return null;
  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const guide = readGuideFile(f);
    if (guide.slug === slug) return guide;
  }
  return null;
}

export function getAllGuideSlugs(): string[] {
  return getAllGuides().map((g) => g.slug);
}
