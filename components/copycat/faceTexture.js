"use client";
import * as THREE from "three";

// A proper cartoon face drawn in 2D (almond eyes + irises, soft brows, subtle nose,
// cupid's-bow lips) on a transparent canvas, used as a texture on the front of the
// head. Painted 2D features read as a real face; stacked 3D primitives never do.
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v || 0);

// Emotion → face-shape params. Drives brows/eyes/mouth so the same head reads as
// curious, serious, excited, thinking, etc. (open = mouth-open, set live from voice).
export const EXPRESSIONS = {
  neutral:   { smile: 0.42, brow: 0.10, browLower: 0.00, eyeWide: 1.00, frown: 0.00 },
  curious:   { smile: 0.35, brow: 0.85, browLower: 0.00, eyeWide: 1.12, frown: 0.00 },
  excited:   { smile: 0.92, brow: 0.70, browLower: 0.00, eyeWide: 1.16, frown: 0.00 },
  confident: { smile: 0.52, brow: 0.18, browLower: 0.00, eyeWide: 1.00, frown: 0.00 },
  serious:   { smile: 0.05, brow: 0.00, browLower: 0.60, eyeWide: 0.88, frown: 0.22 },
  thinking:  { smile: 0.25, brow: 0.35, browLower: 0.10, eyeWide: 0.94, frown: 0.00 },
  warm:      { smile: 0.95, brow: 0.38, browLower: 0.00, eyeWide: 1.04, frown: 0.00 },
  concerned: { smile: 0.10, brow: 0.25, browLower: 0.45, eyeWide: 0.95, frown: 0.38 },
};

// `e` = { smile, open, blinkL, blinkR, brow, browLower, eyeWide, frown } (all optional).
export function drawFace(ctx, W = 512, e = {}) {
  const cx = W / 2;
  const smile = clamp01(e.smile), open = clamp01(e.open), brow = clamp01(e.brow);
  const browLower = clamp01(e.browLower), frown = clamp01(e.frown);
  const eyeWide = e.eyeWide == null ? 1 : Math.max(0.6, Math.min(1.4, e.eyeWide));
  const blinkL = clamp01(e.blinkL), blinkR = clamp01(e.blinkR);
  // eye gaze (mocap "look where I look"); 0 when absent → greeter eyes unchanged
  const gx = Math.max(-1, Math.min(1, e.gazeX || 0)), gy = Math.max(-1, Math.min(1, e.gazeY || 0));
  ctx.clearRect(0, 0, W, W);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // eyebrows — raise with brow, drop + angle inward with browLower (serious/concerned)
  const bY = W * 0.365 - brow * W * 0.035 + browLower * W * 0.028;
  const inner = browLower * W * 0.03;   // inner ends dip down when frowning
  ctx.strokeStyle = "#4A3220";
  ctx.lineWidth = W * 0.036;
  ctx.beginPath(); ctx.moveTo(cx - W * 0.175, bY); ctx.quadraticCurveTo(cx - W * 0.115, bY - W * 0.03, cx - W * 0.045, bY - W * 0.013 + inner); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + W * 0.045, bY - W * 0.013 + inner); ctx.quadraticCurveTo(cx + W * 0.115, bY - W * 0.03, cx + W * 0.175, bY); ctx.stroke();

  // eyes — dark rounded; eyeWide scales height; blink squashes them to a lid line
  const eye = (ex, blink) => {
    const openAmt = (1 - clamp01(blink)) * eyeWide;
    ctx.save(); ctx.translate(ex, W * 0.455);
    if (openAmt < 0.22) {
      ctx.strokeStyle = "#241C17"; ctx.lineWidth = W * 0.012;
      ctx.beginPath(); ctx.moveTo(-W * 0.04, 0); ctx.quadraticCurveTo(0, W * 0.012, W * 0.04, 0); ctx.stroke();
    } else {
      const ox = gx * W * 0.013, oy = -gy * W * 0.014 * openAmt; // eyeball shifts toward gaze
      ctx.fillStyle = "#241C17";
      ctx.beginPath(); ctx.ellipse(ox, oy, W * 0.040, W * 0.056 * openAmt, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(ox - W * 0.013, oy - W * 0.020 * openAmt, W * 0.012 * openAmt, 0, 7); ctx.fill();
    }
    ctx.restore();
  };
  eye(cx - W * 0.088, blinkL); eye(cx + W * 0.088, blinkR);

  // soft cheek blush
  ctx.fillStyle = "rgba(232,150,120,0.13)";
  ctx.beginPath(); ctx.arc(cx - W * 0.155, W * 0.565, W * 0.05, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + W * 0.155, W * 0.565, W * 0.05, 0, 7); ctx.fill();

  // faint shadow under the (3D) nose
  ctx.fillStyle = "rgba(150,95,70,0.13)";
  ctx.beginPath(); ctx.ellipse(cx, W * 0.605, W * 0.032, W * 0.015, 0, 0, 7); ctx.fill();

  // mouth — a warm smile that shows TEETH (open jaw widens it); frown droops corners
  const mY = W * 0.635;
  const half = W * (0.092 + smile * 0.025 - frown * 0.02);
  const drop = W * (0.03 + smile * 0.02 + open * 0.05);   // how far the smile curves down
  const cornerY = mY + frown * W * 0.05;                  // corners sink when frowning
  // outer mouth shape (lips/gum), a crescent that lifts at the corners
  ctx.fillStyle = "#9C4A3F";
  ctx.beginPath();
  ctx.moveTo(cx - half, cornerY);
  ctx.quadraticCurveTo(cx, mY + drop * 1.7, cx + half, cornerY);   // bottom (the smile)
  ctx.quadraticCurveTo(cx, mY + drop * 0.45, cx - half, cornerY);  // top
  ctx.closePath(); ctx.fill();
  // teeth — white fill in the upper portion (clipped to the mouth shape)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - half, cornerY);
  ctx.quadraticCurveTo(cx, mY + drop * 1.7, cx + half, cornerY);
  ctx.quadraticCurveTo(cx, mY + drop * 0.45, cx - half, cornerY);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = "#FFFDFA";
  ctx.fillRect(cx - half, mY - drop, half * 2, drop * (open > 0.18 ? 1.4 : 1.9)); // teeth band (smaller when jaw open → shows gap)
  ctx.strokeStyle = "rgba(150,120,110,0.18)"; ctx.lineWidth = W * 0.004;         // subtle tooth gaps
  for (let x = -half * 0.5; x < half * 0.6; x += half * 0.45) { ctx.beginPath(); ctx.moveTo(cx + x, mY - drop); ctx.lineTo(cx + x, mY + drop); ctx.stroke(); }
  ctx.restore();
  // upper lip line + a soft lower-lip highlight
  ctx.strokeStyle = "rgba(90,40,36,0.55)"; ctx.lineWidth = W * 0.01;
  ctx.beginPath(); ctx.moveTo(cx - half * 1.04, mY - W * 0.003); ctx.quadraticCurveTo(cx, mY + drop * 0.4, cx + half * 1.04, mY - W * 0.003); ctx.stroke();
  ctx.strokeStyle = "rgba(255,225,220,0.4)"; ctx.lineWidth = W * 0.007;
  ctx.beginPath(); ctx.moveTo(cx - half * 0.55, mY + drop * 1.35); ctx.quadraticCurveTo(cx, mY + drop * 1.75, cx + half * 0.55, mY + drop * 1.35); ctx.stroke();
}

export function makeFaceTexture(expr = {}) {
  const W = 512;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return null;
  canvas.width = canvas.height = W;
  drawFace(canvas.getContext("2d"), W, expr);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// A mutable face texture that redraws when the expression changes (quantized so we
// don't redraw the canvas every single frame).
export class FaceCanvas {
  constructor() {
    const W = 512;
    this.W = W;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = W;
    this.ctx = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this._key = null;
    this.update({});
  }
  update(e) {
    e = e || {};
    const q = (v) => Math.round(clamp01(v) * 8);
    const qw = (v) => Math.round((e.eyeWide == null ? 1 : e.eyeWide) * 6);
    const qs = (v) => Math.round(Math.max(-1, Math.min(1, v || 0)) * 5); // signed (gaze)
    const key = `${q(e.smile)},${q(e.open)},${q(e.blinkL)},${q(e.blinkR)},${q(e.brow)},${q(e.browLower)},${q(e.frown)},${qw(e.eyeWide)},${qs(e.gazeX)},${qs(e.gazeY)}`;
    if (key === this._key) return;
    this._key = key;
    drawFace(this.ctx, this.W, e);
    this.tex.needsUpdate = true;
  }
}
