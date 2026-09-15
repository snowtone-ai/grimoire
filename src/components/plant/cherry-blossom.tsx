"use client";

import type { GrowthStage } from "@/lib/domain/plant";

interface Props {
  stage: GrowthStage;
  color: string;
  accentColor: string;
  speciesName: string;
}

const blossomPoints = [
  [91, 240],
  [108, 214],
  [127, 196],
  [148, 182],
  [170, 178],
  [192, 198],
  [211, 224],
  [226, 255],
  [74, 276],
  [112, 300],
  [154, 291],
  [194, 306],
  [232, 322],
  [118, 154],
  [182, 148],
  [225, 190],
  [69, 210],
  [250, 238],
] as const;

export function CherryBlossom({ stage, color, accentColor, speciesName }: Props) {
  return (
    <svg viewBox="0 0 300 400" className="plant-sway h-full w-full" role="img" aria-label="cherry blossom growth">
      <Ground />
      {stage >= 1 && <YoungShoot />}
      {stage >= 2 && <BranchFrame />}
      {stage >= 3 && <Buds accentColor={accentColor} />}
      {stage >= 4 && <Blossoms speciesName={speciesName} color={color} accentColor={accentColor} full={stage === 5} />}
    </svg>
  );
}

function Ground() {
  return (
    <>
      <ellipse cx="150" cy="360" rx="92" ry="20" fill="#7a4a24" opacity="0.28" />
      <ellipse cx="150" cy="352" rx="72" ry="12" fill="#51311f" />
    </>
  );
}

function YoungShoot() {
  return (
    <g>
      <path d="M150 350 C148 322 149 296 151 266" stroke="#6b3f20" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M151 292 C134 279 127 263 128 248 C144 253 153 269 151 292 Z" fill="#59843c" />
      <path d="M151 286 C168 273 178 257 178 242 C160 248 151 267 151 286 Z" fill="#6d9441" />
    </g>
  );
}

function BranchFrame() {
  return (
    <g>
      <path d="M150 350 C145 307 147 271 151 232" stroke="#6b3f20" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M150 245 C120 224 92 199 72 164" stroke="#6b3f20" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M150 239 C174 210 199 184 233 153" stroke="#6b3f20" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M145 260 C129 246 111 235 91 226" stroke="#7a4a24" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M155 258 C177 244 196 229 218 210" stroke="#7a4a24" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M151 242 C163 216 176 197 188 180" stroke="#7a4a24" strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Buds({ accentColor }: { accentColor: string }) {
  const budPoints = blossomPoints.slice(0, 12);

  return (
    <g>
      {budPoints.map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`} transform={`rotate(${index % 2 ? 12 : -10} ${cx} ${cy})`}>
          <ellipse cx={cx} cy={cy} rx="5" ry="8" fill={accentColor} />
          <path d={`M${cx - 5} ${cy + 3} L${cx} ${cy + 10} L${cx + 5} ${cy + 3} Z`} fill="#476f33" />
        </g>
      ))}
    </g>
  );
}

function Blossoms({ speciesName, color, accentColor, full }: { speciesName: string; color: string; accentColor: string; full: boolean }) {
  const visible = full ? blossomPoints : blossomPoints.slice(0, 12);

  return (
    <g>
      {visible.map(([cx, cy], index) => (
        <SeasonalTreeFlower key={`${cx}-${cy}`} speciesName={speciesName} cx={cx} cy={cy} color={color} accentColor={accentColor} scale={full && index % 3 === 0 ? 1.08 : 0.92} />
      ))}
      {full &&
        blossomPoints.slice(0, 5).map(([cx, cy], index) => (
          <ellipse key={`fall-${cx}-${cy}`} cx={cx + index * 6} cy={cy + 34} rx="5" ry="3" fill={color} className="petal-fall" opacity="0.8" />
        ))}
    </g>
  );
}

function SeasonalTreeFlower({
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
  if (speciesName === "wintersweet") {
    return (
      <g transform={`translate(${cx},${cy}) scale(${scale})`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <ellipse key={index} cx="0" cy="-9" rx="5" ry="12" fill={color} opacity="0.9" transform={`rotate(${index * 60})`} />
        ))}
        <circle cx="0" cy="0" r="4" fill="#8b5a18" opacity="0.65" />
      </g>
    );
  }

  if (speciesName === "plum") {
    return (
      <g transform={`translate(${cx},${cy}) scale(${scale})`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <ellipse key={index} cx="0" cy="-10" rx="8" ry="11" fill={color} transform={`rotate(${index * 72})`} />
        ))}
        {Array.from({ length: 8 }).map((_, index) => (
          <line key={index} x1="0" y1="0" x2={Math.cos(index) * 9} y2={Math.sin(index) * 9} stroke="#b23a48" strokeWidth="1" />
        ))}
        <circle cx="0" cy="0" r="3" fill="#f3d36a" />
      </g>
    );
  }

  return (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <path
          key={index}
          d="M0 -2 C-9 -16 -1 -22 0 -20 C1 -22 9 -16 0 -2 Z"
          fill={color}
          opacity="0.95"
          transform={`rotate(${index * 72})`}
        />
      ))}
      <circle cx="0" cy="0" r="3" fill={accentColor} />
    </g>
  );
}
