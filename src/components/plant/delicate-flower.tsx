"use client";

import type { GrowthStage } from "@/lib/domain/plant";

interface Props {
  stage: GrowthStage;
  color: string;
  accentColor: string;
  speciesName: string;
}

const flowerHeads = [
  [104, 190],
  [150, 160],
  [198, 204],
  [124, 248],
  [178, 256],
] as const;

export function DelicateFlower({ stage, color, accentColor, speciesName }: Props) {
  return (
    <svg viewBox="0 0 300 400" className="plant-sway h-full w-full" role="img" aria-label="delicate flower growth">
      <Pot />
      {stage >= 1 && <Seedling />}
      {stage >= 2 && <TwiningVines speciesName={speciesName} />}
      {stage >= 3 && <TwistedBuds speciesName={speciesName} color={accentColor} />}
      {stage >= 4 && <SpeciesFlowers speciesName={speciesName} color={color} accentColor={accentColor} full={stage === 5} />}
    </svg>
  );
}

function Pot() {
  return (
    <>
      <ellipse cx="150" cy="370" rx="55" ry="14" fill="#7c5a28" />
      <path d="M100 355 L115 385 L185 385 L200 355 Z" fill="#a36f35" />
      <ellipse cx="150" cy="355" rx="50" ry="12" fill="#51311f" />
    </>
  );
}

function Seedling() {
  return (
    <g>
      <path d="M150 350 C145 326 144 302 138 278" stroke="#2d6a2d" strokeWidth="4" strokeLinecap="round" fill="none" />
      <HeartLeaf cx={132} cy={284} rotate={-24} size={0.78} />
      <HeartLeaf cx={162} cy={286} rotate={24} size={0.78} />
    </g>
  );
}

function TwiningVines({ speciesName }: { speciesName: string }) {
  if (speciesName === "osmanthus") {
    return (
      <g>
        <path d="M150 350 C134 300 116 262 96 226" stroke="#4a6f32" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M150 350 C150 296 150 250 150 204" stroke="#4a6f32" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M150 350 C168 302 188 266 210 230" stroke="#4a6f32" strokeWidth="5" strokeLinecap="round" fill="none" />
        {[102, 126, 150, 176, 202].map((cx, index) => (
          <ellipse key={cx} cx={cx} cy={248 + (index % 2) * 24} rx="22" ry="10" fill="#355f34" transform={`rotate(${(index - 2) * 18} ${cx} ${248 + (index % 2) * 24})`} />
        ))}
      </g>
    );
  }

  if (speciesName === "cosmos") {
    return (
      <g>
        <path d="M150 350 C136 300 118 250 104 206" stroke="#407a3a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M150 350 C150 290 150 234 150 176" stroke="#407a3a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M150 350 C168 304 190 260 204 214" stroke="#407a3a" strokeWidth="4" strokeLinecap="round" fill="none" />
        {[112, 136, 160, 188].map((cx, index) => (
          <FeatheryLeaf key={cx} cx={cx} cy={250 + index * 16} />
        ))}
      </g>
    );
  }

  return (
    <g>
      <path d="M150 350 C141 304 130 268 104 228" stroke="#2d6a2d" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M150 350 C154 300 165 244 150 176" stroke="#2d6a2d" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M150 350 C170 305 190 260 202 210" stroke="#2d6a2d" strokeWidth="4" strokeLinecap="round" fill="none" />
      <HeartLeaf cx={118} cy={246} rotate={-30} size={0.9} />
      <HeartLeaf cx={168} cy={284} rotate={22} size={0.82} />
      <HeartLeaf cx={190} cy={236} rotate={30} size={0.9} />
      <HeartLeaf cx={144} cy={202} rotate={-10} size={0.76} />
    </g>
  );
}

function TwistedBuds({ speciesName, color }: { speciesName: string; color: string }) {
  return (
    <g>
      {flowerHeads.slice(0, 4).map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`} transform={`rotate(${index % 2 ? 18 : -14} ${cx} ${cy})`}>
          <path d={budPath(cx, cy, speciesName)} fill={color} />
          <path d={`M${cx - 3} ${cy - 20} C${cx + 8} ${cy - 18} ${cx + 7} ${cy - 4} ${cx + 1} ${cy + 9}`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" fill="none" />
          <path d={`M${cx - 9} ${cy + 12} L${cx} ${cy + 24} L${cx + 9} ${cy + 12} Z`} fill="#3f7c38" />
        </g>
      ))}
    </g>
  );
}

function SpeciesFlowers({ speciesName, color, accentColor, full }: { speciesName: string; color: string; accentColor: string; full: boolean }) {
  const visibleHeads = full ? flowerHeads : flowerHeads.slice(0, 3);

  return (
    <g>
      {visibleHeads.map(([cx, cy], index) => (
        <SpeciesFlower key={`${cx}-${cy}`} speciesName={speciesName} cx={cx} cy={cy} color={color} accentColor={accentColor} scale={full && index === 1 ? 1.12 : 0.95} />
      ))}
    </g>
  );
}

function budPath(cx: number, cy: number, speciesName: string): string {
  if (speciesName === "cosmos") {
    return `M${cx} ${cy + 14} C${cx - 8} ${cy + 3} ${cx - 7} ${cy - 9} ${cx} ${cy - 17} C${cx + 7} ${cy - 9} ${cx + 8} ${cy + 3} ${cx} ${cy + 14} Z`;
  }
  if (speciesName === "osmanthus") {
    return `M${cx - 10} ${cy - 8} L${cx} ${cy - 18} L${cx + 10} ${cy - 8} L${cx} ${cy + 2} Z`;
  }
  return `M${cx} ${cy + 18} C${cx - 10} ${cy + 6} ${cx - 8} ${cy - 11} ${cx} ${cy - 24} C${cx + 9} ${cy - 10} ${cx + 10} ${cy + 7} ${cx} ${cy + 18} Z`;
}

function HeartLeaf({ cx, cy, rotate, size }: { cx: number; cy: number; rotate: number; size: number }) {
  return (
    <path
      d={`M${cx} ${cy + 12 * size} C${cx - 26 * size} ${cy - 8 * size} ${cx - 13 * size} ${cy - 29 * size} ${cx} ${cy - 15 * size} C${cx + 13 * size} ${cy - 29 * size} ${cx + 26 * size} ${cy - 8 * size} ${cx} ${cy + 12 * size} Z`}
      fill="#3f8f42"
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

function SpeciesFlower({
  speciesName,
  cx,
  cy,
  color,
  accentColor,
  scale,
}: {
  speciesName: string;
  cx: number;
  cy: number;
  color: string;
  accentColor: string;
  scale: number;
}) {
  if (speciesName === "cosmos") {
    return (
      <g transform={`translate(${cx},${cy}) scale(${scale})`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <ellipse key={index} cx="0" cy="-20" rx="8" ry="22" fill={color} transform={`rotate(${index * 45})`} />
        ))}
        <circle cx="0" cy="0" r="9" fill="#d6aa36" />
        <circle cx="0" cy="0" r="4" fill="#704116" opacity="0.6" />
      </g>
    );
  }

  if (speciesName === "osmanthus") {
    return (
      <g transform={`translate(${cx},${cy}) scale(${scale})`}>
        {[-14, 0, 14, 28].map((offsetX, index) => (
          <g key={index} transform={`translate(${offsetX - 10},${(index % 2) * 12}) scale(0.72)`}>
            {Array.from({ length: 4 }).map((_, petalIndex) => (
              <ellipse key={petalIndex} cx="0" cy="-8" rx="4" ry="9" fill={color} transform={`rotate(${petalIndex * 90})`} />
            ))}
            <circle cx="0" cy="0" r="2" fill="#7a4a24" opacity="0.65" />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      <path d="M0 18 C-24 6 -34 -22 0 -34 C34 -22 24 6 0 18 Z" fill={color} />
      <path d="M0 18 C-10 4 -9 -16 0 -28 C9 -16 10 4 0 18 Z" fill={accentColor} opacity="0.45" />
      <ellipse cx="0" cy="-9" rx="21" ry="15" fill="#ffffff" opacity="0.2" />
      <circle cx="0" cy="3" r="5" fill="#f3d36a" />
    </g>
  );
}

function FeatheryLeaf({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#3f8f42" strokeWidth="2" strokeLinecap="round">
      <line x1={cx} y1={cy} x2={cx + 26} y2={cy - 16} />
      <line x1={cx + 8} y1={cy - 5} x2={cx + 18} y2={cy - 22} />
      <line x1={cx + 11} y1={cy - 7} x2={cx + 28} y2={cy - 6} />
      <line x1={cx + 3} y1={cy - 2} x2={cx - 12} y2={cy - 16} />
    </g>
  );
}
