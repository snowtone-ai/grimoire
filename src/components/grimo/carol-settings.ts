export const CAROL_SETTING_KEYS = [
  "skyColor", "moonColor", "moonOpacity", "moonX", "moonY", "moonSize",
  "farCloudColor", "farCloudOpacity", "farCloudY", "farCloudWidth", "farCloudHeight",
  "nearCloudColor", "nearCloudOpacity", "nearCloudY", "nearCloudWidth", "nearCloudHeight",
  "carolX", "carolY", "carolScale", "responseX", "responseY", "follow", "release", "pulse", "pulseDecay",
  "pokePulse", "gesturePulse", "pokeDuration", "gestureDuration", "statusDuration",
  "farParallax", "nearParallax", "nearStretch", "starOpacity", "starDrift", "starPeriod",
] as const;

export type CarolSettingKey = (typeof CAROL_SETTING_KEYS)[number];
export type CarolSettings = Record<CarolSettingKey, number | string>;

export const DEFAULT_CAROL_SETTINGS: CarolSettings = {
  skyColor: "#26214a", moonColor: "#f6e6ad", moonOpacity: 0.92, moonX: 2.6, moonY: 2.6, moonSize: 1,
  farCloudColor: "#665b91", farCloudOpacity: 0.78, farCloudY: -2.55, farCloudWidth: 1.9, farCloudHeight: 0.7,
  nearCloudColor: "#ada5d1", nearCloudOpacity: 0.78, nearCloudY: -3.1, nearCloudWidth: 2.4, nearCloudHeight: 0.72,
  carolX: 0, carolY: -0.15, carolScale: 1, responseX: 0.2, responseY: 0.12, follow: 9, release: 4.5, pulse: 0.45, pulseDecay: 2.5,
  pokePulse: 1, gesturePulse: 0.72, pokeDuration: 520, gestureDuration: 620, statusDuration: 600,
  farParallax: 0.35, nearParallax: 0.65, nearStretch: 0.08, starOpacity: 0.9, starDrift: 0.025, starPeriod: 1800,
};
