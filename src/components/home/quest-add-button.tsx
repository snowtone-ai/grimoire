"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playCue } from "@/lib/sound";
import { fireAddRipple } from "@/lib/vfx";
import { createManaOrb, type ManaOrbHandle } from "@/lib/mana-orb";
import { cn } from "@/lib/utils";

interface QuestAddButtonProps {
  onAdd: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The springwell seal is the single visual entry point for a new quest.
 *
 * Its body is a real-time refracting mana orb (src/lib/mana-orb.ts): pressing it
 * squashes the sphere and sloshes the light inside toward the finger, so the
 * control answers the touch before the sheet has opened. The orb only takes over
 * once WebGL has actually produced a program — until then, and forever on a
 * device without it, the CSS springwell underneath is what ships, which is why
 * the well and its rings are still styled here rather than deleted.
 */
export function QuestAddButton({ onAdd, className, style }: QuestAddButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<ManaOrbHandle | null>(null);
  const [orbReady, setOrbReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const orb = createManaOrb(canvas, { onLost: () => setOrbReady(false) });
    orbRef.current = orb;
    setOrbReady(orb !== null);
    return () => {
      orb?.destroy();
      orbRef.current = null;
    };
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      style={style}
      aria-label="クエストを追加"
      onPointerDown={(event) => {
        orbRef.current?.press(event.clientX, event.clientY);
        fireAddRipple(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => orbRef.current?.move(event.clientX, event.clientY)}
      onPointerUp={() => orbRef.current?.release()}
      onPointerCancel={() => orbRef.current?.release()}
      onPointerLeave={() => orbRef.current?.release()}
      onClick={() => {
        playCue("add");
        onAdd();
      }}
      className={cn("quest-add-button btn-squish size-16", orbReady && "is-orb", className)}
    >
      <canvas ref={canvasRef} className="quest-add-button__orb" aria-hidden />
      <span className="quest-add-button__well" aria-hidden>
        <Plus />
        <span className="quest-add-button__spark" />
      </span>
      <span className="quest-add-button__label" aria-hidden>
        QUEST
      </span>
    </Button>
  );
}
