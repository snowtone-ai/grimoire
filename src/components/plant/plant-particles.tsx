"use client";

import { useEffect, useRef } from "react";

interface Props {
  color: string;
  active: boolean;
}

interface Petal {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  alpha: number;
}

export function PlantParticles({ color, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context = ctx;

    canvas.width = 300;
    canvas.height = 400;
    const petals: Petal[] = [];
    let frame = 0;

    function spawn() {
      petals.push({
        x: 80 + Math.random() * 140,
        y: 40 + Math.random() * 60,
        r: 3 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.5 + Math.random(),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.1,
        alpha: 0.9,
      });
    }

    function tick() {
      frame++;
      if (frame % 12 === 0 && petals.length < 15) spawn();
      context.clearRect(0, 0, 300, 400);

      for (let index = petals.length - 1; index >= 0; index--) {
        const petal = petals[index];
        if (!petal) continue;

        petal.x += petal.vx;
        petal.y += petal.vy;
        petal.rot += petal.vr;
        petal.alpha -= 0.005;

        if (petal.alpha <= 0 || petal.y > 400) {
          petals.splice(index, 1);
          continue;
        }

        context.save();
        context.globalAlpha = petal.alpha;
        context.translate(petal.x, petal.y);
        context.rotate(petal.rot);
        context.fillStyle = color;
        context.beginPath();
        context.ellipse(0, 0, petal.r, petal.r * 1.5, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" width={300} height={400} />;
}
