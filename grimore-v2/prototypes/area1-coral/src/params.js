/**
 * params.js — the single source of truth for every tunable value in Area 1.
 *
 * Nothing in the scene reads a hard-coded number: every material uniform, geometry
 * dimension, pass setting and motion curve resolves through this schema. The GUI is
 * generated from it, presets are diffs against it, and `exportJson()` round-trips a
 * tuned state back into source.
 *
 * Schema entry shape:
 *   { label, type, value, min, max, step, options, rebuild, help }
 *     type    'range' | 'color' | 'bool' | 'select'
 *     color   stored as a 0xRRGGBB integer, authored in sRGB
 *     rebuild 'geometry' — changing it re-runs the procedural generators (async)
 *             'passes'   — changing it re-allocates render targets
 *             undefined  — live uniform update, no rebuild
 */

export const SCHEMA = {
  /* ================================================================= *
   * Camera — fixed loop framing (C章: カメラ操作不可, 完全固定ループ)
   * ================================================================= */
  camera: {
    label: 'カメラ',
    note: '固定ループ。ユーザー操作は受け付けない（C章）。呼吸・微揺れのみ。',
    params: {
      fov: { label: '垂直画角', type: 'range', value: 41, min: 18, max: 80, step: 0.5, help: '望遠寄りほどジオラマ的に圧縮される' },
      posX: { label: '位置 X', type: 'range', value: 0.0, min: -8, max: 8, step: 0.05 },
      posY: { label: '位置 Y（視点高）', type: 'range', value: 2.05, min: 0.2, max: 8, step: 0.05 },
      posZ: { label: '位置 Z', type: 'range', value: 8.6, min: 2, max: 24, step: 0.1 },
      targetX: { label: '注視点 X', type: 'range', value: 0.0, min: -6, max: 6, step: 0.05 },
      targetY: { label: '注視点 Y', type: 'range', value: 2.95, min: 0, max: 10, step: 0.05 },
      targetZ: { label: '注視点 Z', type: 'range', value: -6.0, min: -30, max: 4, step: 0.1 },
      roll: { label: 'ロール（度）', type: 'range', value: 0.0, min: -8, max: 8, step: 0.1 },
      portraitFovBoost: { label: '縦持ち時のFOV補正', type: 'range', value: 1.34, min: 1.0, max: 2.0, step: 0.01, help: '9:19.5 の縦画面でも構図が破綻しないよう垂直画角を広げる係数' },
      portraitLift: { label: '縦持ち時の注視点上げ', type: 'range', value: 0.55, min: -2, max: 2, step: 0.05 },
      breatheAmp: { label: '呼吸ドリー幅', type: 'range', value: 0.11, min: 0, max: 0.6, step: 0.005 },
      breathePeriod: { label: '呼吸周期（秒）', type: 'range', value: 21.0, min: 4, max: 60, step: 0.5 },
      swayAmp: { label: '微揺れ幅（度）', type: 'range', value: 0.20, min: 0, max: 2, step: 0.01 },
      swaySpeed: { label: '微揺れ速度', type: 'range', value: 0.045, min: 0, max: 0.5, step: 0.005 },
      near: { label: 'ニアクリップ', type: 'range', value: 0.1, min: 0.01, max: 2, step: 0.01 },
      far: { label: 'ファークリップ', type: 'range', value: 420, min: 60, max: 2000, step: 10 },
    },
  },

  /* ================================================================= *
   * Sun — the single directional key. B章: 一方向からの強い逆光〜半逆光
   * ================================================================= */
  sun: {
    label: '主光源（逆光）',
    note: 'B章の「一方向からの強い逆光〜半逆光、暖色〜中間色」。方位180度＝カメラ正面（完全逆光）。',
    params: {
      azimuth: { label: '方位角（度）', type: 'range', value: 186, min: 0, max: 360, step: 1, help: '180 = カメラ真正面から差す完全逆光' },
      elevation: { label: '仰角（度）', type: 'range', value: 24, min: 2, max: 88, step: 0.5 },
      color: { label: '光源色', type: 'color', value: 0xffeacb, help: '暖色〜中間色。大気側の寒色と対比させる' },
      intensity: { label: '強度', type: 'range', value: 1.95, min: 0, max: 10, step: 0.05 },
      temperatureK: { label: '色温度（K・契約値）', type: 'range', value: 5200, min: 2000, max: 12000, step: 50, help: 'グリモ側マテリアルへ渡す共有契約値（H章）。描画には色を使う' },
      discSize: { label: '太陽ディスク半径', type: 'range', value: 0.035, min: 0.005, max: 0.4, step: 0.001 },
      discSoftness: { label: 'ディスクの滲み', type: 'range', value: 0.72, min: 0.0, max: 1.0, step: 0.01 },
      discIntensity: { label: 'ディスク輝度', type: 'range', value: 11, min: 0, max: 60, step: 0.5, help: 'HDR値。ブルームと光芒の元になる' },
      flickerAmp: { label: '揺らぎ幅', type: 'range', value: 0.075, min: 0, max: 0.5, step: 0.005 },
      flickerSpeed: { label: '揺らぎ速度', type: 'range', value: 0.28, min: 0, max: 3, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Sky — gradient + the churning "canopy" ceiling that reads as a sea surface
   * ================================================================= */
  sky: {
    label: '空・天蓋',
    note: '参照画像の「海面のように見える雲の天蓋」。陸上マップなので水中要素ではない（A章）。',
    params: {
      zenithColor: { label: '天頂色', type: 'color', value: 0x081733 },
      horizonColor: { label: '地平色', type: 'color', value: 0x2d5f8a },
      gradientPower: { label: 'グラデーション曲線', type: 'range', value: 1.35, min: 0.2, max: 4, step: 0.05 },
      groundColor: { label: '地平線より下の色', type: 'color', value: 0x14243f },
      haloColor: { label: '光輪色', type: 'color', value: 0xd8f0ff },
      haloIntensity: { label: '光輪強度', type: 'range', value: 3.6, min: 0, max: 12, step: 0.05 },
      haloFalloff: { label: '光輪の広がり', type: 'range', value: 26, min: 0.5, max: 40, step: 0.1, help: '小さいほど広く拡散する' },
      canopyEnabled: { label: '天蓋を描く', type: 'bool', value: true },
      canopyColor: { label: '天蓋色', type: 'color', value: 0x8ec2e0 },
      canopyHeight: { label: '天蓋の高さ', type: 'range', value: 62, min: 10, max: 300, step: 1 },
      canopyScale: { label: '天蓋の細かさ', type: 'range', value: 0.0125, min: 0.001, max: 0.06, step: 0.0005 },
      canopySpeed: { label: '天蓋の流れる速さ', type: 'range', value: 0.55, min: 0, max: 6, step: 0.01 },
      canopyContrast: { label: '天蓋のコントラスト', type: 'range', value: 1.85, min: 0.2, max: 6, step: 0.05 },
      canopyCoverage: { label: '天蓋の密度', type: 'range', value: 0.52, min: 0, max: 1, step: 0.01 },
      canopyOctaves: { label: '天蓋のオクターブ', type: 'range', value: 4, min: 1, max: 6, step: 1 },
      starEnabled: { label: '微光点を出す', type: 'bool', value: false, help: '夜プリセット用。天頂側にごく弱い粒を散らす' },
    },
  },

  /* ================================================================= *
   * Aerial perspective — 3-band distance fog matched to the sky
   * (CryEngine2 の horizon-matched fog / Firewatch の色レイヤー設計)
   * ================================================================= */
  fog: {
    label: '大気・空気遠近',
    note: '近/中/遠の3バンドで色を分ける。単色フォグより奥行きの層が出る（Firewatch方式）。',
    params: {
      density: { label: '濃度', type: 'range', value: 0.0265, min: 0.0, max: 0.12, step: 0.0005 },
      power: { label: '減衰カーブ', type: 'range', value: 1.28, min: 0.4, max: 3, step: 0.01 },
      nearDist: { label: '近バンド距離', type: 'range', value: 12, min: 1, max: 60, step: 0.5 },
      midDist: { label: '中バンド距離', type: 'range', value: 34, min: 5, max: 180, step: 1 },
      farDist: { label: '遠バンド距離', type: 'range', value: 115, min: 20, max: 600, step: 2 },
      nearColor: { label: '近景フォグ色', type: 'color', value: 0x33536e },
      midColor: { label: '中景フォグ色', type: 'color', value: 0x24507a },
      farColor: { label: '遠景フォグ色', type: 'color', value: 0x1d4472 },
      heightFalloff: { label: '高さ減衰', type: 'range', value: 0.052, min: 0, max: 0.4, step: 0.001, help: '大きいほど霧が低地に溜まる' },
      heightOffset: { label: '霧の基準高さ', type: 'range', value: 0.4, min: -5, max: 20, step: 0.1 },
      floorBoost: { label: '地表の霧だまり', type: 'range', value: 0.24, min: 0, max: 2, step: 0.01 },
      inscatterStrength: { label: '太陽方向の散乱', type: 'range', value: 0.55, min: 0, max: 2, step: 0.01 },
      inscatterPower: { label: '散乱の集中度', type: 'range', value: 7.0, min: 0.5, max: 30, step: 0.1 },
      inscatterColor: { label: '散乱色', type: 'color', value: 0xcbe8ff },
      scrollSpeed: { label: '霧の流れる速さ', type: 'range', value: 0.035, min: 0, max: 0.5, step: 0.001 },
      scrollScale: { label: '霧の粒度', type: 'range', value: 0.035, min: 0.002, max: 0.2, step: 0.001 },
      scrollAmount: { label: '霧のムラ量', type: 'range', value: 0.20, min: 0, max: 1, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Shared surface BRDF — stylised wrap + rim + Frostbite translucency
   * ================================================================= */
  surface: {
    label: 'マテリアル共通（BRDF）',
    note: 'フォトリアルPBRではなくスタイライズ（G章）。ラップ拡散＋リム＋擬似SSSの3本立て。',
    params: {
      wrap: { label: 'ラップ拡散', type: 'range', value: 0.42, min: 0, max: 1, step: 0.01, help: '陰側の落ち込みを緩める。逆光でシルエットが潰れないための要' },
      wrapPower: { label: 'ラップ曲線', type: 'range', value: 1.12, min: 0.3, max: 3, step: 0.01 },
      ambientSky: { label: '環境光（上）', type: 'color', value: 0x9fd0f2 },
      ambientGround: { label: '環境光（下）', type: 'color', value: 0x24344c },
      ambientIntensity: { label: '環境光強度', type: 'range', value: 0.36, min: 0, max: 4, step: 0.01 },
      rimColor: { label: 'リム色', type: 'color', value: 0xd6f0ff },
      rimStrength: { label: 'リム強度', type: 'range', value: 0.85, min: 0, max: 5, step: 0.01 },
      rimPower: { label: 'リム鋭さ', type: 'range', value: 3.1, min: 0.5, max: 12, step: 0.05 },
      rimBacklightBias: { label: 'リムの逆光偏り', type: 'range', value: 0.85, min: 0, max: 1, step: 0.01, help: '1に近いほど光源側の縁だけが光る' },
      specStrength: { label: 'スペキュラ強度', type: 'range', value: 0.22, min: 0, max: 2, step: 0.01 },
      specPower: { label: 'スペキュラ鋭さ', type: 'range', value: 38, min: 2, max: 256, step: 1 },
      aoStrength: { label: 'AO強度', type: 'range', value: 0.72, min: 0, max: 1.5, step: 0.01 },
      detailScale: { label: '微細ディテール', type: 'range', value: 0.85, min: 0.1, max: 12, step: 0.05 },
      detailAmount: { label: '微細ディテール量', type: 'range', value: 0.13, min: 0, max: 0.8, step: 0.005 },
      macroScale: { label: 'マクロむら', type: 'range', value: 0.085, min: 0.01, max: 1.5, step: 0.005 },
      macroAmount: { label: 'マクロむら量', type: 'range', value: 0.18, min: 0, max: 1, step: 0.005 },
      normalPerturb: { label: '法線の乱れ', type: 'range', value: 0.10, min: 0, max: 1.5, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Translucency — Barré-Brisebois & Bouchard, GDC 2011 / GPU Pro 2
   * ================================================================= */
  translucency: {
    label: '擬似SSS（透過光）',
    note: 'Frostbite方式：vLTLight = L + N*distortion / dot(V,-vLTLight)^power * scale。珊瑚の逆光透けの主役。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      distortion: { label: '歪み（distortion）', type: 'range', value: 0.34, min: 0, max: 1.5, step: 0.01 },
      power: { label: '指数（power）', type: 'range', value: 4.4, min: 0.5, max: 24, step: 0.1 },
      scale: { label: '倍率（scale）', type: 'range', value: 2.45, min: 0, max: 12, step: 0.05 },
      ambient: { label: '常時透過（ambient）', type: 'range', value: 0.14, min: 0, max: 1, step: 0.005 },
      color: { label: '透過色', type: 'color', value: 0xffd9c2, help: '光が肉を抜けてくる色。珊瑚は暖色寄りにすると生っぽくなる' },
      thicknessBias: { label: '厚みバイアス', type: 'range', value: 0.0, min: -0.5, max: 0.5, step: 0.01 },
      thicknessScale: { label: '厚み倍率', type: 'range', value: 1.0, min: 0, max: 3, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Light dapple — moving veins of light cast through the canopy
   * ================================================================= */
  dapple: {
    label: '光のゆらぎ（ダップル）',
    note: '天蓋を透かした光の斑。C章の「光の揺らぎ」に相当し、静止画との差を最も強く作る要素。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      scale: { label: '模様の細かさ', type: 'range', value: 0.115, min: 0.005, max: 0.8, step: 0.001 },
      speed: { label: '流れる速さ', type: 'range', value: 0.145, min: 0, max: 1.5, step: 0.001 },
      sharpness: { label: '筋の鋭さ', type: 'range', value: 2.6, min: 0.5, max: 10, step: 0.05 },
      contrast: { label: '効き具合', type: 'range', value: 0.52, min: 0, max: 1, step: 0.01 },
      tint: { label: '斑の色付け', type: 'color', value: 0xfff0d4 },
    },
  },

  /* ================================================================= *
   * Terrain — the plateau the diorama sits on
   * ================================================================= */
  terrain: {
    label: '地形（台地）',
    params: {
      seed: { label: 'シード', type: 'range', value: 20260819, min: 1, max: 99999999, step: 1, rebuild: 'geometry' },
      radius: { label: '半径', type: 'range', value: 96, min: 20, max: 240, step: 1, rebuild: 'geometry' },
      segments: { label: '分割数', type: 'range', value: 104, min: 24, max: 260, step: 4, rebuild: 'geometry' },
      heightScale: { label: '起伏の高さ', type: 'range', value: 3.4, min: 0, max: 12, step: 0.05, rebuild: 'geometry' },
      noiseScale: { label: '起伏の粒度', type: 'range', value: 0.072, min: 0.005, max: 0.3, step: 0.001, rebuild: 'geometry' },
      octaves: { label: '起伏オクターブ', type: 'range', value: 5, min: 1, max: 6, step: 1, rebuild: 'geometry' },
      ridged: { label: '稜線を立てる', type: 'bool', value: true, rebuild: 'geometry' },
      terraceSteps: { label: '段差の数', type: 'range', value: 7, min: 0, max: 16, step: 1, rebuild: 'geometry', help: '0で無効。台地らしい水平な段を刻む' },
      terraceAmount: { label: '段差の強さ', type: 'range', value: 0.44, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      valleyRise: {
        label: '谷壁の高さ', type: 'range', value: 10.0, min: 0, max: 30, step: 0.1, rebuild: 'geometry',
        help: '0で平原。参照画像には地平線が一切写っておらず、両脇の壁が構図を閉じている',
      },
      valleyWidth: { label: '谷底の半幅', type: 'range', value: 3.0, min: 0.5, max: 20, step: 0.1, rebuild: 'geometry' },
      valleyFlare: {
        label: '奥への広がり', type: 'range', value: 0.13, min: 0, max: 1, step: 0.005, rebuild: 'geometry',
        help: '1m奥に進むごとに谷底が何m広がるか。0で平行な峡谷',
      },
      valleyRamp: { label: '壁の立ち上がり幅', type: 'range', value: 4.0, min: 0.5, max: 20, step: 0.1, rebuild: 'geometry' },
      valleyCurve: { label: '壁のカーブ', type: 'range', value: 1.20, min: 0.4, max: 3, step: 0.01, rebuild: 'geometry' },
      valleyClamp: { label: '壁の高さ上限（倍）', type: 'range', value: 2.20, min: 0.2, max: 6, step: 0.01, rebuild: 'geometry' },
      valleyLift: { label: '奥の持ち上げ', type: 'range', value: 4.0, min: 0, max: 20, step: 0.1, rebuild: 'geometry' },
      valleyLength: { label: '谷の奥行き', type: 'range', value: 46, min: 5, max: 160, step: 1, rebuild: 'geometry' },
      valleyOriginX: { label: '谷の中心 X', type: 'range', value: 0.0, min: -20, max: 20, step: 0.1, rebuild: 'geometry' },
      valleyOriginZ: {
        label: '谷の起点 Z', type: 'range', value: 9.0, min: -20, max: 30, step: 0.1, rebuild: 'geometry',
        help: 'カメラ位置Zに合わせる。ここより手前は谷壁なしの開けた前景',
      },
      basinRadius: { label: '手前のくぼみ半径', type: 'range', value: 15.0, min: 0, max: 60, step: 0.5, rebuild: 'geometry' },
      basinDepth: { label: 'くぼみの深さ', type: 'range', value: 1.2, min: 0, max: 8, step: 0.05, rebuild: 'geometry' },
      colorLow: { label: '低所の色', type: 'color', value: 0x1e2a3c },
      colorHigh: { label: '高所の色', type: 'color', value: 0x46525f },
      colorSlope: { label: '急斜面の色', type: 'color', value: 0x18202e },
      slopeSharpness: { label: '斜面の切り替わり', type: 'range', value: 3.4, min: 0.5, max: 16, step: 0.1 },
      encrustColor: { label: '珊瑚の付着色', type: 'color', value: 0xb5b492 },
      encrustAmount: { label: '付着量', type: 'range', value: 0.34, min: 0, max: 1, step: 0.01 },
      encrustScale: { label: '付着の粒度', type: 'range', value: 0.38, min: 0.02, max: 2, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Pierced rock towers — B章 中景の主役
   * ================================================================= */
  scatter: {
    label: '散布ドメイン',
    note: 'C章の固定カメラ前提。ディスク散布はフレーム外に予算を捨てるので、既定はカメラ前方の扇形。',
    params: {
      viewCone: {
        label: 'カメラ前方の扇形に限定', type: 'bool', value: true, rebuild: 'geometry',
        help: 'OFFで原点中心のディスク散布に戻る。同じ本数でも画面内密度が一桁変わる',
      },
      spreadDeg: {
        label: '扇の開き角（度）', type: 'range', value: 84, min: 20, max: 200, step: 1, rebuild: 'geometry',
        help: '水平画角は16:10・垂直41°でおよそ62°。少し広く取ってフレーム端の切れ際も埋める',
      },
      bleed: {
        label: 'はみ出し許容', type: 'range', value: 1.14, min: 1.0, max: 1.6, step: 0.01, rebuild: 'geometry',
        help: '群落がフレーム境界で不自然に途切れないよう、扇の外側にどれだけこぼすか',
      },
      frameSpread: {
        label: '前景枠の張り出し', type: 'range', value: 0.86, min: 0.2, max: 2.0, step: 0.01, rebuild: 'geometry',
        help: '1.0で前景オブジェクトの中心がちょうどフレーム端に乗る',
      },
    },
  },

  towers: {
    label: '穴あき岩塔（中景）',
    note: 'B章「有機的な穴の空いた岩の塔（2〜3体）」。SDFをマーチングキューブで面出しして生成する。',
    params: {
      count: { label: '本数', type: 'range', value: 3, min: 0, max: 6, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 7734, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      resolution: { label: 'ボクセル解像度', type: 'range', value: 40, min: 20, max: 76, step: 2, rebuild: 'geometry', help: '生成負荷は3乗で効く。品質と生成時間のトレードオフ' },
      heightMin: { label: '高さ 最小', type: 'range', value: 9.0, min: 1, max: 30, step: 0.1, rebuild: 'geometry' },
      heightMax: { label: '高さ 最大', type: 'range', value: 16.0, min: 1, max: 40, step: 0.1, rebuild: 'geometry' },
      radiusMin: { label: '太さ 最小', type: 'range', value: 1.95, min: 0.2, max: 8, step: 0.05, rebuild: 'geometry' },
      radiusMax: { label: '太さ 最大', type: 'range', value: 3.20, min: 0.2, max: 8, step: 0.05, rebuild: 'geometry' },
      taper: { label: '先細り', type: 'range', value: 0.44, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      bulge: { label: '中腹の膨らみ', type: 'range', value: 0.34, min: 0, max: 1.5, step: 0.01, rebuild: 'geometry' },
      leanAngle: { label: '傾き（度）', type: 'range', value: 7.5, min: 0, max: 35, step: 0.5, rebuild: 'geometry' },
      holeCount: { label: '穴の数', type: 'range', value: 5, min: 0, max: 24, step: 1, rebuild: 'geometry' },
      holeRadius: { label: '穴の大きさ', type: 'range', value: 0.42, min: 0.05, max: 0.78, step: 0.01, rebuild: 'geometry' },
      holeRadiusVar: { label: '穴の大きさばらつき', type: 'range', value: 0.35, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      holeSmooth: { label: '穴の縁のなめらかさ', type: 'range', value: 0.28, min: 0.01, max: 1.5, step: 0.01, rebuild: 'geometry' },
      noiseScale: { label: '岩肌の粒度', type: 'range', value: 1.05, min: 0.1, max: 5, step: 0.01, rebuild: 'geometry' },
      noiseAmount: { label: '岩肌の凹凸', type: 'range', value: 0.30, min: 0, max: 1.2, step: 0.01, rebuild: 'geometry' },
      warpAmount: { label: 'ドメインワープ', type: 'range', value: 0.28, min: 0, max: 1.5, step: 0.01, rebuild: 'geometry', help: '塔全体をよじる。有機的な形の主因' },
      warpScale: { label: 'ワープの粒度', type: 'range', value: 0.42, min: 0.02, max: 2, step: 0.01, rebuild: 'geometry' },
      spreadRadius: { label: '配置の広がり', type: 'range', value: 8.0, min: 2, max: 40, step: 0.5, rebuild: 'geometry' },
      spreadDepth: { label: '配置の奥行き', type: 'range', value: -26.0, min: -50, max: 0, step: 0.5, rebuild: 'geometry' },
      colorBase: { label: '根元の色', type: 'color', value: 0x2f3d52 },
      colorTop: { label: '頂部の色', type: 'color', value: 0xb6c6cd },
      thickness: { label: '透過の厚み', type: 'range', value: 0.12, min: 0, max: 1, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Branching (staghorn) coral — the bone-white silhouettes
   * ================================================================= */
  branchCoral: {
    label: '枝珊瑚（骨色）',
    note: '逆光でシルエットが立つ主役。L-system風の再帰生成をInstancedMeshで散らす。',
    params: {
      count: { label: '本数', type: 'range', value: 222, min: 0, max: 500, step: 1, rebuild: 'geometry' },
      variants: { label: '形状バリエーション数', type: 'range', value: 6, min: 2, max: 12, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 4211, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      levels: { label: '分岐段数', type: 'range', value: 4, min: 1, max: 6, step: 1, rebuild: 'geometry' },
      branchesPerLevel: { label: '1段あたりの分岐', type: 'range', value: 3, min: 1, max: 5, step: 1, rebuild: 'geometry' },
      trunkLength: { label: '幹の長さ', type: 'range', value: 0.50, min: 0.1, max: 3, step: 0.01, rebuild: 'geometry' },
      lengthFalloff: { label: '長さの減衰', type: 'range', value: 0.80, min: 0.3, max: 1.0, step: 0.01, rebuild: 'geometry' },
      trunkRadius: { label: '幹の太さ', type: 'range', value: 0.105, min: 0.005, max: 0.4, step: 0.001, rebuild: 'geometry' },
      radiusFalloff: { label: '太さの減衰', type: 'range', value: 0.74, min: 0.2, max: 1.0, step: 0.01, rebuild: 'geometry' },
      spreadAngle: { label: '開き角（度）', type: 'range', value: 48, min: 5, max: 85, step: 1, rebuild: 'geometry' },
      curl: { label: '上向きへの巻き', type: 'range', value: 0.58, min: -1, max: 1, step: 0.01, rebuild: 'geometry' },
      wobble: { label: '枝の揺らぎ', type: 'range', value: 0.34, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      tipSwell: { label: '先端の膨らみ', type: 'range', value: 1.30, min: 0.5, max: 4, step: 0.01, rebuild: 'geometry' },
      radialSegments: { label: '円周分割', type: 'range', value: 4, min: 3, max: 10, step: 1, rebuild: 'geometry' },
      scaleMin: { label: 'スケール 最小', type: 'range', value: 0.40, min: 0.1, max: 4, step: 0.01, rebuild: 'geometry' },
      scaleMax: { label: 'スケール 最大', type: 'range', value: 1.50, min: 0.1, max: 6, step: 0.01, rebuild: 'geometry' },
      areaInner: { label: '配置 内周（カメラから）', type: 'range', value: 8.5, min: 0, max: 40, step: 0.5, rebuild: 'geometry' },
      areaOuter: { label: '配置 外周（カメラから）', type: 'range', value: 34, min: 2, max: 90, step: 0.5, rebuild: 'geometry' },
      clusters: { label: '群落の数', type: 'range', value: 15, min: 0, max: 30, step: 1, rebuild: 'geometry', help: '0で均一散布。珊瑚は群落を作るので、数を絞るほど密なブッシュと空き地のコントラストが出る' },
      clusterRadius: { label: '群落の広がり', type: 'range', value: 5.8, min: 0.5, max: 16, step: 0.1, rebuild: 'geometry' },
      slopeLimit: { label: '許容斜度', type: 'range', value: 0.82, min: 0.05, max: 0.95, step: 0.01, rebuild: 'geometry', help: '1に近いほど急な谷壁にも取り付く。参照画像の珊瑚は壁面をびっしり覆っている' },
      colorBase: { label: '根元の色', type: 'color', value: 0x455663 },
      colorTip: { label: '先端の色', type: 'color', value: 0xe6eff4 },
      colorVariance: { label: '色のばらつき', type: 'range', value: 0.22, min: 0, max: 0.6, step: 0.005 },
      thickness: { label: '透過の厚み', type: 'range', value: 0.50, min: 0, max: 1, step: 0.01 },
      swayAmount: { label: '揺れ幅', type: 'range', value: 0.020, min: 0, max: 0.2, step: 0.001 },
      swaySpeed: { label: '揺れ速度', type: 'range', value: 0.42, min: 0, max: 3, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Glowing blue coral — B章「一部に発光する青い枝状の珊瑚」
   * ================================================================= */
  glowCoral: {
    label: '発光する青珊瑚',
    note: 'B章の指定要素。K章の訂正どおり「全身発光」ではなく先端側だけを光らせる。',
    params: {
      count: { label: '本数', type: 'range', value: 34, min: 0, max: 160, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 991, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      scaleMin: { label: 'スケール 最小', type: 'range', value: 0.5, min: 0.1, max: 3, step: 0.01, rebuild: 'geometry' },
      scaleMax: { label: 'スケール 最大', type: 'range', value: 1.25, min: 0.1, max: 5, step: 0.01, rebuild: 'geometry' },
      areaInner: { label: '配置 内周（カメラから）', type: 'range', value: 5.0, min: 0, max: 40, step: 0.5, rebuild: 'geometry' },
      areaOuter: { label: '配置 外周（カメラから）', type: 'range', value: 30, min: 2, max: 80, step: 0.5, rebuild: 'geometry' },
      clusters: { label: '群落の数', type: 'range', value: 8, min: 0, max: 30, step: 1, rebuild: 'geometry', help: '0で均一散布。珊瑚は群落を作るので、数を絞るほど密なブッシュと空き地のコントラストが出る' },
      clusterRadius: { label: '群落の広がり', type: 'range', value: 3.4, min: 0.5, max: 16, step: 0.1, rebuild: 'geometry' },
      slopeLimit: { label: '許容斜度', type: 'range', value: 0.82, min: 0.05, max: 0.95, step: 0.01, rebuild: 'geometry', help: '1に近いほど急な谷壁にも取り付く。参照画像の珊瑚は壁面をびっしり覆っている' },
      bodyColor: { label: '本体色', type: 'color', value: 0x2e6f96 },
      glowColor: { label: '発光色', type: 'color', value: 0x49d8ff },
      glowStrength: { label: '発光強度', type: 'range', value: 2.25, min: 0, max: 12, step: 0.05 },
      glowTipBias: { label: '先端への偏り', type: 'range', value: 2.4, min: 0.2, max: 8, step: 0.05 },
      pulseAmount: { label: '明滅の深さ', type: 'range', value: 0.22, min: 0, max: 1, step: 0.01 },
      pulseSpeed: { label: '明滅の速さ', type: 'range', value: 0.55, min: 0, max: 4, step: 0.01 },
      thickness: { label: '透過の厚み', type: 'range', value: 0.95, min: 0, max: 1, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Plate / table coral — the warm counterpoint in the lower frame
   * ================================================================= */
  plateCoral: {
    label: 'テーブル珊瑚（暖色）',
    note: '寒色一色になるのを防ぐ暖色の受け皿。参照画像の手前側に効いている要素。',
    params: {
      count: { label: '枚数', type: 'range', value: 88, min: 0, max: 320, step: 1, rebuild: 'geometry' },
      variants: { label: '形状バリエーション数', type: 'range', value: 4, min: 2, max: 10, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 3120, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      radius: { label: '半径', type: 'range', value: 0.62, min: 0.05, max: 3, step: 0.01, rebuild: 'geometry' },
      radiusVar: { label: '半径のばらつき', type: 'range', value: 0.55, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      thicknessGeo: { label: '板の厚み', type: 'range', value: 0.055, min: 0.005, max: 0.4, step: 0.001, rebuild: 'geometry' },
      rippleCount: { label: '縁の波打ち数', type: 'range', value: 7, min: 0, max: 20, step: 1, rebuild: 'geometry' },
      rippleAmount: { label: '波打ちの深さ', type: 'range', value: 0.07, min: 0, max: 0.6, step: 0.005, rebuild: 'geometry' },
      domeAmount: { label: '中央のふくらみ', type: 'range', value: 0.09, min: -0.5, max: 0.8, step: 0.005, rebuild: 'geometry' },
      tiers: { label: '重なり段数', type: 'range', value: 3, min: 1, max: 4, step: 1, rebuild: 'geometry' },
      radialSegments: { label: '円周分割', type: 'range', value: 16, min: 6, max: 48, step: 1, rebuild: 'geometry' },
      stemHeight: { label: '柄の高さ', type: 'range', value: 0.20, min: 0, max: 1.2, step: 0.005, rebuild: 'geometry' },
      scaleMin: { label: 'スケール 最小', type: 'range', value: 0.65, min: 0.1, max: 4, step: 0.01, rebuild: 'geometry' },
      scaleMax: { label: 'スケール 最大', type: 'range', value: 2.60, min: 0.1, max: 6, step: 0.01, rebuild: 'geometry' },
      areaInner: { label: '配置 内周（カメラから）', type: 'range', value: 4.0, min: 0, max: 30, step: 0.5, rebuild: 'geometry' },
      areaOuter: { label: '配置 外周（カメラから）', type: 'range', value: 26, min: 2, max: 70, step: 0.5, rebuild: 'geometry' },
      clusters: { label: '群落の数', type: 'range', value: 11, min: 0, max: 30, step: 1, rebuild: 'geometry', help: '0で均一散布。珊瑚は群落を作るので、数を絞るほど密なブッシュと空き地のコントラストが出る' },
      clusterRadius: { label: '群落の広がり', type: 'range', value: 3.8, min: 0.5, max: 16, step: 0.1, rebuild: 'geometry' },
      slopeLimit: { label: '許容斜度', type: 'range', value: 0.58, min: 0.05, max: 0.95, step: 0.01, rebuild: 'geometry', help: '1に近いほど急な谷壁にも取り付く。参照画像の珊瑚は壁面をびっしり覆っている' },
      colorTop: { label: '上面の色', type: 'color', value: 0x6b6c3e },
      colorEdge: { label: '縁の色', type: 'color', value: 0xa89b62 },
      colorUnder: { label: '裏面の色', type: 'color', value: 0x3a4046 },
      colorVariance: { label: '色のばらつき', type: 'range', value: 0.16, min: 0, max: 0.6, step: 0.005 },
      thickness: { label: '透過の厚み', type: 'range', value: 0.20, min: 0, max: 1, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Fan coral — thin translucent blades, the strongest SSS showcase
   * ================================================================= */
  fanCoral: {
    label: '扇珊瑚（薄板）',
    note: '最も薄い部位なので擬似SSSが最も強く出る。逆光での「透け」の見本。',
    params: {
      count: { label: '枚数', type: 'range', value: 42, min: 0, max: 200, step: 1, rebuild: 'geometry' },
      variants: { label: '形状バリエーション数', type: 'range', value: 4, min: 2, max: 8, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 6602, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      width: { label: '幅', type: 'range', value: 1.62, min: 0.1, max: 4, step: 0.01, rebuild: 'geometry' },
      height: { label: '高さ', type: 'range', value: 1.05, min: 0.1, max: 4, step: 0.01, rebuild: 'geometry' },
      segmentsX: { label: '横分割', type: 'range', value: 13, min: 3, max: 32, step: 1, rebuild: 'geometry' },
      segmentsY: { label: '縦分割', type: 'range', value: 9, min: 3, max: 32, step: 1, rebuild: 'geometry' },
      waviness: { label: 'うねり', type: 'range', value: 0.34, min: 0, max: 1, step: 0.005, rebuild: 'geometry' },
      curvature: { label: '反り（湾曲）', type: 'range', value: 0.10, min: -1, max: 1, step: 0.01, rebuild: 'geometry' },
      lobes: { label: '縁の切れ込み数', type: 'range', value: 7, min: 0, max: 14, step: 1, rebuild: 'geometry' },
      scaleMin: { label: 'スケール 最小', type: 'range', value: 0.6, min: 0.1, max: 3, step: 0.01, rebuild: 'geometry' },
      scaleMax: { label: 'スケール 最大', type: 'range', value: 1.25, min: 0.1, max: 5, step: 0.01, rebuild: 'geometry' },
      areaInner: { label: '配置 内周（カメラから）', type: 'range', value: 6.5, min: 0, max: 40, step: 0.5, rebuild: 'geometry' },
      areaOuter: { label: '配置 外周（カメラから）', type: 'range', value: 30, min: 2, max: 80, step: 0.5, rebuild: 'geometry' },
      clusters: { label: '群落の数', type: 'range', value: 10, min: 0, max: 30, step: 1, rebuild: 'geometry', help: '0で均一散布。珊瑚は群落を作るので、数を絞るほど密なブッシュと空き地のコントラストが出る' },
      clusterRadius: { label: '群落の広がり', type: 'range', value: 3.2, min: 0.5, max: 16, step: 0.1, rebuild: 'geometry' },
      slopeLimit: { label: '許容斜度', type: 'range', value: 0.44, min: 0.05, max: 0.95, step: 0.01, rebuild: 'geometry', help: '1に近いほど急な谷壁にも取り付く。参照画像の珊瑚は壁面をびっしり覆っている' },
      colorA: { label: '色A（青）', type: 'color', value: 0x7fc4e4 },
      colorB: { label: '色B（桃）', type: 'color', value: 0xdca8bd },
      colorMix: { label: '色Bの比率', type: 'range', value: 0.34, min: 0, max: 1, step: 0.01 },
      thickness: { label: '透過の厚み', type: 'range', value: 1.0, min: 0, max: 1, step: 0.01 },
      swayAmount: { label: '揺れ幅', type: 'range', value: 0.045, min: 0, max: 0.3, step: 0.001 },
      swaySpeed: { label: '揺れ速度', type: 'range', value: 0.62, min: 0, max: 3, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Foreground framing — B章「手前の岩・珊瑚の茂みで画面端を縁取る」
   * ================================================================= */
  rubble: {
    label: '谷壁の岩塊',
    note: '参照画像の両脇の土手は滑らかな斜面ではなく岩とサンゴの塊でできている。'
      + 'ハイトフィールドのリング間隔では2〜5mの起伏を持てないので、ジオメトリで割る。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true, rebuild: 'geometry' },
      count: { label: '個数', type: 'range', value: 104, min: 0, max: 400, step: 1, rebuild: 'geometry' },
      variants: { label: '形状バリエーション数', type: 'range', value: 4, min: 2, max: 12, step: 1, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 4471, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      detail: { label: '細分化', type: 'range', value: 2, min: 0, max: 4, step: 1, rebuild: 'geometry' },
      noise: { label: '凹凸', type: 'range', value: 0.74, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      scaleMin: { label: 'スケール 最小', type: 'range', value: 0.38, min: 0.1, max: 6, step: 0.01, rebuild: 'geometry' },
      scaleMax: { label: 'スケール 最大', type: 'range', value: 1.35, min: 0.1, max: 10, step: 0.01, rebuild: 'geometry' },
      sink: { label: '埋め込み量（スケール比）', type: 'range', value: 0.34, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      areaInner: { label: '配置 内周（カメラから）', type: 'range', value: 5.0, min: 0, max: 40, step: 0.5, rebuild: 'geometry' },
      areaOuter: { label: '配置 外周（カメラから）', type: 'range', value: 42, min: 2, max: 90, step: 0.5, rebuild: 'geometry' },
      clusters: { label: '群落の数', type: 'range', value: 12, min: 0, max: 30, step: 1, rebuild: 'geometry' },
      clusterRadius: { label: '群落の広がり', type: 'range', value: 6.5, min: 0.5, max: 16, step: 0.1, rebuild: 'geometry' },
      slopeFloor: {
        label: '必要な最小斜度', type: 'range', value: 0.30, min: 0, max: 0.9, step: 0.01, rebuild: 'geometry',
        help: '0で平地にも置く。上げるほど谷壁だけを狙う',
      },
      slopeLimit: { label: '許容斜度', type: 'range', value: 0.92, min: 0.05, max: 0.95, step: 0.01, rebuild: 'geometry' },
      colorBase: { label: '根元の色', type: 'color', value: 0x22303f },
      colorTop: { label: '頂部の色', type: 'color', value: 0x5b6b74 },
      colorVariance: { label: '色のばらつき', type: 'range', value: 0.18, min: 0, max: 0.6, step: 0.005 },
      thickness: { label: '透過の厚み', type: 'range', value: 0.06, min: 0, max: 1, step: 0.01 },
    },
  },

  framing: {
    label: '前景フレーミング',
    note: 'B章「覗き込む構図の枠を作る」。暗く落として画面端だけを縁取る。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 8801, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      rockCount: { label: '前景岩の数', type: 'range', value: 8, min: 0, max: 20, step: 1, rebuild: 'geometry' },
      rockScale: { label: '前景岩の大きさ', type: 'range', value: 1.40, min: 0.3, max: 10, step: 0.05, rebuild: 'geometry' },
      rockDetail: { label: '前景岩の細かさ', type: 'range', value: 2, min: 0, max: 4, step: 1, rebuild: 'geometry' },
      rockNoise: { label: '前景岩の凹凸', type: 'range', value: 0.34, min: 0, max: 1, step: 0.01, rebuild: 'geometry' },
      bushCount: { label: '前景茂みの数', type: 'range', value: 16, min: 0, max: 140, step: 1, rebuild: 'geometry' },
      bushScale: { label: '前景茂みの大きさ', type: 'range', value: 0.50, min: 0.2, max: 5, step: 0.05, rebuild: 'geometry' },
      spreadX: { label: '左右への広がり', type: 'range', value: 7.6, min: 1, max: 24, step: 0.1, rebuild: 'geometry' },
      depthZ: { label: 'カメラからの距離', type: 'range', value: 3.4, min: 0.5, max: 14, step: 0.1, rebuild: 'geometry' },
      dropY: { label: '下げ量（スケール比）', type: 'range', value: 0.30, min: -1, max: 2, step: 0.01, rebuild: 'geometry' },
      centerGap: { label: '中央を空ける幅', type: 'range', value: 5.0, min: 0, max: 14, step: 0.1, rebuild: 'geometry' },
      darkness: { label: '暗さ', type: 'range', value: 0.80, min: 0, max: 1, step: 0.01, help: '1で真っ黒なシルエット' },
      color: { label: '前景の色', type: 'color', value: 0x1b2a42 },
      rimBoost: { label: '前景リムの持ち上げ', type: 'range', value: 1.45, min: 0, max: 4, step: 0.05 },
    },
  },

  /* ================================================================= *
   * Far ridges — B章 遠景「霧に沈む塔状の巨大シルエット」
   * ================================================================= */
  ridges: {
    label: '遠景シルエット',
    note: 'B章「霧に沈む塔状の巨大シルエット」。1ドローコールの手続き的レイヤーで処理コストを抑える。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      layers: { label: 'レイヤー数', type: 'range', value: 4, min: 1, max: 6, step: 1 },
      distance: { label: '距離', type: 'range', value: 165, min: 40, max: 400, step: 5 },
      baseHeight: { label: '基準高さ', type: 'range', value: 0.085, min: -0.2, max: 0.5, step: 0.005 },
      amplitude: { label: '高さの振れ', type: 'range', value: 0.145, min: 0, max: 0.6, step: 0.005 },
      frequency: { label: '峰の密度', type: 'range', value: 2.35, min: 0.2, max: 10, step: 0.05 },
      spikiness: { label: '尖り', type: 'range', value: 2.55, min: 0.5, max: 8, step: 0.05 },
      layerFalloff: { label: '奥の層の減衰', type: 'range', value: 0.62, min: 0.1, max: 1, step: 0.01 },
      colorNear: { label: '手前の層の色', type: 'color', value: 0x3c6a94 },
      colorFar: { label: '奥の層の色', type: 'color', value: 0x27507d },
      opacity: { label: '不透明度', type: 'range', value: 0.86, min: 0, max: 1, step: 0.01 },
      driftSpeed: { label: '流れる速さ', type: 'range', value: 0.0045, min: 0, max: 0.05, step: 0.0001 },
    },
  },

  /* ================================================================= *
   * Motes — floating particles. C章「浮遊粒子」
   * ================================================================= */
  motes: {
    label: '浮遊粒子',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      count: { label: '個数', type: 'range', value: 1500, min: 0, max: 6000, step: 50, rebuild: 'geometry' },
      seed: { label: 'シード', type: 'range', value: 5150, min: 1, max: 99999, step: 1, rebuild: 'geometry' },
      spreadX: { label: '分布 X', type: 'range', value: 34, min: 2, max: 120, step: 1, rebuild: 'geometry' },
      spreadY: { label: '分布 Y', type: 'range', value: 15, min: 1, max: 60, step: 0.5, rebuild: 'geometry' },
      spreadZ: { label: '分布 Z', type: 'range', value: 42, min: 2, max: 140, step: 1, rebuild: 'geometry' },
      offsetY: { label: '中心の高さ', type: 'range', value: 4.2, min: -5, max: 30, step: 0.1, rebuild: 'geometry' },
      offsetZ: { label: '中心の奥行き', type: 'range', value: -8, min: -60, max: 10, step: 0.5, rebuild: 'geometry' },
      sizeMin: { label: '粒の大きさ 最小', type: 'range', value: 1.4, min: 0.2, max: 20, step: 0.1 },
      sizeMax: { label: '粒の大きさ 最大', type: 'range', value: 5.6, min: 0.2, max: 40, step: 0.1 },
      opacity: { label: '不透明度', type: 'range', value: 0.50, min: 0, max: 2, step: 0.01 },
      color: { label: '粒の色', type: 'color', value: 0xdff0ff },
      riseSpeed: { label: '上昇速度', type: 'range', value: 0.075, min: -1, max: 1, step: 0.001 },
      driftSpeed: { label: '漂う速さ', type: 'range', value: 0.115, min: 0, max: 1.5, step: 0.001 },
      driftScale: { label: '漂う軌道の大きさ', type: 'range', value: 0.55, min: 0.02, max: 3, step: 0.01 },
      twinkleSpeed: { label: '瞬きの速さ', type: 'range', value: 0.85, min: 0, max: 6, step: 0.01 },
      twinkleAmount: { label: '瞬きの深さ', type: 'range', value: 0.55, min: 0, max: 1, step: 0.01 },
      sunBias: { label: '光源側での増光', type: 'range', value: 1.35, min: 0, max: 5, step: 0.05, help: '光芒の中を通る粒だけを強く光らせる' },
      softness: { label: '粒の柔らかさ', type: 'range', value: 2.1, min: 0.5, max: 8, step: 0.05 },
      nearFade: { label: '手前フェード距離', type: 'range', value: 2.2, min: 0, max: 12, step: 0.1 },
    },
  },

  /* ================================================================= *
   * God rays — Mitchell (GPU Gems 3) radial-blur post, occlusion-buffer driven
   * ================================================================= */
  godrays: {
    label: '光芒（God Rays）',
    note: 'B章「1〜2本の強い光芒が霧を貫く」。遮蔽バッファ＋放射ブラーで実装（GPU Gems 3方式）。レイマーチと違い影バッファ不要で Pixel 7a でも軽い。',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      samples: { label: 'サンプル数', type: 'range', value: 40, min: 8, max: 120, step: 1 },
      density: { label: '密度（density）', type: 'range', value: 0.96, min: 0.05, max: 1.5, step: 0.005, help: 'サンプル間隔。大きいほど光芒が長く伸びる' },
      weight: { label: '重み（weight）', type: 'range', value: 0.42, min: 0, max: 3, step: 0.005 },
      decay: { label: '減衰（decay）', type: 'range', value: 0.962, min: 0.8, max: 1.0, step: 0.001 },
      exposure: { label: '露光（exposure）', type: 'range', value: 0.40, min: 0, max: 3, step: 0.005 },
      clampMax: { label: '上限クランプ', type: 'range', value: 1.35, min: 0.1, max: 4, step: 0.01 },
      intensity: { label: '合成強度', type: 'range', value: 1.05, min: 0, max: 4, step: 0.01 },
      tint: { label: '光芒の色', type: 'color', value: 0xdfeeff },
      resolutionScale: { label: '解像度スケール', type: 'range', value: 0.42, min: 0.15, max: 1, step: 0.05, rebuild: 'passes' },
      occlusionHalo: { label: '遮蔽バッファの光輪', type: 'range', value: 0.30, min: 0, max: 3, step: 0.01, help: '光源周辺のどこまでを光芒の種にするか' },
      blur: { label: '軽いブラーをかける', type: 'bool', value: true },
      offScreenFade: { label: '画面外フェード', type: 'range', value: 0.55, min: 0, max: 2, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Bloom — progressive down/upsample (Jimenez, SIGGRAPH 2014 style)
   * ================================================================= */
  bloom: {
    label: 'ブルーム',
    params: {
      enabled: { label: '有効', type: 'bool', value: true },
      threshold: { label: 'しきい値', type: 'range', value: 1.15, min: 0, max: 6, step: 0.01 },
      knee: { label: 'ソフトニー', type: 'range', value: 0.55, min: 0, max: 1, step: 0.01 },
      intensity: { label: '強度', type: 'range', value: 0.22, min: 0, max: 3, step: 0.01 },
      radius: { label: '半径', type: 'range', value: 0.78, min: 0, max: 1.5, step: 0.01 },
      mips: { label: 'ミップ段数', type: 'range', value: 4, min: 1, max: 7, step: 1, rebuild: 'passes' },
      tint: { label: '色付け', type: 'color', value: 0xffffff },
    },
  },

  /* ================================================================= *
   * Grade — tone mapping + colour grading + lens artefacts
   * ================================================================= */
  grade: {
    label: 'トーン・カラーグレード',
    note: 'A章の流用項目「トーンマッピングでグレー化を防ぐ」。ACESが既定。',
    params: {
      exposure: { label: '露出', type: 'range', value: 0.72, min: 0.05, max: 4, step: 0.01 },
      toneMapping: { label: 'トーンマッピング', type: 'select', value: 'aces', options: [
        { value: 'aces', label: 'ACES Filmic（既定）' },
        { value: 'neutral', label: 'Khronos PBR Neutral' },
        { value: 'reinhard', label: 'Reinhard' },
        { value: 'none', label: 'なし（クランプのみ）' },
      ] },
      contrast: { label: 'コントラスト', type: 'range', value: 1.04, min: 0.3, max: 2.5, step: 0.005 },
      saturation: { label: '彩度', type: 'range', value: 1.18, min: 0, max: 2.5, step: 0.005 },
      lift: { label: 'リフト（黒の持ち上げ）', type: 'range', value: 0.015, min: -0.1, max: 0.2, step: 0.001 },
      gain: { label: 'ゲイン（白）', type: 'range', value: 0.958, min: 0.3, max: 2, step: 0.005 },
      temperature: { label: '色温度シフト', type: 'range', value: -0.045, min: -1, max: 1, step: 0.005, help: '負で寒色、正で暖色' },
      tintShift: { label: 'ティント（緑↔マゼンタ）', type: 'range', value: 0.018, min: -1, max: 1, step: 0.005 },
      shadowTint: { label: 'シャドウの色', type: 'color', value: 0x2c4d78 },
      shadowTintAmount: { label: 'シャドウ着色量', type: 'range', value: 0.30, min: 0, max: 1, step: 0.005 },
      highlightTint: { label: 'ハイライトの色', type: 'color', value: 0xfff2dc },
      highlightTintAmount: { label: 'ハイライト着色量', type: 'range', value: 0.13, min: 0, max: 1, step: 0.005 },
      vignetteAmount: { label: 'ビネット量', type: 'range', value: 0.33, min: 0, max: 1.5, step: 0.005 },
      vignetteRadius: { label: 'ビネット半径', type: 'range', value: 0.72, min: 0.1, max: 1.5, step: 0.005 },
      vignetteSoftness: { label: 'ビネットの柔らかさ', type: 'range', value: 0.62, min: 0.05, max: 2, step: 0.005 },
      chromatic: { label: '色収差', type: 'range', value: 0.0022, min: 0, max: 0.02, step: 0.0001 },
      grainAmount: { label: 'グレイン量', type: 'range', value: 0.030, min: 0, max: 0.2, step: 0.001 },
      grainSize: { label: 'グレインの粒度', type: 'range', value: 1.5, min: 0.3, max: 6, step: 0.05 },
      dither: { label: 'ディザ（バンディング対策）', type: 'range', value: 0.55, min: 0, max: 2, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Stage — where グリモ will stand (C章「フィギュア的」に置く前提の空き地)
   * ================================================================= */
  stage: {
    label: 'グリモの立ち位置',
    note: 'C章「背景内の特定の場所への接地感は不要／フィギュア的に置く」。ここを散布から除外して空けておく。',
    params: {
      clearX: { label: '中心 X', type: 'range', value: 0.0, min: -10, max: 10, step: 0.05, rebuild: 'geometry' },
      clearZ: { label: '中心 Z', type: 'range', value: -1.2, min: -20, max: 6, step: 0.05, rebuild: 'geometry' },
      clearRadius: { label: '空ける半径', type: 'range', value: 2.35, min: 0, max: 10, step: 0.05, rebuild: 'geometry' },
      markerEnabled: { label: '立ち位置を可視化', type: 'bool', value: false, help: '確認用。実際のアプリでは常にオフ' },
      markerColor: { label: 'マーカー色', type: 'color', value: 0x7fe6ff },
      markerOpacity: { label: 'マーカー濃度', type: 'range', value: 0.35, min: 0, max: 1, step: 0.01 },
    },
  },

  /* ================================================================= *
   * Quality — G章 自動縮退。full / reduced の2段（H章の契約値）
   * ================================================================= */
  quality: {
    label: '品質・性能',
    note: 'H章「性能判定モジュールが full / reduced を決定し、背景・グリモ・UI が同じ段階を購読する」。',
    params: {
      tier: { label: '品質段階', type: 'select', value: 'auto', options: [
        { value: 'auto', label: '自動（FPSで縮退）' },
        { value: 'full', label: 'full 固定' },
        { value: 'reduced', label: 'reduced 固定' },
      ] },
      pixelRatioCap: { label: 'ピクセル比上限', type: 'range', value: 2.0, min: 0.5, max: 3, step: 0.05, rebuild: 'passes' },
      pixelRatioCapMobile: { label: 'ピクセル比上限（モバイル）', type: 'range', value: 1.5, min: 0.5, max: 3, step: 0.05, rebuild: 'passes' },
      renderScale: { label: '内部解像度スケール', type: 'range', value: 1.0, min: 0.4, max: 1.0, step: 0.05, rebuild: 'passes' },
      targetFps: { label: '目標FPS', type: 'range', value: 55, min: 24, max: 120, step: 1 },
      degradeWindow: { label: '縮退の判定窓（秒）', type: 'range', value: 2.5, min: 0.5, max: 10, step: 0.1 },
      warmupWindow: {
        label: '生成後の猶予（秒）', type: 'range', value: 4.0, min: 0, max: 15, step: 0.1,
        help: 'ジオメトリ生成とシェーダ初回コンパイルの間はFPSを判定に使わない。実測で生成直後に約2.5秒間28〜41fpsまで落ちてから60fpsに戻る',
      },
      recoverMargin: {
        label: '復帰のFPS余裕', type: 'range', value: 0, min: 0, max: 40, step: 1,
        help: '目標FPSにこれだけ上乗せした値以上を維持し続けたら full に戻す。'
          + 'vsync上限があるため（リフレッシュレート − 目標FPS）を超える値にすると永久に復帰できない',
      },
      recoverWindow: {
        label: '復帰の判定窓（秒）', type: 'range', value: 8.0, min: 1, max: 30, step: 0.5,
        help: '縮退より長くしてハンチングを防ぐ。復帰は1セッション1回限り',
      },
      auditGeometry: {
        label: 'ジオメトリ健全性チェック', type: 'bool', value: true,
        help: '生成した各ジオメトリの退化三角形率を測り、5割超ならコンソールに出す。'
          + '面積ゼロのメッシュは属性もインデックスもバウンディングボックスも正常に見えるため、これ以外に検出手段がない',
      },
      pauseWhenHidden: { label: '非表示時に停止', type: 'bool', value: true },
      timeScale: { label: '時間倍率', type: 'range', value: 1.0, min: 0, max: 4, step: 0.01, help: '0で完全停止。演出の確認用' },
    },
  },
};

/** Overrides applied to the `reduced` quality tier (G章: Pixel 7a 等での自動縮退). */
export const REDUCED_TIER = {
  towers: { resolution: 38 },
  branchCoral: { count: 54, levels: 3, radialSegments: 4, variants: 4 },
  glowCoral: { count: 12 },
  plateCoral: { count: 40, radialSegments: 14, variants: 3, tiers: 1 },
  fanCoral: { count: 18, segmentsX: 9, segmentsY: 7, variants: 3 },
  framing: { rockCount: 5, bushCount: 14, rockDetail: 1 },
  rubble: { count: 60, detail: 1, variants: 4 },
  terrain: { segments: 76, octaves: 3 },
  scatter: { spreadDeg: 80 },
  motes: { count: 420 },
  godrays: { samples: 26, resolutionScale: 0.34 },
  bloom: { mips: 3 },
  ridges: { layers: 3 },
  grade: { chromatic: 0.0, grainAmount: 0.018 },
  sky: { canopyOctaves: 3 },
  surface: { normalPerturb: 0.0 },
};

/**
 * Named looks. Each is a sparse diff over the schema defaults.
 * `reference` reproduces Image1's cold-cyan atmosphere; `warm-backlight` follows B章's
 * literal "暖色〜中間色" wording; the other two exist to prove the parameterisation
 * spans a real range rather than one hand-tuned frame.
 */
export const PRESETS = {
  reference: {
    label: '① 参照忠実（寒色シアン）',
    diff: {},
  },
  warmBacklight: {
    label: '② 暖色逆光（B章の文言どおり）',
    diff: {
      sun: { color: 0xffd9a3, intensity: 3.8, elevation: 21, temperatureK: 4200 },
      sky: { zenithColor: 0x1b2c4a, horizonColor: 0x6e83a0, haloColor: 0xffe6c0, haloIntensity: 3.2, canopyColor: 0xd8d0bd },
      fog: { nearColor: 0x9aa8b4, midColor: 0x6c7f96, farColor: 0x475f7d, inscatterColor: 0xffdfb4, inscatterStrength: 0.9 },
      surface: { ambientSky: 0xbcd0e4, ambientGround: 0x2f3446, rimColor: 0xffe8cc },
      grade: { temperature: 0.08, saturation: 1.0, shadowTint: 0x3a4a6a, highlightTint: 0xffe9c8 },
      godrays: { tint: 0xffeacd, intensity: 1.25 },
      glowCoral: { glowColor: 0x7fe0ff, glowStrength: 1.6 },
    },
  },
  deepBlue: {
    label: '③ 深部（暗く沈んだ青）',
    diff: {
      sun: { intensity: 2.3, elevation: 34, color: 0xdcecff },
      sky: { zenithColor: 0x050e22, horizonColor: 0x1d4a70, haloIntensity: 2.0, canopyColor: 0x76a8c8, canopyCoverage: 0.6 },
      fog: { density: 0.026, nearColor: 0x4c7ba0, midColor: 0x2e5a86, farColor: 0x152f52 },
      grade: { exposure: 1.0, temperature: -0.12, vignetteAmount: 0.6, saturation: 1.1 },
      glowCoral: { glowStrength: 3.4, count: 40 },
      motes: { opacity: 0.7 },
    },
  },
  bioluminescent: {
    label: '④ 夜（生物発光）',
    diff: {
      sun: { intensity: 0.85, color: 0xbcd8ff, elevation: 48, discIntensity: 6 },
      sky: { zenithColor: 0x03060f, horizonColor: 0x0d2340, haloColor: 0x9fc6ff, haloIntensity: 1.1, canopyColor: 0x3c6a92, canopyCoverage: 0.62, starEnabled: true },
      fog: { density: 0.03, nearColor: 0x1c3350, midColor: 0x13253f, farColor: 0x0a1730, inscatterStrength: 0.35 },
      surface: { ambientSky: 0x3f6a95, ambientGround: 0x10182a, ambientIntensity: 0.5, rimColor: 0x9fd6ff },
      glowCoral: { glowStrength: 6.5, count: 68, pulseAmount: 0.4 },
      branchCoral: { colorTip: 0xcfe4ee },
      motes: { opacity: 0.9, color: 0x9fe8ff, twinkleAmount: 0.8 },
      godrays: { intensity: 0.55, exposure: 0.34 },
      bloom: { intensity: 0.95, threshold: 0.7 },
      grade: { exposure: 1.2, vignetteAmount: 0.7, temperature: -0.16 },
    },
  },
};

/* ------------------------------------------------------------------ *
 * Runtime helpers
 * ------------------------------------------------------------------ */

/** Materialises a flat `{group: {key: value}}` state object from the schema defaults. */
export function createParams() {
  const out = {};
  for (const [groupKey, group] of Object.entries(SCHEMA)) {
    out[groupKey] = {};
    for (const [key, def] of Object.entries(group.params)) {
      out[groupKey][key] = def.value;
    }
  }
  return out;
}

/** Deep-merges a sparse diff into a params object, in place. Unknown keys are ignored. */
export function applyDiff(params, diff) {
  if (!diff) return params;
  for (const [groupKey, group] of Object.entries(diff)) {
    if (!params[groupKey] || !SCHEMA[groupKey]) continue;
    for (const [key, value] of Object.entries(group)) {
      if (!(key in SCHEMA[groupKey].params)) continue;
      if (typeof value !== 'number' && typeof value !== 'boolean' && typeof value !== 'string') continue;
      params[groupKey][key] = value;
    }
  }
  return params;
}

/** Returns the schema definition for a param path, or null. */
export function getDef(groupKey, key) {
  return SCHEMA[groupKey]?.params?.[key] ?? null;
}

/** Sparse diff of `params` against the schema defaults — what `Copy JSON` emits. */
export function diffFromDefaults(params) {
  const out = {};
  for (const [groupKey, group] of Object.entries(SCHEMA)) {
    for (const [key, def] of Object.entries(group.params)) {
      const current = params[groupKey]?.[key];
      if (current === undefined || current === def.value) continue;
      out[groupKey] = out[groupKey] || {};
      out[groupKey][key] = def.type === 'color' ? colorHex(current) : current;
    }
  }
  return out;
}

/** 0xRRGGBB integer → "0x1a2b3c" string, so exported JSON stays readable as source. */
export function colorHex(value) {
  return `0x${(value >>> 0).toString(16).padStart(6, '0')}`;
}
