"use client";

import type { CarolSettingKey, CarolSettings } from "./carol-settings";

type Control = { key: CarolSettingKey; label: string; min?: number; max?: number; step?: number; color?: boolean };

const CONTROLS: readonly Control[] = [
  { key: "skyColor", label: "空", color: true }, { key: "moonColor", label: "月", color: true },
  { key: "moonOpacity", label: "月の透明度", min: 0, max: 1, step: 0.01 }, { key: "moonX", label: "月の横位置", min: -5, max: 5, step: 0.05 },
  { key: "moonY", label: "月の高さ", min: -5, max: 5, step: 0.05 }, { key: "moonSize", label: "月の大きさ", min: 0.2, max: 2, step: 0.01 },
  { key: "farCloudColor", label: "遠い雲", color: true }, { key: "farCloudOpacity", label: "遠い雲の透明度", min: 0, max: 1, step: 0.01 },
  { key: "farCloudY", label: "遠い雲の高さ", min: -5, max: 5, step: 0.05 }, { key: "farCloudWidth", label: "遠い雲の幅", min: 0.4, max: 4, step: 0.01 }, { key: "farCloudHeight", label: "遠い雲の高さ比", min: 0.2, max: 2, step: 0.01 },
  { key: "nearCloudColor", label: "近い雲", color: true }, { key: "nearCloudOpacity", label: "近い雲の透明度", min: 0, max: 1, step: 0.01 },
  { key: "nearCloudY", label: "近い雲の高さ", min: -5, max: 5, step: 0.05 }, { key: "nearCloudWidth", label: "近い雲の幅", min: 0.4, max: 4, step: 0.01 }, { key: "nearCloudHeight", label: "近い雲の高さ比", min: 0.2, max: 2, step: 0.01 },
  { key: "carolX", label: "キャロルの横位置", min: -3, max: 3, step: 0.05 }, { key: "carolY", label: "キャロルの高さ", min: -3, max: 3, step: 0.05 }, { key: "carolScale", label: "キャロルの大きさ", min: 0.6, max: 1.4, step: 0.01 },
  { key: "responseX", label: "横の返事量", min: 0, max: 0.6, step: 0.01 }, { key: "responseY", label: "縦の返事量", min: 0, max: 0.6, step: 0.01 }, { key: "follow", label: "追従の速さ", min: 1, max: 20, step: 0.1 },
  { key: "release", label: "戻る速さ", min: 0.5, max: 12, step: 0.1 }, { key: "pulse", label: "雲の返事量", min: 0, max: 1, step: 0.01 },
  { key: "pulseDecay", label: "雲の戻る速さ", min: 0.2, max: 8, step: 0.1 }, { key: "pokePulse", label: "つつく強さ", min: 0, max: 1, step: 0.01 },
  { key: "gesturePulse", label: "なでる・押す強さ", min: 0, max: 1, step: 0.01 }, { key: "pokeDuration", label: "つつくの余韻 (ms)", min: 100, max: 2000, step: 10 },
  { key: "gestureDuration", label: "なでる・押すの余韻 (ms)", min: 100, max: 2000, step: 10 }, { key: "statusDuration", label: "離した後の表示 (ms)", min: 100, max: 2000, step: 10 },
  { key: "farParallax", label: "遠い雲の視差", min: 0, max: 1, step: 0.01 }, { key: "nearParallax", label: "近い雲の視差", min: 0, max: 1, step: 0.01 }, { key: "nearStretch", label: "近い雲の伸び", min: 0, max: 0.3, step: 0.01 },
  { key: "starOpacity", label: "星の明るさ", min: 0, max: 1, step: 0.01 }, { key: "starDrift", label: "星の揺れ", min: 0, max: 0.2, step: 0.005 }, { key: "starPeriod", label: "星の周期 (ms)", min: 300, max: 5000, step: 10 },
];

export function CarolReviewControls({ settings, onChange, onReset }: {
  settings: CarolSettings;
  onChange: (key: CarolSettingKey, value: string | number) => void;
  onReset: () => void;
}) {
  return <aside className="carol-review" aria-labelledby="carol-review-title">
    <header className="carol-review-header">
      <div><p>目視調整</p><h2 id="carol-review-title">キャロルの完成度をここで決める</h2></div>
      <button type="button" onClick={onReset}>基準値に戻す</button>
    </header>
    <p className="carol-review-note">原画の顔・輪郭・色は比較基準として固定です。舞台、配置、動き、触れた時の返事はすべてこの場で調整できます。</p>
    <div className="carol-control-grid">
      {CONTROLS.map((control) => <label key={control.key} className="carol-control">
        <span>{control.label}</span>
        <input
          type={control.color ? "color" : "range"}
          min={control.min}
          max={control.max}
          step={control.step}
          value={settings[control.key]}
          onChange={(event) => onChange(control.key, control.color ? event.target.value : Number(event.target.value))}
        />
        {!control.color && <output>{Number(settings[control.key]).toFixed(control.step && control.step < 0.01 ? 3 : 2)}</output>}
      </label>)}
    </div>
  </aside>;
}
