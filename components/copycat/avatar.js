// Per-user avatar look. localStorage-first so it works for everyone (no login);
// can sync to the account later. Shared by the mocap character + the clip character.
// `body`: "masc" | "femme" — femme gets a female silhouette (tapered waist, longer
// hair, a skirt). Default masc for back-compat.
export const DEFAULT_AVATAR = { skin: "#E7B083", shirt: "#39414E", jeans: "#3B4E82", hair: "#2E2014", body: "masc" };

export const BODIES = [
  { id: "masc", label: "♂ Guy" },
  { id: "femme", label: "♀ Girl" },
];

export const PRESETS = [
  { name: "Classic", skin: "#E7B083", shirt: "#39414E", jeans: "#3B4E82", hair: "#2E2014" },
  { name: "Sunset", skin: "#F0BC8E", shirt: "#F96302", jeans: "#3A3A4A", hair: "#3A1F12" },
  { name: "Mint", skin: "#E7B083", shirt: "#2FB58A", jeans: "#243447", hair: "#1E1A17" },
  { name: "Berry", skin: "#D89A6A", shirt: "#B0347A", jeans: "#2E2350", hair: "#241612" },
  { name: "Cocoa", skin: "#8D5A3B", shirt: "#EDEDED", jeans: "#33445E", hair: "#120C0A" },
  { name: "Ivory", skin: "#F2CBA6", shirt: "#3457D5", jeans: "#22324D", hair: "#6B4A2E" },
];

export const SKIN_TONES = ["#F2CBA6", "#E7B083", "#D89A6A", "#B87A4E", "#8D5A3B", "#5E3A24"];
export const SHIRT_COLORS = ["#39414E", "#F96302", "#2FB58A", "#B0347A", "#3457D5", "#EDEDED", "#E11D48", "#111827"];
export const JEANS_COLORS = ["#3B4E82", "#243447", "#2E2350", "#33445E", "#22324D", "#2A2A2A", "#4A3B2A"];
export const HAIR_COLORS = ["#2E2014", "#120C0A", "#6B4A2E", "#3A1F12", "#8A8A8A", "#C0A24A", "#B0347A"];

const KEY = "copycat_avatar";

// a fresh random look — every new user gets their own unique character
export function randomAvatar() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return { skin: pick(SKIN_TONES), shirt: pick(SHIRT_COLORS), jeans: pick(JEANS_COLORS), hair: pick(HAIR_COLORS) };
}

export function loadAvatar() {
  if (typeof localStorage === "undefined") return { ...DEFAULT_AVATAR };
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...DEFAULT_AVATAR, ...JSON.parse(s) };
    const r = randomAvatar();            // first visit → mint + persist a unique character
    localStorage.setItem(KEY, JSON.stringify(r));
    return r;
  } catch { return { ...DEFAULT_AVATAR }; }
}

export function saveAvatar(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

// a slightly lighter skin for the face/head highlight
export function lighten(hex, amt = 18) {
  const n = parseInt((hex || "#E7B083").slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt), g = Math.min(255, ((n >> 8) & 255) + amt), b = Math.min(255, (n & 255) + amt);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
