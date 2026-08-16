"use client";

import { Suspense, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, useGLTF, ContactShadows, Center } from "@react-three/drei";
import type { Group } from "three";
import type { RecipeId } from "@/lib/three/domain-recipes";

/* Live 3D item-detail hero viewer (src/app/book/[dropId]/page.tsx). Idle
 * animation runs continuously (item requirement 3: "動くようにしてほしい");
 * tapping re-plays an intensified burst (requirement 3's "LINEスタンプのよ
 * うに押したら動く"). Model asset is a self-hosted CC0 glTF (see
 * docs/asset-sources.md); the Sparkles preset reuses the same recipe
 * library as the app-open/completion effects (src/lib/three/domain-recipes.ts). */

const PRESETS: Record<RecipeId, { count: number; scale: number; size: number; speed: number }> = {
  radiant: { count: 24, scale: 2.4, size: 2, speed: 0.25 },
  arcane: { count: 34, scale: 2.8, size: 2.5, speed: 0.45 },
  ember: { count: 44, scale: 2.6, size: 3, speed: 0.8 },
  verdant: { count: 30, scale: 2.6, size: 2.2, speed: 0.15 },
  void: { count: 38, scale: 2.2, size: 2.5, speed: 0.55 },
};

function SpinningModel({
  url,
  burstUntil,
}: {
  url: string;
  burstUntil: RefObject<number>;
}) {
  const { scene } = useGLTF(url);
  const ref = useRef<Group>(null);
  const currentScale = useRef(1);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const bursting = performance.now() < burstUntil.current;
    ref.current.rotation.y += delta * (bursting ? 2.2 : 0.4);
    const targetScale = bursting ? 1.18 : 1;
    currentScale.current += (targetScale - currentScale.current) * 0.15;
    ref.current.scale.setScalar(currentScale.current);
  });

  return (
    <Center>
      <primitive ref={ref} object={scene} />
    </Center>
  );
}

interface ItemViewerProps {
  modelUrl: string;
  color: string;
  recipe: RecipeId;
  reducedMotion: boolean;
}

export function ItemViewer({ modelUrl, color, recipe, reducedMotion }: ItemViewerProps) {
  const [burstKey, setBurstKey] = useState(0);
  const burstUntil = useRef(0);
  const preset = PRESETS[recipe];

  function handleTap() {
    if (reducedMotion) return;
    burstUntil.current = performance.now() + 900;
    setBurstKey((key) => key + 1);
  }

  return (
    <button
      type="button"
      aria-label="タップして演出を再生"
      onClick={handleTap}
      className="block h-64 w-full touch-manipulation rounded-2xl bg-transparent"
    >
      <Canvas
        camera={{ position: [0, 0.6, 4.2], fov: 40 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} color={color} />
        <pointLight position={[-2, -1, 2]} intensity={0.6} color={color} />
        <Suspense fallback={null}>
          <SpinningModel url={modelUrl} burstUntil={burstUntil} />
          <ContactShadows opacity={0.35} scale={4} blur={2.4} far={2} />
        </Suspense>
        {!reducedMotion && (
          <Sparkles
            key={burstKey}
            count={preset.count}
            scale={preset.scale}
            size={preset.size}
            speed={preset.speed}
            color={color}
            opacity={0.8}
          />
        )}
      </Canvas>
    </button>
  );
}
