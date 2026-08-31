"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import OurGuyMixamo from "./OurGuyMixamo";

// Krupesh's buddy look: magenta cap, green shirt, tan skin, black legs.
const AVATAR = { skin: "#E7B083", shirt: "#2FB58A", jeans: "#151515", hair: "#B0347A", body: "masc" };

// The real Copycat 3D character on a transparent canvas — idles, and moves its
// mouth while `expressionRef.current.talking` is true. Same character as
// copycat.tools, rendered in the book's corner.
export default function Character3D({ expressionRef, dancing = false }) {
  // Keep the WebGL canvas matched to its (viewport-scaled) container. fiber v9 +
  // React 19 can leave the canvas at its mount size, so we (1) nudge r3f once on
  // mount and (2) re-nudge whenever the viewport height actually changes — the
  // buddy is sized in vh, so a taller/shorter viewport (window resize, mobile
  // URL bar, orientation) must re-fit the canvas. r3f re-measures on the window
  // "resize" event, so we fire that (debounced, and only on a real change).
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    const t = setTimeout(nudge, 60);
    let last = window.innerHeight;
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.innerHeight !== last) {
          last = window.innerHeight;
          nudge();
        }
      });
    };
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onChange);
      ro.observe(document.documentElement);
    }
    window.visualViewport?.addEventListener("resize", onChange);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.visualViewport?.removeEventListener("resize", onChange);
    };
  }, []);
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.1, 5.5], fov: 32 }}
      dpr={[1, 2]}
      resize={{ scroll: false }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 6, 4]} intensity={1.5} />
      <spotLight position={[-4, 5, 2]} angle={0.5} intensity={25} color="#ffd9b0" />
      <Suspense fallback={null}>
        <OurGuyMixamo mode={dancing ? "dance" : "idle"} avatar={AVATAR} expressionRef={expressionRef} />
      </Suspense>
    </Canvas>
  );
}
