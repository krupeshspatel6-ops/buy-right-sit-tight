// Mocap stub. In Copycat these functions turn webcam MediaPipe landmarks into
// character motion (via the `kalidokit` package). The book's buddy has no webcam
// and never feeds landmarks, so these are only ever called with null — we return
// null / no-op so the character idles and talks without pulling in kalidokit.

export function solvePose() {
  return null;
}
export function solveFace() {
  return null;
}
export function applyPose() {
  /* no mocap input → nothing to apply */
}
export function faceExpr() {
  return null;
}
