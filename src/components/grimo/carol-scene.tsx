"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import {
  decideCarolPointer,
  INITIAL_CAROL_INPUT,
  normalizeCarolContact,
} from "@/lib/domain/grimo-input";
import { CAROL, carolTouchImpulse, classifyCarolTouch } from "@/lib/domain/grimo-companions";
import { carolReactionStyle, inferCarolMoveReaction, type CarolReaction } from "@/lib/domain/grimo-reactions";
import type { CarolSettings } from "./carol-settings";
import { MacaronIcon } from "./macaron-icon";

type SceneApi = {
  contact: (x: number, y: number) => void;
  release: () => void;
  poke: () => void;
  react: (reaction: CarolReaction, x: number, y: number) => void;
};

function makeCloud(color: number, y: number, z: number) {
  const cloud = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 });
  for (const [x, radius, lift] of [[-1.25, 0.72, 0], [-0.45, 0.98, 0.2], [0.55, 0.8, 0.06], [1.2, 0.58, -0.08]] as const) {
    const puff = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), material);
    puff.position.set(x, y + lift, z);
    cloud.add(puff);
  }
  return { cloud, material };
}

export function CarolScene({ settings, onOpenReview, reviewOpen, foodNonce }: {
  settings: CarolSettings;
  onOpenReview: () => void;
  reviewOpen: boolean;
  /** Incremented only after IndexedDB has confirmed a macaron was consumed. */
  foodNonce: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const inputStateRef = useRef(INITIAL_CAROL_INPUT);
  const settingsRef = useRef(settings);
  const redrawRef = useRef<(() => void) | null>(null);
  const gestureRef = useRef({ startedAt: 0, x: 0, y: 0, distance: 0, taps: 0, lastTapAt: 0, holdTimer: undefined as number | undefined });

  useEffect(() => {
    settingsRef.current = settings;
    redrawRef.current?.();
  }, [settings]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 20);
    camera.position.z = 10;

    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x26214a });
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      skyMaterial,
    );
    sky.position.z = -3;
    scene.add(sky);

    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xf6e6ad, transparent: true, opacity: 0.92 });
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 48),
      moonMaterial,
    );
    moon.position.set(2.6, 2.6, -2);
    scene.add(moon);

    const far = makeCloud(0x665b91, 0, -1);
    const farClouds = far.cloud;
    scene.add(farClouds);
    const near = makeCloud(0xada5d1, 0, 2);
    const nearClouds = near.cloud;
    scene.add(nearClouds);

    const stars = new THREE.Group();
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffefb6, transparent: true, opacity: 0.9 });
    [[-3.8, 2.7], [-2.8, 1.8], [-1.8, 3.4], [0.4, 3.15], [3.75, 0.9]].forEach(([x, y]) => {
      const star = new THREE.Mesh(
        new THREE.CircleGeometry(0.045, 12),
        starMaterial,
      );
      star.position.set(x, y, -1);
      stars.add(star);
    });
    scene.add(stars);

    const texture = new THREE.TextureLoader().load("/grimo/carol-transparent.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    const carol = new THREE.Mesh(
      new THREE.PlaneGeometry(7.15, 4.58),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    carol.position.set(0, -0.15, 1);
    scene.add(carol);

    const target = new THREE.Vector2();
    const current = new THREE.Vector2();
    let pulse = 0;
    let released = false;
    let frame = 0;
    let last = performance.now();
    let idleTimer: number | undefined;
    let starPulse = 0;
    let lastReactionAt = last;

    const applySettings = () => {
      const config = settingsRef.current;
      skyMaterial.color.set(String(config.skyColor));
      moonMaterial.color.set(String(config.moonColor));
      moonMaterial.opacity = Number(config.moonOpacity);
      moon.position.set(Number(config.moonX), Number(config.moonY), -2);
      moon.scale.setScalar(Number(config.moonSize));
      far.material.color.set(String(config.farCloudColor));
      far.material.opacity = Number(config.farCloudOpacity);
      farClouds.scale.set(Number(config.farCloudWidth), Number(config.farCloudHeight), 1);
      farClouds.position.y = Number(config.farCloudY);
      near.material.color.set(String(config.nearCloudColor));
      near.material.opacity = Number(config.nearCloudOpacity);
      nearClouds.scale.set(Number(config.nearCloudWidth), Number(config.nearCloudHeight), 1);
      nearClouds.position.y = Number(config.nearCloudY);
      starMaterial.opacity = Number(config.starOpacity);
      carol.position.set(Number(config.carolX), Number(config.carolY), 1);
      carol.scale.setScalar(Number(config.carolScale));
    };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      applySettings();
      const config = settingsRef.current;
      if (!reducedMotion) {
        if (now - lastReactionAt > 12000) apiRef.current?.react("wait", 0, 0);
        current.lerp(target, Math.min(1, dt * Number(config.follow)));
        target.multiplyScalar(released ? Math.max(0, 1 - dt * Number(config.release)) : 1);
        pulse = Math.max(0, pulse - dt * Number(config.pulseDecay));
        starPulse = Math.max(0, starPulse - dt * 1.8);
        carol.position.set(Number(config.carolX) + current.x, Number(config.carolY) + current.y, 1);
        carol.scale.setScalar(Number(config.carolScale));
        farClouds.position.x = -current.x * Number(config.farParallax);
        nearClouds.scale.x = Number(config.nearCloudWidth) + pulse * Number(config.nearStretch);
        nearClouds.position.x = current.x * Number(config.nearParallax);
        stars.position.y = Math.sin(now / Number(config.starPeriod)) * Number(config.starDrift) + starPulse * 0.12;
        stars.scale.setScalar(1 + starPulse * 0.2);
      }
      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    redrawRef.current = () => {
      applySettings();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      const aspect = width / Math.max(height, 1);
      camera.left = -5 * aspect;
      camera.right = 5 * aspect;
      camera.top = 5;
      camera.bottom = -5;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    if (!reducedMotion) frame = requestAnimationFrame(render);

    const react = (reaction: CarolReaction, x: number, y: number) => {
        const config = settingsRef.current;
        const zone = classifyCarolTouch({ x, y });
        const impulse = carolTouchImpulse(zone);
        const style = carolReactionStyle(reaction, zone);
        lastReactionAt = performance.now();
        released = false;
        target.set(
          (x + impulse.characterX * style.displacement) * Number(config.responseX),
          (y + impulse.characterY * style.displacement) * Number(config.responseY),
        );
        pulse = Math.min(1, pulse + Number(config.pulse) * impulse.cloud * style.cloud);
        starPulse = Math.min(1, starPulse + impulse.stars * style.stars);
        if (idleTimer !== undefined) window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => { released = true; }, style.settleMs);
        if (reducedMotion) renderer.render(scene, camera);
    };

    apiRef.current = {
      react,
      contact(x, y) {
        react("zone-touch", x, y);
      },
      release() {
        react("release", 0, 0);
        released = true;
      },
      poke() {
        react("poke", 0.3, 0.05);
      },
    };
    react("arrival", 0, 0);

    const cancelForInterruption = () => {
      const decision = decideCarolPointer(inputStateRef.current, { type: "interrupt" });
      inputStateRef.current = decision.state;
      if (decision.release) apiRef.current?.release();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelForInterruption();
    };
    window.addEventListener("blur", cancelForInterruption);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("blur", cancelForInterruption);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (gestureRef.current.holdTimer !== undefined) window.clearTimeout(gestureRef.current.holdTimer);
      apiRef.current = null;
      redrawRef.current = null;
      texture.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (foodNonce > 0) apiRef.current?.react("food", 0.18, 0.12);
  }, [foodNonce]);

  const handlePointer = useCallback((event: React.PointerEvent<HTMLDivElement>, type: "down" | "move" | "up" | "cancel" | "lostcapture") => {
    const decision = decideCarolPointer(
      inputStateRef.current,
      type === "down" ? { type, pointerId: event.pointerId, isPrimary: event.isPrimary } : { type, pointerId: event.pointerId },
    );
    inputStateRef.current = decision.state;
    const point = normalizeCarolContact(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (decision.capture) {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (point) {
        const now = performance.now();
        const previous = gestureRef.current;
        gestureRef.current = { startedAt: now, x: point.x, y: point.y, distance: 0, taps: now - previous.lastTapAt < 420 ? previous.taps + 1 : 1, lastTapAt: previous.lastTapAt, holdTimer: window.setTimeout(() => apiRef.current?.react("hold", point.x, point.y), 520) };
      }
    }
    if (decision.contact && point) {
      const gesture = gestureRef.current;
      const step = Math.hypot(point.x - gesture.x, point.y - gesture.y);
      gesture.distance += step;
      gesture.x = point.x;
      gesture.y = point.y;
      apiRef.current?.react(type === "move" ? inferCarolMoveReaction(gesture.distance, performance.now() - gesture.startedAt) : "zone-touch", point.x, point.y);
    }
    if (decision.releaseCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (decision.release) {
      const gesture = gestureRef.current;
      if (gesture.holdTimer !== undefined) window.clearTimeout(gesture.holdTimer);
      const duration = performance.now() - gesture.startedAt;
      if (type === "up" && gesture.taps >= 2 && duration < 320) apiRef.current?.react("repeat-tap", gesture.x, gesture.y);
      else if (type === "up" && gesture.distance > 0.02) apiRef.current?.react(inferCarolMoveReaction(gesture.distance, duration), gesture.x, gesture.y);
      apiRef.current?.release();
      gesture.lastTapAt = performance.now();
    }
  }, []);

  return (
    <section className="grimo-scene" aria-labelledby="grimo-title">
      <div className="grimo-scene-copy">
        <p>星眠りの雲床</p>
        <h1 id="grimo-title">キャロル</h1>
      </div>
      <div
        ref={hostRef}
        className="grimo-stage"
        role="button"
        tabIndex={0}
        aria-label={`${CAROL.name}に触れる`}
        onPointerDown={(event) => handlePointer(event, "down")}
        onPointerMove={(event) => handlePointer(event, "move")}
        onPointerUp={(event) => handlePointer(event, "up")}
        onPointerCancel={(event) => handlePointer(event, "cancel")}
        onLostPointerCapture={(event) => handlePointer(event, "lostcapture")}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          apiRef.current?.poke();
        }}
      />
      {foodNonce > 0 && (
        <div className="grimo-food-flight" key={foodNonce} aria-hidden>
          <MacaronIcon className="grimo-food-flight-icon" />
        </div>
      )}
      <div className="grimo-actions" aria-label="キャロルとの触れ合い">
        <button type="button" onClick={() => apiRef.current?.react("slow-stroke", -0.5, 0.1)}>なでる</button>
        <button type="button" onClick={() => apiRef.current?.poke()}>くすぐる</button>
        <button type="button" onClick={() => apiRef.current?.react("hold", 0, -0.4)}>手のひらをあてる</button>
        <button type="button" aria-expanded={reviewOpen} onClick={onOpenReview}>{reviewOpen ? "調整を閉じる" : "目視調整を開く"}</button>
      </div>
    </section>
  );
}
