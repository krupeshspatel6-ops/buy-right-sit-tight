// Public repo links used as the "never edited" proof. Each chapter is a file
// in a public GitHub repo; GitHub records the exact commit time, and the
// history is public and can't be secretly rewritten. A chapter with a single
// commit was never edited after publication.
export const GITHUB_REPO_WEB =
  process.env.NEXT_PUBLIC_GITHUB_REPO_WEB ||
  "https://github.com/krupeshspatel6-ops/buy-right-sit-tight";

export function chapterCommitsUrl(slug: string): string {
  return `${GITHUB_REPO_WEB}/commits/main/chapters/${slug}.md`;
}

export function chapterFileUrl(slug: string): string {
  return `${GITHUB_REPO_WEB}/blob/main/chapters/${slug}.md`;
}
