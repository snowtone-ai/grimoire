"use client";

import type { GrowthStage } from "@/lib/domain/plant";

interface Props {
  stage: GrowthStage;
  color: string;
  accentColor: string;
  speciesName: string;
}

const racemes = [
  { cx: 95, top: 205, length: 5 },
  { cx: 126, top: 198, length: 6 },
  { cx: 158, top: 194, length: 7 },
  { cx: 190, top: 202, length: 6 },
  { cx: 220, top: 214, length: 5 },
] as const;

export function HangingCluster({ stage, color, accentColor, speciesName }: Props) {
  if (speciesName === "hydrangea") {
    return <Hydrangea stage={stage} color={color} accentColor={accentColor} />;
  }

  return (
    <svg viewBox="0 0 300 400" className="plant-sway h-full w-full" role="img" aria-label="wisteria growth">
      <Pot />
      {stage >= 1 && <TwiningShoot />}
      {stage >= 2 && <VineAndLeaves />}
      {stage >= 3 && <RacemeBuds color={accentColor} />}
      {stage >= 4 && <RacemeFlowers color={color} accentColor={accentColor} full={stage === 5} />}
    </svg>
  );
}

function Hydrangea({ stage, color, accentColor }: { stage: GrowthStage; color: string; accentColor: string }) {
  return (
    <svg viewBox="0 0 300 400" className="plant-sway h-full w-full" role="img" aria-label="hydrangea growth">
      <Pot />
      {stage >= 1 && <TwiningShoot />}
      {stage >= 2 && (
        <g>
          <path d="M150 350 C136 304 120 266 101 224" stroke="#356b35" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M150 350 C150 296 150 250 150 204" stroke="#356b35" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M150 350 C166 304 184 266 204 224" stroke="#356b35" strokeWidth="6" strokeLinecap="round" fill="none" />
          {[98, 124, 150, 176, 202].map((cx, index) => (
            <HydrangeaLeaf key={cx} cx={cx} cy={254 + (index % 2) * 24} rotate={(index - 2) * 14} />
          ))}
        </g>
      )}
      {stage >= 3 && <HydrangeaHead color={accentColor} cx={150} cy={180} scale={0.68} buds />}
      {stage >= 4 && (
        <>
          <HydrangeaHead color={color} cx={150} cy={176} scale={stage === 5 ? 1 : 0.84} />
          {stage === 5 && (
            <>
              <HydrangeaHead color={accentColor} cx={102} cy={214} scale={0.52} />
              <HydrangeaHead color={accentColor} cx={198} cy={218} scale={0.52} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

function HydrangeaLeaf({ cx, cy, rotate }: { cx: number; cy: number; rotate: number }) {
  return (
    <path
      d={`M${cx} ${cy - 28} C${cx - 26} ${cy - 16} ${cx - 26} ${cy + 20} ${cx} ${cy + 28} C${cx + 26} ${cy + 20} ${cx + 26} ${cy - 16} ${cx} ${cy - 28} Z`}
      fill="#3f8f42"
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

function HydrangeaHead({ color, cx, cy, scale, buds = false }: { color: string; cx: number; cy: number; scale: number; buds?: boolean }) {
  const points = [
    [-28, -18], [0, -28], [28, -18], [-38, 8], [-10, 4], [18, 4], [42, 8], [-24, 30], [8, 30], [32, 28],
  ] as const;

  return (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      {points.map(([offsetX, offsetY], index) =>
        buds ? (
          <circle key={index} cx={offsetX} cy={offsetY} r="7" fill={color} />
        ) : (
          <g key={index} transform={`translate(${offsetX},${offsetY})`}>
            {Array.from({ length: 4 }).map((_, petalIndex) => (
              <ellipse key={petalIndex} cx="0" cy="-8" rx="5" ry="9" fill={color} transform={`rotate(${petalIndex * 90})`} opacity="0.9" />
            ))}
            <circle cx="0" cy="0" r="2" fill="#f3d36a" />
          </g>
        )
      )}
    </g>
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

function TwiningShoot() {
  return (
    <g>
      <path d="M150 352 C145 322 152 298 146 268 C142 250 155 232 150 210" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M148 300 C126 291 119 274 122 260 C140 263 151 280 148 300 Z" fill="#4f9a4c" />
      <path d="M150 278 C170 267 178 249 176 235 C158 242 149 260 150 278 Z" fill="#62aa55" />
    </g>
  );
}

function VineAndLeaves() {
  return (
    <g>
      <path d="M150 352 C146 304 148 248 151 198" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M78 204 C119 185 180 185 226 204" stroke="#2d6a2d" strokeWidth="7" strokeLinecap="round" fill="none" />
      {[86, 112, 138, 164, 190, 216].map((cx, index) => (
        <Leaf key={cx} cx={cx} cy={198 + (index % 2) * 10} rotate={index % 2 ? 28 : -28} />
      ))}
    </g>
  );
}

function RacemeBuds({ color }: { color: string }) {
  return (
    <g>
      {racemes.slice(1, 4).map((raceme) => (
        <g key={raceme.cx}>
          <path d={`M${raceme.cx} ${raceme.top - 8} C${raceme.cx - 4} ${raceme.top + 26} ${raceme.cx + 3} ${raceme.top + 60} ${raceme.cx - 2} ${raceme.top + 88}`} stroke="#557c37" strokeWidth="3" strokeLinecap="round" fill="none" />
          {Array.from({ length: 4 }).map((_, index) => (
            <ellipse key={index} cx={raceme.cx + (index % 2 ? 7 : -7)} cy={raceme.top + index * 20} rx="6" ry="9" fill={color} />
          ))}
        </g>
      ))}
    </g>
  );
}

function RacemeFlowers({ color, accentColor, full }: { color: string; accentColor: string; full: boolean }) {
  const visible = full ? racemes : racemes.slice(0, 4);

  return (
    <g>
      {visible.map((raceme) => (
        <FlowerChain key={raceme.cx} cx={raceme.cx} top={raceme.top} count={full ? raceme.length + 2 : raceme.length} color={color} accentColor={accentColor} />
      ))}
    </g>
  );
}

function FlowerChain({ cx, top, count, color, accentColor }: { cx: number; top: number; count: number; color: string; accentColor: string }) {
  return (
    <g>
      <path d={`M${cx} ${top - 12} C${cx - 8} ${top + 36} ${cx + 8} ${top + 82} ${cx} ${top + 128}`} stroke="#557c37" strokeWidth="3" strokeLinecap="round" fill="none" />
      {Array.from({ length: count }).map((_, index) => (
        <g key={index} transform={`translate(${cx + (index % 2 ? 8 : -8)},${top + index * 18})`}>
          <ellipse cx="0" cy="0" rx={9 + index * 0.6} ry="11" fill={color} opacity={0.65 + index * 0.04} />
          <ellipse cx="0" cy="4" rx="5" ry="6" fill={accentColor} opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Leaf({ cx, cy, rotate }: { cx: number; cy: number; rotate: number }) {
  return <ellipse cx={cx} cy={cy} rx="19" ry="8" fill="#3f8f42" transform={`rotate(${rotate} ${cx} ${cy})`} />;
}
