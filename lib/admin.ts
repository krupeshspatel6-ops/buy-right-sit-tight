// The admin editor is a LOCAL tool only. It's fully disabled on the deployed
// site: Vercel's filesystem is read-only (so it couldn't write chapters
// anyway), and a public write/publish surface would undermine the whole
// "provable via git" model. This gate is the single source of truth.
export function isAdminEnabled(): boolean {
  return process.env.VERCEL !== "1";
}
