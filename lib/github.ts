// Publishing from the deployed admin can't write to disk (Vercel's FS is
// read-only), so we create the chapter file through the GitHub Contents API.
// That keeps every chapter a public, timestamped commit — the same record.

export type CommitResult =
  | { ok: true; sha?: string }
  | { ok: false; error: string; code: "exists" | "config" | "api" };

export async function createFileOnGitHub(
  relPath: string,
  content: string,
  message: string
): Promise<CommitResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "krupeshspatel6-ops/buy-right-sit-tight";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token) return { ok: false, error: "GITHUB_TOKEN is not set.", code: "config" };

  const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

  // PUT with no `sha` creates the file, and fails (422) if it already exists —
  // which enforces the pledge that published chapters are never overwritten.
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "brst-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
    }),
  });

  if (res.status === 201) {
    const j = await res.json().catch(() => ({}));
    return { ok: true, sha: j?.commit?.sha };
  }
  if (res.status === 422 || res.status === 409) {
    return {
      ok: false,
      error: "That chapter already exists — published chapters are never overwritten.",
      code: "exists",
    };
  }
  const t = await res.text().catch(() => "");
  return { ok: false, error: `GitHub API ${res.status}: ${t.slice(0, 200)}`, code: "api" };
}

// Commit an already-base64-encoded binary file (e.g. a proof screenshot) to the
// repo, so proof images live in the same public, timestamped record as chapters.
export async function createBinaryFileOnGitHub(
  relPath: string,
  base64: string,
  message: string
): Promise<CommitResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "krupeshspatel6-ops/buy-right-sit-tight";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token) return { ok: false, error: "GITHUB_TOKEN is not set.", code: "config" };

  const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "brst-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ message, content: base64, branch }),
  });
  if (res.status === 201) {
    const j = await res.json().catch(() => ({}));
    return { ok: true, sha: j?.commit?.sha };
  }
  if (res.status === 422 || res.status === 409) {
    return { ok: false, error: "A file with that name already exists.", code: "exists" };
  }
  const t = await res.text().catch(() => "");
  return { ok: false, error: `GitHub API ${res.status}: ${t.slice(0, 200)}`, code: "api" };
}

// After committing, trigger a production deploy so the change goes live.
export async function triggerVercelDeploy(): Promise<boolean> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) return false;
  try {
    await fetch(hook, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}
