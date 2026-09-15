"use client";

import type { GrowthStage } from "@/lib/domain/plant";

interface Props {
  stage: GrowthStage;
  color: string;
  accentColor: string;
  speciesName: string;
}

export function UprightFlower({ stage, color, accentColor, speciesName }: Props) {
  return (
    <svg viewBox="0 0 300 400" className="plant-sway h-full w-full" role="img" aria-label="upright flower growth">
      <Pot />
      {stage >= 1 && <Sprout />}
      {stage >= 2 && <VegetativeStem speciesName={speciesName} />}
      {stage >= 3 && <UprightBud speciesName={speciesName} color={color} accentColor={accentColor} />}
      {stage >= 4 && <OpenBloom speciesName={speciesName} color={color} accentColor={accentColor} full={stage === 5} />}
    </svg>
  );
}

function Pot() {
  return (
    <>
      <ellipse cx="150" cy="370" rx="58" ry="14" fill="#7c5a28" />
      <path d="M96 354 L114 386 L186 386 L204 354 Z" fill="#a36f35" />
      <ellipse cx="150" cy="354" rx="54" ry="13" fill="#c0843e" />
      <ellipse cx="150" cy="352" rx="43" ry="8" fill="#4f2d1d" />
    </>
  );
}

function Sprout() {
  return (
    <g>
      <path d="M150 350 C148 335 149 322 151 308" stroke="#2f6b35" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M150 320 C130 313 121 300 119 288 C137 288 149 300 150 320 Z" fill="#4e9a4e" />
      <path d="M151 320 C171 313 180 300 182 288 C164 288 152 300 151 320 Z" fill="#5dae5a" />
    </g>
  );
}

function VegetativeStem({ speciesName }: { speciesName: string }) {
  if (speciesName === "cyclamen") {
    return (
      <g>
        <path d="M150 350 C148 330 151 314 150 296" stroke="#3f7c38" strokeWidth="4" strokeLinecap="round" fill="none" />
        <CyclamenLeaf cx={123} cy={308} rotate={-18} />
        <CyclamenLeaf cx={151} cy={298} rotate={4} />
        <CyclamenLeaf cx={179} cy={310} rotate={20} />
        <CyclamenLeaf cx={136} cy={336} rotate={-8} />
        <CyclamenLeaf cx={166} cy={336} rotate={12} />
      </g>
    );
  }

  return (
    <g>
      <path d="M150 350 C146 305 150 260 151 216" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <Leaf cx={122} cy={286} rotate={-35} size={1.05} />
      <Leaf cx={178} cy={276} rotate={32} size={1.05} />
      <Leaf cx={128} cy={244} rotate={-25} size={0.9} />
      <Leaf cx={174} cy={232} rotate={26} size={0.9} />
    </g>
  );
}

function UprightBud({ speciesName, color, accentColor }: { speciesName: string; color: string; accentColor: string }) {
  if (speciesName === "sunflower") {
    return (
      <g>
        <path d="M151 220 C150 190 151 170 152 150" stroke="#2d6a2d" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="152" cy="146" r="22" fill="#526b2f" />
        <circle cx="152" cy="146" r="14" fill="#6f8f36" />
        {Array.from({ length: 12 }).map((_, index) => (
          <path key={index} d="M0 -23 L7 -7 L-7 -7 Z" fill="#3f7c38" transform={`translate(152,146) rotate(${index * 30})`} />
        ))}
      </g>
    );
  }

  if (speciesName === "cyclamen") {
    return (
      <g>
        <VegetativeStem speciesName={speciesName} />
        {[128, 152, 176].map((cx, index) => (
          <g key={cx}>
            <path d={`M150 326 C${cx - 8} ${290 - index * 8} ${cx} ${252 - index * 14} ${cx} ${226 - index * 10}`} stroke="#3f7c38" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d={`M${cx} ${226 - index * 10} C${cx - 8} ${210 - index * 10} ${cx + 4} ${198 - index * 10} ${cx + 12} ${207 - index * 10} C${cx + 16} ${218 - index * 10} ${cx + 7} ${230 - index * 10} ${cx} ${226 - index * 10} Z`} fill={color} />
          </g>
        ))}
      </g>
    );
  }

  return <RoseBud color={color} accentColor={accentColor} dense={speciesName === "chrysanthemum"} />;
}

function RoseBud({ color, accentColor, dense }: { color: string; accentColor: string; dense: boolean }) {
  return (
    <g>
      <path d="M151 220 C150 196 151 179 152 163" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M150 168 C136 176 133 193 143 206 C150 213 164 207 168 194 C171 181 164 170 150 168 Z" fill={dense ? accentColor : color} />
      <path d="M150 169 C144 181 145 195 152 207 C161 198 161 181 150 169 Z" fill={accentColor} opacity="0.78" />
      <path d="M136 196 L121 186 L141 187 Z" fill="#2f7a38" />
      <path d="M164 197 L181 188 L160 188 Z" fill="#2f7a38" />
      <path d="M151 205 L143 223 L160 205 Z" fill="#2f7a38" />
    </g>
  );
}

function OpenBloom({ speciesName, color, accentColor, full }: { speciesName: string; color: string; accentColor: string; full: boolean }) {
  if (speciesName === "sunflower") return <SunflowerBloom full={full} />;
  if (speciesName === "chrysanthemum") return <ChrysanthemumBloom color={color} accentColor={accentColor} full={full} />;
  if (speciesName === "cyclamen") return <CyclamenBloom color={color} accentColor={accentColor} full={full} />;

  const petals = full ? 12 : 8;
  const petalLength = full ? 34 : 28;

  return (
    <g>
      <path d="M151 220 C150 196 151 178 152 158" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <g transform={`translate(152,152) scale(${full ? 1.08 : 0.96})`}>
        {Array.from({ length: petals }).map((_, index) => (
          <ellipse
            key={index}
            cx="0"
            cy={-petalLength / 2}
            rx={full ? 12 : 10}
            ry={petalLength}
            fill={index % 2 === 0 ? color : accentColor}
            opacity={index % 2 === 0 ? 0.95 : 0.82}
            transform={`rotate(${index * (360 / petals)})`}
          />
        ))}
        <circle cx="0" cy="0" r={full ? 12 : 9} fill="#f3c74f" />
        <circle cx="-4" cy="-2" r="2" fill="#8b5a18" opacity="0.45" />
        <circle cx="4" cy="1" r="2" fill="#8b5a18" opacity="0.45" />
      </g>
      {full && (
        <>
          <Leaf cx={112} cy={214} rotate={-22} size={0.82} />
          <Leaf cx={190} cy={206} rotate={24} size={0.82} />
        </>
      )}
    </g>
  );
}

function SunflowerBloom({ full }: { full: boolean }) {
  const rays = full ? 24 : 18;

  return (
    <g>
      <path d="M151 220 C150 188 151 164 152 136" stroke="#2d6a2d" strokeWidth="8" strokeLinecap="round" fill="none" />
      <g transform={`translate(152,132) scale(${full ? 1.05 : 0.92})`}>
        {Array.from({ length: rays }).map((_, index) => (
          <ellipse key={index} cx="0" cy="-38" rx="8" ry="26" fill="#ffd43b" transform={`rotate(${index * (360 / rays)})`} />
        ))}
        <circle cx="0" cy="0" r="29" fill="#5b341c" />
        <circle cx="0" cy="0" r="20" fill="#7a4a24" opacity="0.9" />
        {Array.from({ length: 18 }).map((_, index) => (
          <circle key={index} cx={Math.cos(index) * 13} cy={Math.sin(index) * 13} r="2" fill="#2f2015" opacity="0.45" />
        ))}
      </g>
    </g>
  );
}

function ChrysanthemumBloom({ color, accentColor, full }: { color: string; accentColor: string; full: boolean }) {
  const petals = full ? 28 : 18;

  return (
    <g>
      <path d="M151 220 C150 196 151 178 152 158" stroke="#2d6a2d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <g transform={`translate(152,152) scale(${full ? 1.08 : 0.95})`}>
        {Array.from({ length: petals }).map((_, index) => (
          <ellipse key={index} cx="0" cy="-24" rx="5" ry={full ? 28 : 23} fill={index % 2 ? color : accentColor} transform={`rotate(${index * (360 / petals)})`} />
        ))}
        <circle cx="0" cy="0" r="8" fill="#d6aa36" />
      </g>
    </g>
  );
}

function CyclamenBloom({ color, accentColor, full }: { color: string; accentColor: string; full: boolean }) {
  const blooms = full ? [112, 136, 160, 184] : [126, 154, 180];

  return (
    <g>
      <VegetativeStem speciesName="cyclamen" />
      {blooms.map((cx, index) => {
        const cy = 218 - index * 10;
        return (
          <g key={cx}>
            <path d={`M150 326 C${cx - 12} 286 ${cx} 252 ${cx} ${cy}`} stroke="#3f7c38" strokeWidth="4" strokeLinecap="round" fill="none" />
            <g transform={`translate(${cx},${cy})`}>
              {[-34, -12, 12, 34].map((angle) => (
                <ellipse key={angle} cx="0" cy="-18" rx="7" ry="22" fill={angle % 24 === 0 ? accentColor : color} transform={`rotate(${angle})`} />
              ))}
              <path d="M-8 5 C-3 13 5 13 10 5 C4 10 -3 10 -8 5 Z" fill="#6b2144" opacity="0.45" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function Leaf({ cx, cy, rotate, size }: { cx: number; cy: number; rotate: number; size: number }) {
  return (
    <path
      d={`M${cx} ${cy} C${cx - 27 * size} ${cy - 18 * size} ${cx - 37 * size} ${cy + 5 * size} ${cx - 3 * size} ${cy + 15 * size} C${cx + 18 * size} ${cy + 5 * size} ${cx + 16 * size} ${cy - 10 * size} ${cx} ${cy} Z`}
      fill="#3f8f42"
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

function CyclamenLeaf({ cx, cy, rotate }: { cx: number; cy: number; rotate: number }) {
  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <path d={`M${cx} ${cy + 18} C${cx - 34} ${cy - 8} ${cx - 16} ${cy - 34} ${cx} ${cy - 18} C${cx + 16} ${cy - 34} ${cx + 34} ${cy - 8} ${cx} ${cy + 18} Z`} fill="#326c44" />
      <path d={`M${cx} ${cy + 10} C${cx - 14} ${cy - 4} ${cx - 6} ${cy - 17} ${cx} ${cy - 9} C${cx + 6} ${cy - 17} ${cx + 14} ${cy - 4} ${cx} ${cy + 10} Z`} fill="#b8c8ad" opacity="0.55" />
    </g>
  );
}
