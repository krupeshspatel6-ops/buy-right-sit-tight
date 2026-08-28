"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import OurGuyMixamo from "./OurGuyMixamo";
import { loadAvatar } from "./avatar";

// The real Copycat 3D character on a transparent canvas — idles, and moves its
// mouth while `expressionRef.current.talking` is true. Same character as
// copycat.tools, rendered in the book's corner.
export default function Character3D({ expressionRef }) {
  const avatar = useMemo(() => loadAvatar(), []);
  // Nudge r3f's resize once mounted (fiber v9 + React 19 can otherwise leave the
  // canvas at its default 300x150 until the first window resize).
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(t);
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
        <OurGuyMixamo mode="idle" avatar={avatar} expressionRef={expressionRef} />
      </Suspense>
    </Canvas>
  );
}
