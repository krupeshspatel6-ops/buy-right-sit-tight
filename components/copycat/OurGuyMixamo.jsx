"use client";
import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FaceCanvas, EXPRESSIONS } from "./faceTexture";
import { DEFAULT_AVATAR, lighten } from "./avatar";
import { solvePose, applyPose, solveFace, faceExpr } from "./kalidokitRig";

// Per-gesture finger curl amounts [thumb, index, middle, ring, pinky] (0 = straight,
// ~1.2 = fully folded). Curl axis is +x on each phalanx (MEASURED, not guessed).
function fingerShape(gesture, t) {
  switch (gesture) {
    case "point": return [0.55, 0.0, 1.15, 1.2, 1.2];    // index out, rest folded
    case "count": {                                       // tick fingers up one at a time
      const n = Math.floor(((t * 0.55) % 1) * 5);         // 0..4 rolling
      return [0, 1, 2, 3, 4].map((f) => (f <= n ? 0.05 : 1.15));
    }
    case "small": case "precision": return [0.7, 0.72, 1.08, 1.15, 1.2]; // pinch (thumb+index tips)
    case "thumbs_up": return [0.0, 1.2, 1.2, 1.2, 1.2];  // thumb out, fist closed
    case "chop": return [0.12, 0.1, 0.1, 0.1, 0.1];      // flat blade
    case "open_palms": case "offering": case "big": case "wave": return [0.12, 0.1, 0.1, 0.12, 0.16];
    case "self": return [0.2, 0.2, 0.22, 0.26, 0.32];
    default: return [0.3, 0.3, 0.32, 0.36, 0.42];        // relaxed natural curl
  }
}
const FINGER_ORDER = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

// Per-gesture target arm pose, in axes DERIVED from the real rig (measured Jacobian):
//   lift  → s * arm.rz  : raises the hand up-and-forward (dominant axis)
//   elbow → s * fore.rz : bends the forearm up
//   reach → -fore.rx    : extends the hand toward the viewer (same sign both arms)
// side s = +1 (left) / -1 (right). No visible fingers, so everything reads at arm level.
function gestureTarget(id, s, t, emph = 0) {
  const P = (lift, elbow, reach) => ({ lift, elbow, reach });
  const L = s > 0; // is this the left arm
  switch (id) {
    case "point": // leading (left) arm reaches toward the viewer; other relaxed
      return L ? P(0.7, 0.15, 1.0) : P(0.35, 0.45, 0.15);
    case "big": // both arms up and out, elbows fairly open (expansion / big picture)
      return P(1.15, 0.2, 0.15);
    case "small": // hands up close together in front (compression / "tiny")
      return P(0.6, 1.05, 0.1);
    case "count": // both up, palms out, ready to tick items
      return P(0.75, 0.8, 0.2);
    case "offering": // forearms out toward viewer, palms up (inviting)
      return P(0.5, 0.55, 0.5);
    case "chop": // leading hand chops down on the beat (lift dips with the pulse)
      return L ? P(0.85 - emph * 0.6, 0.35, 0.25) : P(0.4, 0.45, 0.15);
    case "compare_a": // left hand up, right low
      return L ? P(0.85, 0.7, 0.25) : P(0.3, 0.4, 0.1);
    case "compare_b": // right hand up, left low
      return L ? P(0.3, 0.4, 0.1) : P(0.85, 0.7, 0.25);
    case "wave": // right hand up HIGH, waving; left relaxed low
      return !L ? P(1.75 + Math.sin(t * 9) * 0.12, 0.55, 0.1) : P(0.3, 0.4, 0.1);
    case "growth": // both hands rising over time
      return P(0.7 + Math.sin(t * 1.2) * 0.35, 0.45, 0.2);
    case "circular": // leading hand circles (process / cycle)
      return L ? P(0.75 + Math.sin(t * 3) * 0.28, 0.6 + Math.cos(t * 3) * 0.25, 0.35) : P(0.35, 0.45, 0.1);
    case "thumbs_up": // fist up near the chest, thumb out (approval)
      return P(0.7, 0.95, 0.25);
    case "precision": // hand up in front, pinching a small detail toward the viewer
      return P(0.6, 0.95, 0.45);
    case "self": // hands in toward the chest ("I / we") — reach back toward the body
      return P(0.55, 1.1, -0.35);
    case "open_palms": // openness / honesty (default talking pose)
      return P(0.72, 0.6, 0.25);
    case "idle":
    default: // relaxed, hands a little up in front — natural conversational rest
      return P(0.45, 0.5, 0.15);
  }
}

// "Our guy" — the user's avatar colors re-skinned onto the REAL Mixamo skeleton,
// so he does EXACTLY what the Mixamo dancer does (same skeleton, same clips) with
// proper human proportions + a real neck bone. We hide the stock mannequin mesh
// and attach our own colored capsules to each bone, sized from the skeleton itself.

const BASE = "/models/anims/dance1.glb";                 // skeleton + the dance clip
const IDLE = "/models/anims/M_Standing_Idle_001.glb";    // idle clip (same rig)
useGLTF.preload(BASE); useGLTF.preload(IDLE);

// --- procedural gesture helpers (layered on top of the idle clip each frame) ---
const _ge = new THREE.Euler();
const _gq = new THREE.Quaternion();
// post-multiply a small local rotation onto whatever pose the mixer just set
function nudge(bone, rx, ry, rz) {
  if (!bone || (!rx && !ry && !rz)) return;
  _gq.setFromEuler(_ge.set(rx, ry, rz, "XYZ"));
  bone.quaternion.multiply(_gq);
}

// first bone whose name ends with `suffix` (handles mixamorig / mixamorig: prefixes)
function findBone(root, suffix) {
  let f = null; const s = suffix.toLowerCase();
  root.traverse((o) => { if (!f && o.isBone && o.name.toLowerCase().endsWith(s)) f = o; });
  return f;
}
// The idle clip's tracks target bone names in a different naming style than this
// skeleton (three sanitizes names on load), so it won't bind → stuck T-pose. Retarget
// each track to the ACTUAL scene bone by matching the bare bone suffix.
function retargetToScene(clip, scene) {
  const names = [];
  scene.traverse((o) => { if (o.isBone) names.push(o.name); });
  const find = (bare) => {
    const b = bare.toLowerCase();
    return names.find((n) => { const s = n.toLowerCase(); return s === b || s.endsWith(":" + b) || s.endsWith("_" + b) || s.endsWith(b); });
  };
  const c = clip.clone();
  for (const t of c.tracks) {
    const dot = t.name.indexOf(".");
    if (dot < 0) continue;
    const bare = t.name.slice(0, dot).replace(/^mixamorig[:_]?/i, "");
    const prop = t.name.slice(dot);
    const target = find(bare);
    if (target) t.name = target + prop;
  }
  return c;
}
// adjacent [parent, child] bone pairs walking up from `child` to `ancestor`
function chain(child, ancestor) {
  const out = []; let c = child;
  while (c && c.parent) { out.push([c.parent, c]); if (c.parent === ancestor) break; c = c.parent; }
  return out;
}

// MediaPipe pose landmark indices (so we don't import the heavy mediapipe module)
const LMI = { shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28 };
// which bone copies which landmark segment: [side, boneKey, childKey(for rest dir), parentLM, childLM]
const RIG_MAP = [
  ["L", "arm", "fore", "shoulderL", "elbowL"], ["L", "fore", "hand", "elbowL", "wristL"],
  ["R", "arm", "fore", "shoulderR", "elbowR"], ["R", "fore", "hand", "elbowR", "wristR"],
  ["L", "up", "leg", "hipL", "kneeL"], ["L", "leg", "foot", "kneeL", "ankleL"],
  ["R", "up", "leg", "hipR", "kneeR"], ["R", "leg", "foot", "kneeR", "ankleR"],
];
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _tgt = new THREE.Vector3(), _rest = new THREE.Vector3(), _pq = new THREE.Quaternion();
// map a landmark to the character's world space (same convention as PoseFigure)
function lmVec(lm, i, mirror, out) { const l = lm[i]; if (!l) return null; out.set((mirror ? -l.x : l.x), -l.y, -l.z); return out; }

export default function OurGuyMixamo({ mode = "dance", avatar = DEFAULT_AVATAR, expressionRef, landmarksRef, mirror = true }) {
  const MOCAP = !!landmarksRef;
  const faceMeshRef = useRef(null);
  const facesRef = useRef(null); // {n,a,b} pre-baked face textures (built fresh in the effect)
  const SKIN = avatar?.skin || DEFAULT_AVATAR.skin;
  const SKIN2 = lighten(SKIN, 14);
  const SHIRT = avatar?.shirt || DEFAULT_AVATAR.shirt;
  const JEANS = avatar?.jeans || DEFAULT_AVATAR.jeans;
  const HAIR = avatar?.hair || DEFAULT_AVATAR.hair;
  const danceG = useGLTF(BASE);
  const idleG = useGLTF(IDLE);
  // clone per instance so multiple characters on one page don't share/corrupt the rig
  const scene = useMemo(() => skeletonClone(danceG.scene), [danceG.scene]);
  const clips = useMemo(() => [...danceG.animations, ...idleG.animations.map((c) => retargetToScene(c, scene))], [danceG, idleG, scene]);
  const { actions } = useAnimations(clips, scene);
  const danceName = danceG.animations[0]?.name;
  const idleName = idleG.animations[0]?.name;
  const grp = useRef();
  const headRef = useRef(null);
  const handRef = useRef(null);
  const gestRef = useRef(null);          // gesture bones captured after re-skin
  const clockRef = useRef(new THREE.Clock());
  const envRef = useRef(0);              // 0..1 talk-gesture envelope (eases in/out)
  const faceCanvasRef = useRef(null);    // live-redrawn expressive face
  const blinkRef = useRef({ next: 1.5, t: 0 }); // blink scheduler
  // smoothed per-side arm-pose offsets (eased toward the active gesture's target)
  const poseRef = useRef({ L: { lift: 0.45, elbow: 0.5, reach: 0.15, curls: [0.3, 0.3, 0.32, 0.36, 0.42] }, R: { lift: 0.45, elbow: 0.5, reach: 0.15, curls: [0.3, 0.3, 0.32, 0.36, 0.42] } });
  const emoRef = useRef({ chin: 0, lean: 0, tilt: 0 }); // smoothed emotion posture
  const walkRef = useRef(0); // 0..1 walking envelope
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Re-skin once: attach our colored parts to the skeleton, hide the original mesh.
  useEffect(() => {
    if (!scene) return;
    const Y = new THREE.Vector3(0, 1, 0);
    const hips = findBone(scene, "Hips"), neck = findBone(scene, "Neck"), head = findBone(scene, "Head");
    headRef.current = head;
    handRef.current = findBone(scene, "LeftHand");
    // bones we animate for lifelike talking gestures
    gestRef.current = {
      hips, head, neck,
      spine: findBone(scene, "Spine1") || findBone(scene, "Spine"),
      chest: findBone(scene, "Spine2") || findBone(scene, "Spine1"),
      L: { arm: findBone(scene, "LeftArm"), fore: findBone(scene, "LeftForeArm"), hand: findBone(scene, "LeftHand"), up: findBone(scene, "LeftUpLeg"), leg: findBone(scene, "LeftLeg"), foot: findBone(scene, "LeftFoot") },
      R: { arm: findBone(scene, "RightArm"), fore: findBone(scene, "RightForeArm"), hand: findBone(scene, "RightHand"), up: findBone(scene, "RightUpLeg"), leg: findBone(scene, "RightLeg"), foot: findBone(scene, "RightFoot") },
    };
    if (typeof window !== "undefined") {
      const g = gestRef.current;
      window.__gestOK = { hips: !!g.hips, spine: !!g.spine, chest: !!g.chest, neck: !!g.neck, head: !!g.head,
        Larm: !!g.L.arm, Lfore: !!g.L.fore, Lhand: !!g.L.hand, Rarm: !!g.R.arm, Rfore: !!g.R.fore, Rhand: !!g.R.hand };
      window.__gestSample = () => { const b = g.L.fore; return b ? { x: +b.quaternion.x.toFixed(3), y: +b.quaternion.y.toFixed(3), z: +b.quaternion.z.toFixed(3), w: +b.quaternion.w.toFixed(3) } : null; };
      // world positions of the hands/head (relative to head) — ground truth for pose checks
      window.__handPos = () => {
        const w = (b) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return v; };
        const hd = w(g.head); const rel = (b) => { const p = w(b); return { x: +(p.x - hd.x).toFixed(3), y: +(p.y - hd.y).toFixed(3), z: +(p.z - hd.z).toFixed(3) }; };
        return { L: rel(g.L.hand), R: rel(g.R.hand) };
      };
    }

    // body height in the skeleton's OWN (bone-local) units → radii scale with the rig
    let H = 0;
    if (head && hips) for (const [, c] of chain(head, hips)) H += c.position.length();
    if (!H) H = 1;

    const parts = [];
    const bone = (parent, child, color, r) => {
      const v = child.position.clone(), len = v.length();
      if (len < 1e-5) return;
      const geo = new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, len * 0.35), 6, 12);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
      m.position.copy(v).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(Y, v.clone().normalize());
      parent.add(m); parts.push(m);
    };

    // torso (shirt) — every spine segment from hips up to neck
    if (neck && hips) for (const [p, c] of chain(neck, hips)) bone(p, c, SHIRT, H * 0.135);
    // neck (skin)
    if (head && neck) for (const [p, c] of chain(head, neck)) bone(p, c, SKIN, H * 0.05);
    // arms — upper (shirt sleeve) + lower (skin)
    for (const side of ["Left", "Right"]) {
      const hand = findBone(scene, side + "Hand"), arm = findBone(scene, side + "Arm");
      if (hand && arm) for (const [p, c] of chain(hand, arm)) {
        const lower = /forearm$/i.test(p.name);
        bone(p, c, lower ? SKIN : SHIRT, H * (lower ? 0.05 : 0.058));
      }
    }
    // hands — a palm + articulated fingers on the rig's existing finger bones
    // (Mixamo ships these bones; we just never rendered them → the guy had stumps).
    const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky", "LittleFinger"];
    const fingerBones = { Left: {}, Right: {} };
    const foundFingers = [];
    for (const side of ["Left", "Right"]) {
      const hand = findBone(scene, side + "Hand");
      if (!hand) continue;
      const mid1 = findBone(scene, side + "HandMiddle1");
      // palm: a soft flattened block from the wrist toward the finger bases
      if (mid1) {
        const v = mid1.position.clone(), len = Math.max(v.length(), H * 0.02);
        const palm = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.55, len * 0.9, 5, 8), new THREE.MeshStandardMaterial({ color: SKIN }));
        palm.position.copy(v.clone().multiplyScalar(0.45)); palm.scale.set(1.7, 1, 0.7);
        palm.quaternion.setFromUnitVectors(Y, v.clone().normalize());
        hand.add(palm); parts.push(palm);
      }
      for (const f of FINGERS) {
        const seg1 = findBone(scene, side + "Hand" + f + "1");
        if (!seg1) continue;
        if (f !== "LittleFinger" || !fingerBones[side].Pinky) foundFingers.push(side + f);
        const key = f === "LittleFinger" ? "Pinky" : f;
        const chainBones = [];
        for (let i = 1; i <= 4; i++) {
          const b = findBone(scene, side + "Hand" + f + i);
          if (b) chainBones.push(b);
        }
        // draw a slim capsule for each phalanx that has a child to span to
        for (let i = 0; i < chainBones.length - 1; i++) {
          bone(chainBones[i], chainBones[i + 1], SKIN, Math.max(H * 0.010, chainBones[i + 1].position.length() * 0.34));
        }
        // tip cap on the last phalanx (fingers have no tip bone) so they aren't cut short
        const tip = chainBones[chainBones.length - 1];
        if (tip && chainBones.length >= 2) {
          const seglen = chainBones[chainBones.length - 1].position.length() || H * 0.02;
          const cap = new THREE.Mesh(new THREE.SphereGeometry(Math.max(H * 0.010, seglen * 0.34), 6, 6), new THREE.MeshStandardMaterial({ color: SKIN }));
          cap.position.copy(tip.position.clone().normalize().multiplyScalar(seglen * 0.9)); tip.add(cap); parts.push(cap);
        }
        fingerBones[side][key] = chainBones; // for curling later
      }
    }
    gestRef.current.L.fingers = fingerBones.Left;
    gestRef.current.R.fingers = fingerBones.Right;
    if (typeof window !== "undefined") {
      window.__fingers = foundFingers;
      // fingertip position (relative to the wrist) — ground truth for deriving the curl axis
      window.__fingerTip = (side, name) => {
        const arr = fingerBones[side][name]; if (!arr || arr.length < 2) return null;
        const tip = arr[arr.length - 1], hand = side === "Left" ? gestRef.current.L.hand : gestRef.current.R.hand;
        const v = new THREE.Vector3(); tip.getWorldPosition(v); const h = new THREE.Vector3(); hand.getWorldPosition(h);
        return { x: +(v.x - h.x).toFixed(3), y: +(v.y - h.y).toFixed(3), z: +(v.z - h.z).toFixed(3) };
      };
    }
    // legs (jeans)
    for (const side of ["Left", "Right"]) {
      const foot = findBone(scene, side + "Foot"), up = findBone(scene, side + "UpLeg");
      if (foot && up) for (const [p, c] of chain(foot, up)) bone(p, c, JEANS, H * 0.066);
    }
    // head (skin sphere + hair cap) on the Head bone
    if (head) {
      const top = findBone(scene, "HeadTop_End");
      const up = top ? top.position.clone() : new THREE.Vector3(0, H * 0.14, 0);
      const hr = (top ? up.length() : H * 0.14) * 1.05;
      const at = up.clone().multiplyScalar(0.55);
      const hs = new THREE.Mesh(new THREE.SphereGeometry(hr, 28, 28), new THREE.MeshStandardMaterial({ color: SKIN2 }));
      hs.position.copy(at); hs.scale.set(1.0, 1.04, 0.94); head.add(hs); parts.push(hs); // gently head-shaped, not a football
      const hair = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshStandardMaterial({ color: HAIR }));
      hair.position.copy(at); hair.position.y += hr * 0.06; hair.scale.set(1.0, 1.0, 0.96); head.add(hair); parts.push(hair);

      // face (eyes/ears/nose/brows/lips). The character faces the camera (world +Z),
      // so aim the face there directly (no shoulder guessing): face-local -Z → world +Z.
      scene.updateMatrixWorld(true);
      const hq = new THREE.Quaternion(); head.getWorldQuaternion(hq);
      const faceWorld = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      const face = new THREE.Group();
      face.quaternion.copy(hq.clone().invert().multiply(faceWorld));
      face.position.copy(at); face.scale.setScalar(hr / 0.125);
      const R = 0.125;
      // small, flatter ears at the sides
      for (const sx of [1, -1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshStandardMaterial({ color: SKIN }));
        ear.position.set(sx * R * 0.98, 0, 0.01); ear.scale.set(0.6, 1, 0.55); face.add(ear); parts.push(ear);
      }
      // painted 2D face on a flat plane at the front — a LIVE canvas we redraw as the
      // expression (emotion + mouth-open + blink) changes, so the face is fully alive.
      const faceCanvas = new FaceCanvas();
      faceCanvasRef.current = faceCanvas;
      facesRef.current = faceCanvas; // for disposal
      const faceMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(R * 1.95, R * 1.95),
        new THREE.MeshBasicMaterial({ map: faceCanvas.tex, transparent: true, depthWrite: false })
      );
      faceMesh.position.set(0, R * 0.04, -R * 1.02); faceMesh.rotation.y = Math.PI; // face the -Z front
      faceMeshRef.current = faceMesh;
      face.add(faceMesh); parts.push(faceMesh);
      // soft 3D nose (catches light like the reference)
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshStandardMaterial({ color: SKIN2, roughness: 0.85 }));
      nose.position.set(0, -0.012, -R * 1.0); nose.scale.set(1, 0.85, 1.25); face.add(nose); parts.push(nose);
      head.add(face); parts.push(face);
      // probe: confirm the face plane ends up in FRONT of the head (world +Z toward camera)
      scene.updateMatrixWorld(true);
      const hp = new THREE.Vector3(); head.getWorldPosition(hp);
      const np = new THREE.Vector3(); faceMesh.getWorldPosition(np);
      if (typeof window !== "undefined") window.__facedbg = { faceDz: +(np.z - hp.z).toFixed(4), faceParts: face.children.length };
    }

    // hide the stock mannequin, keep our parts
    let hid = 0;
    if (parts.length) scene.traverse((o) => { if (o.isMesh && !parts.includes(o)) { o.visible = false; hid++; } });
    if (typeof window !== "undefined") window.__reskin = { parts: parts.length, hidden: hid, H: +H.toFixed(2) };

    // fit to ~2 units tall, feet near the floor
    const box = new THREE.Box3().setFromObject(scene); const size = new THREE.Vector3(); box.getSize(size);
    if (grp.current) { grp.current.scale.setScalar(2.0 / (size.y || 1)); grp.current.position.y = -1.0; }

    return () => {
      parts.forEach((m) => { m.parent && m.parent.remove(m); m.geometry && m.geometry.dispose(); m.material && m.material.dispose(); });
      if (faceCanvasRef.current && faceCanvasRef.current.tex) { faceCanvasRef.current.tex.dispose(); faceCanvasRef.current = null; facesRef.current = null; }
      scene.traverse((o) => { if (o.isMesh) o.visible = true; });
    };
  }, [scene, SKIN, SHIRT, JEANS, HAIR]); // eslint-disable-line react-hooks/exhaustive-deps

  // play the clip for the current state (but NOT in mocap mode — landmarks drive the bones)
  useEffect(() => {
    if (!actions) return;
    if (MOCAP) { Object.values(actions).forEach((a) => a && a.stop()); return; }
    const want = mode === "idle" ? idleName : danceName;
    Object.values(actions).forEach((a) => a && a.fadeOut(0.3));
    const a = want && actions[want];
    if (a) a.reset().fadeIn(0.3).play();
    if (typeof window !== "undefined") window.__anim = { mode, want, keys: Object.keys(actions || {}), played: !!a };
  }, [mode, actions, idleName, danceName, MOCAP]);

  useFrame((_, delta) => {
    // ---- MOCAP: full-body copy via Kalidokit (arms, legs, torso, turn, step, face) ----
    if (MOCAP) {
      const g = gestRef.current, data = landmarksRef.current;
      if (g && data) {
        const pose = solvePose(data.lm3d, data.lm2d, data.video);
        if (pose) applyPose(g, pose, grp.current);
        const fc0 = faceCanvasRef.current;
        if (fc0) {
          const fx = data.face ? faceExpr(solveFace(data.face, data.video)) : (expressionRef && expressionRef.current);
          if (fx) fc0.update(fx);
        }
      }
      return; // Kalidokit drives everything in mocap mode
    }
    const dt = Math.min(delta || 0.016, 0.05);
    const exp = (expressionRef && expressionRef.current) || {};
    const force = typeof window !== "undefined" && window.__forceTalk;
    const talking = force ? true : !!exp.talking;
    const lvl = force ? (window.__forceLevel ?? 0.5) : (exp.open || 0);
    const emotion = force ? (window.__forceEmotion || "confident") : (exp.emotion || "neutral");
    const gesture = force ? (window.__forceGesture || "open_palms") : (exp.gesture || "idle");
    const t = clockRef.current.getElapsedTime();

    // ---- body gesture layer (arms/head/torso), layered on top of the idle clip ----
    const g = gestRef.current;
    if (g && modeRef.current === "idle") {
      envRef.current += ((talking ? 1 : 0) - envRef.current) * 0.08; // ease in/out
      const E = envRef.current;
      // emotion posture targets — chin (up=confident/excited, down=serious), lean, tilt
      const chinT = (emotion === "confident" || emotion === "excited") ? -0.10 : (emotion === "serious" || emotion === "concerned" || emotion === "thinking") ? 0.09 : 0;
      const leanT = (emotion === "excited" || emotion === "curious") ? 0.06 : (emotion === "thinking" || emotion === "serious") ? -0.04 : 0.01;
      const tiltT = (emotion === "curious" || emotion === "thinking") ? 0.12 : 0;
      const em = emoRef.current;
      em.chin += (chinT - em.chin) * 0.06; em.lean += (leanT - em.lean) * 0.06; em.tilt += (tiltT - em.tilt) * 0.06;

      // ---- walk cycle (works even when not talking — e.g. during the guided tour) ----
      const walking = force ? !!window.__forceWalk : !!exp.walking;
      walkRef.current += ((walking ? 1 : 0) - walkRef.current) * 0.10;
      const W = walkRef.current;
      let bob = 0;
      if (W > 0.003) {
        const wt = t * 8.5;             // stride cadence
        const sw = Math.sin(wt);
        nudge(g.L.up, sw * 0.55 * W, 0, 0);        // hips flex, opposite phase
        nudge(g.R.up, -sw * 0.55 * W, 0, 0);
        nudge(g.L.leg, Math.max(0, -sw) * 0.75 * W, 0, 0);   // knee bends on back-swing
        nudge(g.R.leg, Math.max(0, sw) * 0.75 * W, 0, 0);
        nudge(g.L.arm, 0, 0, -sw * 0.4 * W);       // arms swing opposite the legs
        nudge(g.R.arm, 0, 0, sw * 0.4 * W);
        nudge(g.spine, 0.14 * W, 0, 0);            // lean into the walk
        bob = Math.abs(Math.cos(wt)) * 0.035 * W;  // vertical bounce
      }
      if (grp.current) grp.current.position.y = -1.0 + bob;
      const gW = 1 - W;                            // gesture arms yield while walking

      if (E > 0.003) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const beatAge = (now - (exp.beat || 0)) / 1000;
        const pulse = talking ? Math.max(0, 1 - beatAge / 0.7) : 0;   // emphasis, decays
        const energy = (emotion === "excited" ? 1.35 : emotion === "serious" || emotion === "concerned" ? 0.7 : 1) * E;

        // torso sway + hip weight-shift + emotion lean
        nudge(g.hips, 0, Math.sin(t * 0.5) * 0.05 * E, Math.sin(t * 0.5 + 0.6) * 0.045 * E);
        nudge(g.spine, (Math.sin(t * 0.8) * 0.02) * E + em.lean * 0.5, Math.sin(t * 0.9) * 0.04 * E, 0);
        nudge(g.chest, (Math.sin(t * 0.8 + 1) * 0.02) * E + em.lean * 0.5, Math.sin(t * 0.9 + 0.5) * 0.05 * E, 0);
        // head: bob + nod (voice + beat) + emotion chin/tilt + slow "audience scan" yaw
        nudge(g.neck, (Math.sin(t * 1.2) * 0.03 + lvl * 0.04) * E + em.chin * 0.5, Math.sin(t * 1.6) * 0.04 * E, em.tilt * 0.5);
        nudge(g.head,
          (Math.sin(t * 1.15) * 0.04 + lvl * 0.06 + pulse * 0.10) * E + em.chin * 0.5,
          (Math.sin(t * 0.45) * 0.14 + Math.sin(t * 1.55) * 0.05) * E,   // scan L/C/R + micro
          Math.sin(t * 0.7) * 0.03 * E + em.tilt * 0.5);

        // DEBUG: raw single-axis probe to derive the true bone axes (window.__raw)
        const RAW = typeof window !== "undefined" && window.__raw;
        if (RAW) {
          nudge(g.L.arm, RAW.LarmX || 0, RAW.LarmY || 0, RAW.LarmZ || 0);
          nudge(g.L.fore, RAW.LforeX || 0, RAW.LforeY || 0, RAW.LforeZ || 0);
          nudge(g.R.arm, RAW.RarmX || 0, RAW.RarmY || 0, RAW.RarmZ || 0);
          nudge(g.R.fore, RAW.RforeX || 0, RAW.RforeY || 0, RAW.RforeZ || 0);
        } else
        // arms: ease each side toward the active gesture's target pose, add life + beat
        for (const key of ["L", "R"]) {
          const a = g[key]; if (!a) continue;
          const s = key === "L" ? 1 : -1;
          const tgt = gestureTarget(gesture, s, t, pulse);
          const cur = poseRef.current[key];
          const k = 1 - Math.pow(0.0015, dt);   // ~frame-rate-independent smoothing
          cur.lift += (tgt.lift - cur.lift) * k;
          cur.elbow += (tgt.elbow - cur.elbow) * k;
          cur.reach += (tgt.reach - cur.reach) * k;
          const phase = key === "L" ? 0 : Math.PI;
          const osc = Math.sin(t * 2.0 + phase) * 0.10 * energy;      // breathing life
          const lead = (exp.beatSide || 1) === s ? 1 : 0.45;
          const push = pulse * 0.45 * lead * energy;                 // emphasis on the beat
          const lift = (cur.lift + osc + push) * E * gW;
          const elbow = (cur.elbow + osc * 0.5) * E * gW;
          const reach = cur.reach * E * gW;
          nudge(a.arm, 0, 0, s * lift);          // raise up-and-forward (measured lift axis)
          nudge(a.fore, -reach, 0, s * elbow);   // elbow bend up + reach toward viewer
          nudge(a.hand, 0, 0, s * osc * 0.4);
        }

        // fingers: curl per gesture (curl axis = +x per phalanx, MEASURED). Ease toward
        // the target hand-shape so fingers fold/open smoothly instead of popping.
        const FR = typeof window !== "undefined" && window.__fingerRaw;
        const shape = fingerShape(gesture, t);
        for (const key of ["L", "R"]) {
          const fg = g[key].fingers; if (!fg) continue;
          if (FR && FR.side === (key === "L" ? "Left" : "Right")) {
            const arr = fg[FR.name];
            if (arr) for (const b of arr) { _gq.setFromEuler(_ge.set(FR.axis === "x" ? FR.amt : 0, FR.axis === "y" ? FR.amt : 0, FR.axis === "z" ? FR.amt : 0)); b.quaternion.multiply(_gq); }
            continue;
          }
          const curls = poseRef.current[key].curls;
          const kf = 1 - Math.pow(0.004, dt);
          for (let f = 0; f < 5; f++) {
            curls[f] += (shape[f] - curls[f]) * kf;
            const arr = fg[FINGER_ORDER[f]]; if (!arr) continue;
            const perPhalanx = curls[f] * 0.5 * E;   // spread the fold across 3 phalanges
            for (const b of arr) nudge(b, perPhalanx, 0, 0);
          }
        }
      }
    }

    // ---- face layer: emotion expression + mouth-open from voice + blinks ----
    const fc = faceCanvasRef.current;
    if (fc) {
      const EX = EXPRESSIONS[emotion] || EXPRESSIONS.neutral;
      // blink scheduler: quick close every few seconds
      const bk = blinkRef.current;
      bk.next -= dt;
      if (bk.next <= 0 && bk.t <= 0) { bk.t = 0.16; bk.next = 2.4 + (t % 2.6); }
      let blink = 0;
      if (bk.t > 0) { bk.t -= dt; blink = Math.sin(Math.max(0, bk.t) / 0.16 * Math.PI); } // 0→1→0
      fc.update({
        smile: EX.smile, brow: EX.brow, browLower: EX.browLower, frown: EX.frown, eyeWide: EX.eyeWide,
        open: talking ? Math.min(1, lvl) : 0,
        blinkL: blink, blinkR: blink,
      });
    }
  });

  return <group ref={grp}><primitive object={scene} /></group>;
}
