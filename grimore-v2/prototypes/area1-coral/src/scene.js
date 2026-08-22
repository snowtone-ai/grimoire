/**
 * scene.js — assembles Area 1 and owns the frame loop.
 *
 * Layer discipline follows C章: the background world is a self-contained viewing space.
 * It never reads anything from a creature or the UI; it only *publishes* the environment
 * contract (H章) that グリモ and the UI chrome subscribe to.
 *
 * Frame order:
 *   sky quad → world (HDR target) → occlusion buffer → god rays → bloom → composite
 */

import * as THREE from 'three';
import { REDUCED_TIER, applyDiff, createParams } from './params.js';
import {
  makeTerrainField, buildTerrain, buildTower, buildBranchCoral, buildPlateCoral,
  buildFanCoral, buildBoulder, scatterOnTerrain, makeViewWedge, applyInstances, countTriangles,
  degenerateFraction,
} from './geometry.js';
import {
  createSharedUniforms, createWorldMaterial, createSkyMaterial, createSkyOcclusionMaterial,
  createOccluderMaterial, createRidgeMaterials, createMoteMaterial,
} from './materials.js';
import { PostPipeline } from './passes.js';
import { makeRng, rand } from './noise.js';
import { RuntimeQualityGovernor } from './quality.js';

const AREA_ID = 'area-01-coral-plateau';
const CONTRACT_VERSION = 2;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Merges the reduced-tier overrides into a copy of `params` when the tier demands it. */
function effectiveParams(params, tier) {
  if (tier !== 'reduced') return params;
  const copy = structuredClone(params);
  applyDiff(copy, REDUCED_TIER);
  return copy;
}

export class CoralArea {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} params  live parameter state (mutated in place by the GUI)
   */
  constructor(canvas, params) {
    this.canvas = canvas;
    this.params = params;
    this.effective = params;
    this.tier = 'full';
    this.resolvedTier = 'full';
    this.disposed = false;
    this.running = false;
    this.buildToken = 0;
    this.building = false;
    this.listeners = new Set();
    this.onProgress = null;
    // Live, not a one-shot read: the OS setting can be toggled while the page is open and
    // the whole point of honouring it is that it takes effect when the user asks for it.
    this._motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.reducedMotion = this._motionQuery?.matches ?? false;
    this._onMotionPreference = (e) => {
      this.reducedMotion = e.matches;
      this.syncUniforms();
    };
    this._motionQuery?.addEventListener?.('change', this._onMotionPreference);

    this.stats = {
      fps: 0,
      fpsP20: 0,
      drawCalls: 0,
      totalDrawCalls: 0,
      primarySceneTriangles: 0,
      rendererTotalTriangles: 0,
      postPasses: 0,
      programs: 0,
      buildMs: 0,
      qualityLocked: false,
      qualityReason: 'initial-full',
    };
    this.qualityGovernor = new RuntimeQualityGovernor();
    this.qualityReason = 'initial-full';
    this._time = 0;
    this._lastFrame = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // the composite pass is the last write; MSAA on the HDR target instead
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    // Every pass calls render(); with autoReset the HUD would only ever see the last one.
    this.renderer.info.autoReset = false;

    this.isMobile = (window.matchMedia?.('(pointer: coarse)').matches ?? false)
      && (navigator.maxTouchPoints ?? 0) > 0;

    this.camera = new THREE.PerspectiveCamera(params.camera.fov, 1, params.camera.near, params.camera.far);
    this.skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.worldScene = new THREE.Scene();
    this.skyScene = new THREE.Scene();

    this.shared = createSharedUniforms(params);
    this.occluderMaterial = createOccluderMaterial();

    this.skyMaterial = createSkyMaterial(this.shared, params.sky.canopyOctaves);
    this.skyOcclusionMaterial = createSkyOcclusionMaterial(this.shared, params.godrays.occlusionHalo);
    const skyGeo = new THREE.PlaneGeometry(2, 2);
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.frustumCulled = false;
    this.skyScene.add(this.skyMesh);

    this.materials = this._createMaterials(params);
    this.group = new THREE.Group();
    this.worldScene.add(this.group);
    this.meshes = {};
    this.towerFootprints = [];

    this.post = new PostPipeline(this.renderer, params);

    this._sunDir = new THREE.Vector3();
    this._sunWorld = new THREE.Vector3();
    this._lightScreen = new THREE.Vector2(0.5, 0.8);
    this._camForward = new THREE.Vector3();
    this._envCache = null;

    this._onContextLost = (e) => {
      e.preventDefault();
      this.running = false;
      this.emit('contextlost', {});
    };
    this._onContextRestored = () => {
      this.emit('contextrestored', {});
      this.rebuild();
    };
    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
  }

  /* ---------------------------------------------------------------- *
   * Materials
   * ---------------------------------------------------------------- */

  _createMaterials(p) {
    const q = this.resolvedTier;
    // rimScale: a fresnel rim is a silhouette effect. Large receding surfaces are at a
    // grazing angle over most of their area, so they take only a fraction of it.
    const m = {
      terrain: createWorldMaterial(this.shared, { albedo: 'terrain', encrust: true, quality: q, rimScale: 0.10 }),
      tower: createWorldMaterial(this.shared, { albedo: 'tower', encrust: true, quality: q, rimScale: 0.45 }),
      branch: createWorldMaterial(this.shared, { albedo: 'tip', quality: q, rimScale: 1.0 }),
      glow: createWorldMaterial(this.shared, { albedo: 'tip', emissive: true, quality: q, rimScale: 1.0 }),
      plate: createWorldMaterial(this.shared, { albedo: 'plate', quality: q, rimScale: 0.55 }),
      fan: createWorldMaterial(this.shared, { albedo: 'tip', doubleSided: true, quality: q, rimScale: 0.9 }),
      framing: createWorldMaterial(this.shared, { albedo: 'tip', framing: true, quality: q, rimScale: 1.0 }),
      rubble: createWorldMaterial(this.shared, { albedo: 'tower', encrust: true, quality: q, rimScale: 0.35 }),
    };
    const ridge = createRidgeMaterials(this.shared, p.ridges);
    m.ridge = ridge.main;
    m.ridgeOcclusion = ridge.occlusion;
    m.ridgeUniforms = ridge.uniforms;
    m.motes = createMoteMaterial(this.shared, p.motes);
    return m;
  }

  /* ---------------------------------------------------------------- *
   * World construction
   * ---------------------------------------------------------------- */

  async rebuild() {
    const token = ++this.buildToken;
    this.building = true;
    this.qualityGovernor.beginWarmup(this.params.quality.warmupWindow);
    const started = performance.now();
    const p = this.effective;
    const report = (label, frac) => this.onProgress?.(label, frac);

    // Tear down the previous world (materials are shared and survive).
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.geometry?.dispose();
    }
    this.meshes = {};

    report('地形を生成中', 0.05);
    const field = makeTerrainField(p.terrain);
    this.field = field;
    const terrainGeo = buildTerrain(p.terrain, field);
    const terrain = new THREE.Mesh(terrainGeo, this.materials.terrain);
    terrain.frustumCulled = false;
    this.group.add(terrain);
    this.meshes.terrain = terrain;
    if (token !== this.buildToken) return;
    await nextFrame();

    /* --- pierced rock towers ---------------------------------------- */
    const towerRng = makeRng(p.towers.seed);
    const towerSpots = [];
    this.towerFootprints = [];
    for (let i = 0; i < Math.round(p.towers.count); i++) {
      const a = (i / Math.max(1, p.towers.count)) * Math.PI * 2 + towerRng() * 1.1;
      const rad = p.towers.spreadRadius * (0.45 + towerRng() * 0.75);
      const x = Math.cos(a) * rad * 0.85;
      const z = p.towers.spreadDepth + Math.sin(a) * rad * 0.55;
      const height = rand(towerRng, p.towers.heightMin, p.towers.heightMax);
      const radius = rand(towerRng, p.towers.radiusMin, p.towers.radiusMax);
      towerSpots.push({ x, z, height, radius, seed: (p.towers.seed + i * 7919) | 0 });
      this.towerFootprints.push({ x, z, r: radius * 1.5 });
    }

    for (let i = 0; i < towerSpots.length; i++) {
      report(`岩塔を生成中 ${i + 1}/${towerSpots.length}`, 0.1 + (i / Math.max(1, towerSpots.length)) * 0.45);
      await nextFrame();
      if (token !== this.buildToken) return;
      const spot = towerSpots[i];
      const geo = buildTower(p.towers, spot.seed);
      const mesh = new THREE.Mesh(geo, this.materials.tower);
      // The SDF lives in a [-1,1] cube; map it onto the requested world footprint.
      mesh.scale.set(spot.radius, spot.height * 0.5, spot.radius);
      // The SDF floor sits at y = -0.99 of the half-height, so sink by a fraction of the
      // radius as well — a narrow tower on a sloped valley wall otherwise shows daylight
      // under one side of its foot.
      mesh.position.set(
        spot.x,
        field.height(spot.x, spot.z) + spot.height * 0.5 - 0.35 - spot.radius * 0.55,
        spot.z
      );
      mesh.rotation.y = towerRng() * Math.PI * 2;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    if (token !== this.buildToken) return;

    const stage = { x: p.stage.clearX, z: p.stage.clearZ, radius: p.stage.clearRadius };
    const camZ = p.camera.posZ;

    /* --- instanced coral -------------------------------------------- */
    report('珊瑚を生成中', 0.6);
    await nextFrame();

    this._addInstancedField({
      key: 'branch',
      cfg: p.branchCoral,
      material: this.materials.branch,
      build: (seed, cheap) => buildBranchCoral(
        cheap ? { ...p.branchCoral, levels: Math.max(2, p.branchCoral.levels - 1) } : p.branchCoral,
        seed
      ),
      field, stage, camZ,
      describe: (spot, cfg, rng) => ({
        color: this._jitterColor(cfg.colorBase, cfg.colorVariance, rng),
        thickness: cfg.thickness,
        emissive: 0,
        sway: cfg.swayAmount,
        phase: rng(),
      }),
      uniforms: (mat, cfg) => {
        mat.uniforms.uColorB.value.setHex(cfg.colorTip);
        mat.uniforms.uTipPower.value = 1.5;
        mat.uniforms.uColorJitter.value = 0.16;
      },
    });

    this._addInstancedField({
      key: 'glow',
      cfg: p.glowCoral,
      material: this.materials.glow,
      build: (seed, cheap) => buildBranchCoral({
        ...p.branchCoral,
        levels: Math.max(2, p.branchCoral.levels - (cheap ? 2 : 1)),
        spreadAngle: p.branchCoral.spreadAngle * 0.85,
      }, seed),
      field, stage, camZ,
      describe: (spot, cfg, rng) => ({
        color: new THREE.Color(cfg.bodyColor),
        thickness: cfg.thickness,
        emissive: 0.7 + rng() * 0.6,
        sway: p.branchCoral.swayAmount * 0.8,
        phase: rng(),
      }),
      uniforms: (mat, cfg) => {
        mat.uniforms.uColorB.value.setHex(cfg.glowColor);
        mat.uniforms.uTipPower.value = 2.0;
        mat.uniforms.uEmissiveColor.value.setHex(cfg.glowColor);
        mat.uniforms.uEmissive.value.set(cfg.glowStrength, cfg.glowTipBias, cfg.pulseAmount, cfg.pulseSpeed);
        mat.uniforms.uColorJitter.value = 0.1;
      },
    });

    this._addInstancedField({
      key: 'plate',
      cfg: p.plateCoral,
      material: this.materials.plate,
      build: (seed, cheap) => buildPlateCoral(
        cheap
          ? { ...p.plateCoral, radialSegments: Math.max(6, Math.round(p.plateCoral.radialSegments * 0.6)),
              tiers: Math.max(1, p.plateCoral.tiers - 1) }
          : p.plateCoral,
        seed
      ),
      field, stage, camZ,
      describe: (spot, cfg, rng) => ({
        color: this._jitterColor(cfg.colorTop, cfg.colorVariance, rng),
        thickness: cfg.thickness,
        emissive: 0,
        sway: 0,
        phase: rng(),
      }),
      uniforms: (mat, cfg) => {
        mat.uniforms.uColorB.value.setHex(cfg.colorEdge);
        mat.uniforms.uColorC.value.setHex(cfg.colorUnder);
        mat.uniforms.uColorJitter.value = 0.18;
      },
    });

    this._addInstancedField({
      key: 'fan',
      cfg: p.fanCoral,
      material: this.materials.fan,
      build: (seed, cheap) => buildFanCoral(
        cheap
          ? { ...p.fanCoral, segmentsX: Math.max(3, Math.round(p.fanCoral.segmentsX * 0.6)),
              segmentsY: Math.max(3, Math.round(p.fanCoral.segmentsY * 0.6)) }
          : p.fanCoral,
        seed
      ),
      field, stage, camZ,
      uprightOnly: true,
      describe: (spot, cfg, rng) => {
        const base = new THREE.Color(cfg.colorA);
        base.lerp(new THREE.Color(cfg.colorB), rng() < cfg.colorMix ? 0.75 + rng() * 0.25 : rng() * 0.2);
        return {
          color: base,
          thickness: cfg.thickness,
          emissive: 0,
          sway: cfg.swayAmount,
          phase: rng(),
        };
      },
      uniforms: (mat, cfg) => {
        const tip = new THREE.Color(cfg.colorA).lerp(new THREE.Color(0xffffff), 0.55);
        mat.uniforms.uColorB.value.copy(tip);
        mat.uniforms.uTipPower.value = 1.8;
        mat.uniforms.uColorJitter.value = 0.14;
      },
    });

    if (p.rubble.enabled) {
      this._addInstancedField({
        key: 'rubble',
        cfg: p.rubble,
        material: this.materials.rubble,
        build: (seed, cheap) => buildBoulder(cheap ? Math.max(0, p.rubble.detail - 1) : p.rubble.detail, p.rubble.noise, seed),
        field, stage, camZ,
        sinkRatio: p.rubble.sink,
        describe: (spot, cfg, rng) => ({
          color: this._jitterColor(cfg.colorBase, cfg.colorVariance, rng),
          thickness: cfg.thickness,
          emissive: 0,
          sway: 0,
          phase: rng(),
        }),
        uniforms: (mat, cfg) => {
          mat.uniforms.uColorA.value.setHex(cfg.colorBase);
          mat.uniforms.uColorB.value.setHex(cfg.colorTop);
          mat.uniforms.uColorJitter.value = 0.2;
        },
      });
    }

    if (token !== this.buildToken) return;
    report('前景を生成中', 0.8);
    await nextFrame();

    /* --- foreground framing ----------------------------------------- */
    if (p.framing.enabled) this._buildFraming(p, field);

    /* --- far ridges -------------------------------------------------- */
    if (p.ridges.enabled) this._buildRidges(p);

    /* --- motes ------------------------------------------------------- */
    if (p.motes.enabled && p.motes.count > 0) this._buildMotes(p);

    /* --- stage marker ------------------------------------------------ */
    if (p.stage.markerEnabled) this._buildStageMarker(p, field);

    if (token !== this.buildToken) return;
    report('仕上げ中', 0.95);

    this.stats.buildMs = Math.round(performance.now() - started);
    // PERF-05: the primary budget is visible world geometry only. The sky is a sibling
    // scene and repeated occlusion/post rendering is reported separately at render time.
    this.stats.primarySceneTriangles = countTriangles(this.group);
    this.syncUniforms();
    this.building = false;
    this.emit('built', { stats: { ...this.stats } });
    report('完了', 1);
  }

  _jitterColor(hex, variance, rng) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(
      (hsl.h + (rng() * 2 - 1) * variance * 0.25 + 1) % 1,
      THREE.MathUtils.clamp(hsl.s * (1 + (rng() * 2 - 1) * variance), 0, 1),
      THREE.MathUtils.clamp(hsl.l * (1 + (rng() * 2 - 1) * variance * 1.4), 0.02, 0.98)
    );
    return c;
  }

  /**
   * Builds N shape variants, scatters `cfg.count` placements and packs them into one
   * InstancedMesh per variant — so a whole coral field costs `variants` draw calls.
   */
  _addInstancedField({
    key, cfg, material, build, field, stage, camZ, describe, uniforms,
    uprightOnly = false, sinkRatio = 0,
  }) {
    if (!cfg.count || cfg.count <= 0) return;
    uniforms?.(material, cfg);

    // Two levels of detail. The variant list is split in half and `build` is told which
    // half it is producing, so the second half can come back cheaper; placements are then
    // assigned by distance from the camera. Buys roughly 40% more coral for the same
    // triangle budget, and the swap happens where it cannot be resolved anyway.
    const variantCount = Math.max(2, Math.round(cfg.variants ?? 1));
    const nearVariants = Math.max(1, variantCount >> 1);
    const geometries = [];
    for (let v = 0; v < variantCount; v++) {
      const geo = build((cfg.seed + v * 104729) | 0, v >= nearVariants);
      if (this.params.quality.auditGeometry) {
        const bad = degenerateFraction(geo);
        if (bad > 0.5) {
          console.error(
            `[${key}] variant ${v}: ${(bad * 100).toFixed(0)}% of triangles have zero area — ` +
            'this geometry will draw nothing. Check the generator.'
          );
        }
      }
      geometries.push(geo);
    }

    const rng = makeRng(cfg.seed ^ 0x51ed);
    const placements = scatterOnTerrain({
      rng,
      count: Math.round(cfg.count),
      inner: cfg.areaInner,
      outer: cfg.areaOuter,
      field,
      avoid: this.towerFootprints,
      cameraZ: camZ,
      minCameraDist: 2.0,
      stage,
      slopeLimit: cfg.slopeLimit ?? (uprightOnly ? 0.35 : 0.55),
      slopeFloor: cfg.slopeFloor ?? 0,
      clusters: cfg.clusters ?? 0,
      clusterRadius: cfg.clusterRadius ?? 4,
      view: this.params.scatter.viewCone
        ? makeViewWedge(this.params.camera, this.params.scatter.spreadDeg, this.params.scatter.bleed)
        : null,
    });

    // Near half of the field gets the detailed variants, far half the cheap ones; the
    // modulo inside each band keeps shape variety from collapsing to one silhouette.
    const camX = this.params.camera.posX;
    const ordered = placements
      .map((spot) => ({ spot, d: Math.hypot(spot.x - camX, spot.z - camZ) }))
      .sort((a, b) => a.d - b.d);
    const farVariants = variantCount - nearVariants;
    const buckets = geometries.map(() => []);
    ordered.forEach((entry, rank) => {
      const isNear = rank * 2 < ordered.length;
      const base = isNear ? 0 : nearVariants;
      const span = isNear ? nearVariants : farVariants;
      buckets[base + (rank % span)].push(entry.spot);
    });

    buckets.forEach((bucket, v) => {
      if (bucket.length === 0) { geometries[v].dispose(); return; }
      const mesh = new THREE.InstancedMesh(geometries[v], material, bucket.length);
      applyInstances(mesh, bucket, (spot) => {
        const spec = describe(spot, cfg, rng);
        const s = rand(rng, cfg.scaleMin ?? 1, cfg.scaleMax ?? 1);
        // Corals lean toward the surface normal, then take a random yaw.
        const tiltX = uprightOnly ? 0 : (spot.normal.z) * 0.5 + (rng() * 2 - 1) * 0.12;
        const tiltZ = uprightOnly ? 0 : (-spot.normal.x) * 0.5 + (rng() * 2 - 1) * 0.12;
        return {
          position: { x: spot.x, y: spot.y - 0.04 - s * sinkRatio, z: spot.z },
          rotation: { x: tiltX, y: rng() * Math.PI * 2, z: tiltZ },
          scale: { x: s, y: s * rand(rng, 0.88, 1.15), z: s },
          ...spec,
        };
      });
      mesh.name = `${key}-${v}`;
      this.group.add(mesh);
    });
  }

  _buildFraming(p, field) {
    const cfg = p.framing;
    const mat = this.materials.framing;
    mat.uniforms.uColorA.value.setHex(cfg.color);
    mat.uniforms.uColorB.value.setHex(cfg.color);
    mat.uniforms.uFrame.value.set(cfg.darkness, cfg.rimBoost);
    mat.uniforms.uColorJitter.value = 0.08;

    const rng = makeRng(cfg.seed);
    const boulder = buildBoulder(cfg.rockDetail, cfg.rockNoise, cfg.seed);
    const bushGeo = buildBranchCoral(
      { ...p.branchCoral, levels: Math.max(2, p.branchCoral.levels - 1), radialSegments: 4 },
      (cfg.seed + 31) | 0
    );

    // Frame-relative placement. Laying these out in world X put every one of them outside
    // the 62-degree horizontal frame (measured: 0 of 41 on screen), because the frame is
    // only ~2.6 m wide at the 4 m the foreground sits at. Deriving the offset from the
    // wedge instead means they straddle the frame edge at whatever FOV is configured.
    const wedge = makeViewWedge(p.camera, p.scatter.spreadDeg, p.scatter.bleed);
    const placeSide = (count, geo, scaleBase, out) => {
      for (let i = 0; i < count; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const d = cfg.depthZ + rand(rng, -0.9, 2.8);
        // 1.0 puts the object's centre exactly on the frame edge; below that it intrudes.
        const frac = p.scatter.frameSpread * rand(rng, 0.42, 1.22);
        const a = wedge.angle + side * wedge.halfAngle * frac;
        const x = wedge.x + Math.sin(a) * d;
        const z = wedge.z + Math.cos(a) * d;
        const scale = scaleBase * rand(rng, 0.55, 1.5);
        // Sink proportionally to size, so a big rock buries the same fraction of itself
        // as a small one and only the crown breaks the terrain line.
        const y = field.height(x, z) - cfg.dropY * scale;
        out.push({ x, y, z, scale, rot: rng() * Math.PI * 2, rnd: rng() });
      }
    };

    const rocks = [];
    placeSide(Math.round(cfg.rockCount), boulder, cfg.rockScale, rocks);
    const bushes = [];
    placeSide(Math.round(cfg.bushCount), bushGeo, cfg.bushScale, bushes);

    const mkInstanced = (geo, list, extraSway) => {
      if (list.length === 0) { geo.dispose(); return; }
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      applyInstances(mesh, list, (spot) => ({
        position: { x: spot.x, y: spot.y, z: spot.z },
        rotation: { x: (spot.rnd - 0.5) * 0.3, y: spot.rot, z: (spot.rnd - 0.5) * 0.25 },
        scale: { x: spot.scale, y: spot.scale * (0.8 + spot.rnd * 0.5), z: spot.scale },
        color: new THREE.Color(cfg.color),
        thickness: 0.35,
        emissive: 0,
        sway: extraSway,
        phase: spot.rnd,
      }));
      mesh.name = 'framing';
      this.group.add(mesh);
    };

    mkInstanced(boulder, rocks, 0);
    mkInstanced(bushGeo, bushes, p.branchCoral.swayAmount * 0.6);
  }

  _buildRidges(p) {
    const cfg = p.ridges;
    // A single quad, sized so it fills the frame at `distance` with room to spare.
    const width = cfg.distance * 3.4;
    const height = cfg.distance * 1.25;
    const geo = new THREE.PlaneGeometry(width, height, 1, 1);
    const mesh = new THREE.Mesh(geo, this.materials.ridge);
    mesh.position.set(0, height * 0.5 - cfg.distance * 0.16, -cfg.distance);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    mesh.name = 'ridges';
    this.group.add(mesh);
    this.meshes.ridges = mesh;
  }

  _buildMotes(p) {
    const cfg = p.motes;
    const count = Math.round(cfg.count);
    const rng = makeRng(cfg.seed);
    const pos = new Float32Array(count * 3);
    const extra = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() * 2 - 1) * cfg.spreadX * 0.5;
      pos[i * 3 + 1] = (rng() * 2 - 1) * cfg.spreadY * 0.5;
      pos[i * 3 + 2] = (rng() * 2 - 1) * cfg.spreadZ * 0.5;
      extra[i * 4] = rng();
      extra[i * 4 + 1] = rng();
      extra[i * 4 + 2] = rng();
      extra[i * 4 + 3] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMote', new THREE.BufferAttribute(extra, 4));
    const points = new THREE.Points(geo, this.materials.motes);
    points.position.set(0, cfg.offsetY, cfg.offsetZ);
    points.frustumCulled = false;
    points.renderOrder = 10;
    points.name = 'motes';
    this.group.add(points);
    this.meshes.motes = points;
  }

  _buildStageMarker(p, field) {
    const cfg = p.stage;
    const segs = 64;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = cfg.clearX + Math.cos(a) * cfg.clearRadius;
      const z = cfg.clearZ + Math.sin(a) * cfg.clearRadius;
      pts.push(new THREE.Vector3(x, field.height(x, z) + 0.06, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(cfg.markerColor),
      transparent: true,
      opacity: cfg.markerOpacity,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.name = 'stage-marker';
    this.group.add(line);
    this.meshes.stageMarker = line;
  }

  /* ---------------------------------------------------------------- *
   * Uniform sync — every live parameter lands here, once per change
   * ---------------------------------------------------------------- */

  syncUniforms() {
    const p = this.effective;
    const u = this.shared;

    const az = THREE.MathUtils.degToRad(p.sun.azimuth);
    const el = THREE.MathUtils.degToRad(p.sun.elevation);
    this._sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    u.uSunDir.value.copy(this._sunDir);
    u.uSunColor.value.setHex(p.sun.color);
    u.uSunIntensity.value = p.sun.intensity;
    u.uSunDisc.value.set(p.sun.discSize, p.sun.discSoftness, p.sun.discIntensity);
    u.uSunFlicker.value.set(this.reducedMotion ? 0 : p.sun.flickerAmp, p.sun.flickerSpeed);

    u.uSkyZenith.value.setHex(p.sky.zenithColor);
    u.uSkyHorizon.value.setHex(p.sky.horizonColor);
    u.uSkyGround.value.setHex(p.sky.groundColor);
    u.uSkyGradientPower.value = p.sky.gradientPower;
    u.uHaloColor.value.setHex(p.sky.haloColor);
    u.uHalo.value.set(p.sky.haloIntensity, p.sky.haloFalloff);
    u.uCanopyColor.value.setHex(p.sky.canopyColor);
    u.uCanopy.value.set(p.sky.canopyHeight, p.sky.canopyScale, this.reducedMotion ? 0 : p.sky.canopySpeed, p.sky.canopyContrast);
    u.uCanopyMix.value.set(p.sky.canopyCoverage, p.sky.canopyEnabled ? 1 : 0, p.sky.starEnabled ? 1 : 0);

    u.uFogNear.value.setHex(p.fog.nearColor);
    u.uFogMid.value.setHex(p.fog.midColor);
    u.uFogFar.value.setHex(p.fog.farColor);
    u.uFogDist.value.set(p.fog.nearDist, p.fog.midDist, p.fog.farDist);
    u.uFogParams.value.set(p.fog.density, p.fog.power, p.fog.heightFalloff, p.fog.heightOffset);
    u.uFogFloorBoost.value = p.fog.floorBoost;
    u.uFogInscatterColor.value.setHex(p.fog.inscatterColor);
    u.uFogInscatter.value.set(p.fog.inscatterStrength, p.fog.inscatterPower);
    u.uFogScroll.value.set(this.reducedMotion ? 0 : p.fog.scrollSpeed, p.fog.scrollScale, p.fog.scrollAmount);

    u.uWrap.value.set(p.surface.wrap, p.surface.wrapPower);
    u.uAmbientSky.value.setHex(p.surface.ambientSky);
    u.uAmbientGround.value.setHex(p.surface.ambientGround);
    u.uAmbientIntensity.value = p.surface.ambientIntensity;
    u.uRimColor.value.setHex(p.surface.rimColor);
    u.uRim.value.set(p.surface.rimStrength, p.surface.rimPower, p.surface.rimBacklightBias);
    u.uSpec.value.set(p.surface.specStrength, p.surface.specPower);
    u.uAoStrength.value = p.surface.aoStrength;
    u.uDetail.value.set(p.surface.detailScale, p.surface.detailAmount, p.surface.macroScale, p.surface.macroAmount);
    u.uNormalPerturb.value = p.surface.normalPerturb;

    u.uLT.value.set(p.translucency.distortion, p.translucency.power, p.translucency.scale, p.translucency.ambient);
    u.uLTColor.value.setHex(p.translucency.color);
    u.uLTThickness.value.set(p.translucency.thicknessBias, p.translucency.thicknessScale, p.translucency.enabled ? 1 : 0);

    u.uDapple.value.set(p.dapple.scale, this.reducedMotion ? 0 : p.dapple.speed, p.dapple.sharpness, p.dapple.contrast);
    u.uDappleTint.value.setHex(p.dapple.tint);
    u.uDappleOn.value = p.dapple.enabled ? 1 : 0;

    // Per-material colour blocks that are not part of the shared set.
    const mt = this.materials.terrain.uniforms;
    mt.uColorA.value.setHex(p.terrain.colorLow);
    mt.uColorB.value.setHex(p.terrain.colorHigh);
    mt.uColorC.value.setHex(p.terrain.colorSlope);
    mt.uSlopeSharpness.value = p.terrain.slopeSharpness;
    mt.uEncrustColor.value.setHex(p.terrain.encrustColor);
    mt.uEncrust.value.set(p.terrain.encrustAmount, p.terrain.encrustScale);
    mt.uColorJitter.value = 0.06;

    const tw = this.materials.tower.uniforms;
    tw.uColorA.value.setHex(p.towers.colorBase);
    tw.uColorB.value.setHex(p.towers.colorTop);
    tw.uEncrustColor.value.setHex(p.terrain.encrustColor);
    tw.uEncrust.value.set(p.terrain.encrustAmount * 0.75, p.terrain.encrustScale * 1.4);
    tw.uInstDefault.value.set(p.towers.thickness, 0, 0, 0);
    tw.uColorJitter.value = 0.1;

    this.materials.branch.uniforms.uColorB.value.setHex(p.branchCoral.colorTip);
    this.materials.glow.uniforms.uColorB.value.setHex(p.glowCoral.glowColor);
    this.materials.glow.uniforms.uEmissiveColor.value.setHex(p.glowCoral.glowColor);
    this.materials.glow.uniforms.uEmissive.value.set(
      p.glowCoral.glowStrength, p.glowCoral.glowTipBias,
      this.reducedMotion ? 0 : p.glowCoral.pulseAmount, p.glowCoral.pulseSpeed
    );
    this.materials.plate.uniforms.uColorB.value.setHex(p.plateCoral.colorEdge);
    this.materials.plate.uniforms.uColorC.value.setHex(p.plateCoral.colorUnder);
    this.materials.framing.uniforms.uColorA.value.setHex(p.framing.color);
    this.materials.framing.uniforms.uColorB.value.setHex(p.framing.color);
    this.materials.framing.uniforms.uFrame.value.set(p.framing.darkness, p.framing.rimBoost);

    const sway = this.reducedMotion ? 0 : 1;
    for (const key of ['terrain', 'tower', 'branch', 'glow', 'plate', 'fan', 'framing', 'rubble']) {
      this.materials[key].uniforms.uSway.value.set(p.branchCoral.swaySpeed, sway);
    }

    const ru = this.materials.ridgeUniforms;
    ru.uLayers.value = Math.round(p.ridges.layers);
    ru.uRidge.value.set(p.ridges.baseHeight, p.ridges.amplitude, p.ridges.frequency, p.ridges.spikiness);
    ru.uRidgeMisc.value.set(p.ridges.layerFalloff, this.reducedMotion ? 0 : p.ridges.driftSpeed);
    ru.uRidgeNear.value.setHex(p.ridges.colorNear);
    ru.uRidgeFar.value.setHex(p.ridges.colorFar);
    ru.uRidgeOpacity.value = p.ridges.opacity;

    const mo = this.materials.motes.uniforms;
    mo.uSpread.value.set(p.motes.spreadX, p.motes.spreadY, p.motes.spreadZ);
    mo.uMoteMotion.value.set(
      this.reducedMotion ? 0 : p.motes.riseSpeed,
      this.reducedMotion ? 0 : p.motes.driftSpeed,
      p.motes.driftScale
    );
    mo.uMoteSize.value.set(p.motes.sizeMin, p.motes.sizeMax);
    mo.uMoteColor.value.setHex(p.motes.color);
    mo.uMoteLook.value.set(p.motes.opacity, this.reducedMotion ? 0 : p.motes.twinkleSpeed, p.motes.twinkleAmount, p.motes.softness);
    mo.uSunBias.value = p.motes.sunBias;
    mo.uNearFade.value = p.motes.nearFade;

    this.skyOcclusionMaterial.uniforms.uOcclusionHalo.value = p.godrays.occlusionHalo;
    if (this.meshes?.motes) this.meshes.motes.visible = p.motes.enabled;
    if (this.meshes?.ridges) this.meshes.ridges.visible = p.ridges.enabled;

    this.post?.setSamples(p.godrays.samples);
    this._envCache = null;
    this.emit('environment', this.getEnvironment());
  }

  /** Recompiles the sky when its octave count (a compile-time constant) changes. */
  refreshSkyOctaves() {
    const octaves = Math.max(1, Math.round(this.effective.sky.canopyOctaves));
    const want = `${octaves}.0`;
    if (this.skyMaterial.defines.CANOPY_OCTAVES === want) return;
    this.skyMaterial.defines.CANOPY_OCTAVES = want;
    this.skyMaterial.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- *
   * The shared environment contract (H章)
   * ---------------------------------------------------------------- */

  /**
   * The background world is the only writer. グリモ reads `light` + `tone` to keep its
   * materials from looking composited in; the UI reads `light.color` for glow accents.
   * Nothing may write back.
   */
  getEnvironment() {
    if (this._envCache) return this._envCache;
    const p = this.effective;
    const env = Object.freeze({
      version: CONTRACT_VERSION,
      areaId: AREA_ID,
      quality: Object.freeze({
        tier: this.resolvedTier,
        mode: this.params.quality.tier,
        reason: this.qualityReason,
        locked: this.qualityGovernor.locked,
        mobileProfile: this.isMobile,
        pixelRatio: this._effectiveDpr ?? 1,
        renderScale: p.quality.renderScale,
        postPasses: this.post?.getPassCount(p) ?? 0,
        budgets: Object.freeze({
          degradeFpsP20: this.params.quality.degradeFps,
          fallbackFpsP20: this.params.quality.fallbackFps,
          drawCalls: this.params.quality.drawCallBudgetFull,
          primarySceneTriangles: this.params.quality.triangleBudgetFull,
          triangleTolerance: this.params.quality.triangleTolerance,
          effectiveTriangleLimit: Math.round(
            this.params.quality.triangleBudgetFull
              * (1 + this.params.quality.triangleTolerance)
          ),
          postPasses: this.params.quality.postPassBudgetFull,
          recoverFpsP20: this.params.quality.recoverFps,
          recoverDrawCalls: this.params.quality.recoverDrawCalls,
          recoverPrimarySceneTriangles: this.params.quality.recoverTriangles,
          recoverPostPasses: this.params.quality.recoverPostPasses,
        }),
        sampling: Object.freeze({
          frames: this.params.quality.sampleFrames,
          minimumFrames: this.params.quality.minSamples,
          warmupSeconds: this.params.quality.warmupWindow,
          degradeSeconds: this.params.quality.degradeWindow,
          recoverSeconds: this.params.quality.recoverWindow,
          fallbackSeconds: this.params.quality.fallbackWindow,
          cooldownSeconds: this.params.quality.tierDwell,
          maxAutoDrops: this.params.quality.maxAutoDrops,
        }),
      }),
      light: Object.freeze({
        direction: Object.freeze({ x: this._sunDir.x, y: this._sunDir.y, z: this._sunDir.z }),
        color: p.sun.color,
        intensity: p.sun.intensity,
        temperatureK: p.sun.temperatureK,
      }),
      ambient: Object.freeze({
        sky: p.surface.ambientSky,
        ground: p.surface.ambientGround,
        intensity: p.surface.ambientIntensity,
      }),
      tone: Object.freeze({
        mapping: p.grade.toneMapping,
        exposure: p.grade.exposure,
        contrast: p.grade.contrast,
        saturation: p.grade.saturation,
        temperature: p.grade.temperature,
        tint: p.grade.tintShift,
      }),
      fog: Object.freeze({
        near: p.fog.nearColor,
        mid: p.fog.midColor,
        far: p.fog.farColor,
        density: p.fog.density,
      }),
      stage: Object.freeze({ x: p.stage.clearX, z: p.stage.clearZ, radius: p.stage.clearRadius }),
    });
    this._envCache = env;
    return env;
  }

  on(event, handler) {
    const entry = { event, handler };
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  emit(event, payload) {
    for (const entry of this.listeners) {
      if (entry.event === event) entry.handler(payload);
    }
  }

  /* ---------------------------------------------------------------- *
   * Sizing
   * ---------------------------------------------------------------- */

  setSize(cssWidth, cssHeight) {
    const p = this.effective;
    const cap = this.isMobile ? p.quality.pixelRatioCapMobile : p.quality.pixelRatioCap;
    const dpr = Math.min(window.devicePixelRatio || 1, cap) * p.quality.renderScale;
    this._effectiveDpr = dpr;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;

    this.renderer.setPixelRatio(1); // targets are sized manually, so keep the renderer at 1:1
    this.renderer.setSize(Math.round(cssWidth * dpr), Math.round(cssHeight * dpr), false);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    const w = Math.round(cssWidth * dpr);
    const h = Math.round(cssHeight * dpr);
    this.shared.uResolution.value.set(w, h);
    this.shared.uPixelRatio.value = dpr;

    this.applyCameraFraming(cssWidth / cssHeight);
    this.post?.setSize(w, h, p);
  }

  applyCameraFraming(aspect) {
    const p = this.effective;
    let fov = p.camera.fov;
    let targetY = p.camera.targetY;
    if (aspect < 1) {
      // Portrait: widen the vertical FOV so the horizontal framing survives 9:19.5.
      const t = THREE.MathUtils.clamp((1 - aspect) / 0.6, 0, 1);
      fov = p.camera.fov * THREE.MathUtils.lerp(1, p.camera.portraitFovBoost, t);
      targetY += p.camera.portraitLift * t;
    }
    this.camera.aspect = aspect;
    this.camera.fov = THREE.MathUtils.clamp(fov, 5, 120);
    this.camera.near = p.camera.near;
    this.camera.far = p.camera.far;
    this.camera.updateProjectionMatrix();
    this._framedTargetY = targetY;
  }

  /* ---------------------------------------------------------------- *
   * Frame
   * ---------------------------------------------------------------- */

  updateCamera(dt) {
    const p = this.effective;
    const t = this._time;
    const breathe = this.reducedMotion ? 0 : Math.sin((t / Math.max(p.camera.breathePeriod, 0.01)) * Math.PI * 2) * p.camera.breatheAmp;
    const swayX = this.reducedMotion ? 0 : Math.sin(t * p.camera.swaySpeed * 6.283) * p.camera.swayAmp;
    const swayY = this.reducedMotion ? 0 : Math.cos(t * p.camera.swaySpeed * 4.1) * p.camera.swayAmp * 0.6;

    this.camera.position.set(p.camera.posX, p.camera.posY, p.camera.posZ + breathe);
    this.camera.up.set(Math.sin(THREE.MathUtils.degToRad(p.camera.roll)), Math.cos(THREE.MathUtils.degToRad(p.camera.roll)), 0);
    this.camera.lookAt(
      p.camera.targetX + swayX * 0.12,
      (this._framedTargetY ?? p.camera.targetY) + swayY * 0.12,
      p.camera.targetZ
    );
    this.camera.updateMatrixWorld();
  }

  updateLightScreenPos() {
    this.camera.getWorldDirection(this._camForward);
    const facing = this._camForward.dot(this._sunDir);
    this._sunWorld.copy(this.camera.position).addScaledVector(this._sunDir, 900);
    this._sunWorld.project(this.camera);
    if (facing <= 0.02) {
      // Sun behind the camera: park the source far off-screen so the fade zeroes the rays.
      this._lightScreen.set(-4, -4);
    } else {
      this._lightScreen.set(this._sunWorld.x * 0.5 + 0.5, this._sunWorld.y * 0.5 + 0.5);
    }
  }

  renderFrame(dtRaw) {
    const p = this.effective;
    this.renderer.info.reset();
    const dt = Math.min(dtRaw, 0.1) * p.quality.timeScale;
    this._time += dt;
    this.shared.uTime.value = this._time;

    this.updateCamera(dt);
    this.updateLightScreenPos();

    const skyU = this.skyMaterial.uniforms;
    skyU.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    skyU.uCameraWorld.value.copy(this.camera.matrixWorld);
    skyU.uCameraPos.value.copy(this.camera.position);
    const occU = this.skyOcclusionMaterial.uniforms;
    occU.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    occU.uCameraWorld.value.copy(this.camera.matrixWorld);
    occU.uCameraPos.value.copy(this.camera.position);

    const r = this.renderer;
    const post = this.post;

    /* 1. sky + world into the HDR target */
    r.setRenderTarget(post.sceneRenderTarget);
    r.clear(true, true, false);
    r.render(this.skyScene, this.skyCamera);
    r.render(this.worldScene, this.camera);
    // `renderer.info` accumulates every pass because autoReset=false. Capture the primary
    // scene here so its <=50 budget is not confused with the later occlusion/post draws.
    const sceneDrawCalls = r.info.render.calls;

    /* 2. occlusion buffer: bright sky core, every occluder flat black */
    if (p.godrays.enabled) {
      const motes = this.meshes?.motes;
      const ridges = this.meshes?.ridges;
      const marker = this.meshes?.stageMarker;
      const motesWasVisible = motes?.visible ?? false;
      const markerWasVisible = marker?.visible ?? false;
      if (motes) motes.visible = false;       // additive particles must not block light
      if (marker) marker.visible = false;
      if (ridges) ridges.material = this.materials.ridgeOcclusion;

      this.skyMesh.material = this.skyOcclusionMaterial;
      r.setRenderTarget(post.occlusionTarget);
      r.clear(true, true, false);
      r.render(this.skyScene, this.skyCamera);
      this.worldScene.overrideMaterial = this.occluderMaterial;
      r.render(this.worldScene, this.camera);
      this.worldScene.overrideMaterial = null;
      this.skyMesh.material = this.skyMaterial;

      if (ridges) ridges.material = this.materials.ridge;
      if (motes) motes.visible = motesWasVisible;
      if (marker) marker.visible = markerWasVisible;

      post.renderGodRays(p, this._lightScreen);
    }

    /* 3. bloom */
    if (p.bloom.enabled) post.renderBloom(p);

    /* 4. composite to screen */
    post.composite(p, this._time);
    r.setRenderTarget(null);

    this.stats.drawCalls = sceneDrawCalls;
    this.stats.totalDrawCalls = r.info.render.calls;
    this.stats.rendererTotalTriangles = r.info.render.triangles;
    this.stats.postPasses = post.getPassCount(p);
    this.stats.programs = r.info.programs?.length ?? 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastFrame = performance.now();
    this.renderer.setAnimationLoop((now) => this._tick(now));
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  _tick(now) {
    if (this.disposed) return;
    const dt = Math.max(0, (now - this._lastFrame) / 1000);
    this._lastFrame = now;
    this.renderFrame(dt);
    this._evaluateQuality(dt);
  }

  /** G章: evaluate measured tail FPS plus explicit GPU-work budgets. */
  _evaluateQuality(dt) {
    const verdict = this.qualityGovernor.evaluate({
      dt,
      currentTier: this.resolvedTier,
      forcedTier: this.params.quality.tier,
      building: this.building,
      drawCalls: this.stats.drawCalls,
      primarySceneTriangles: this.stats.primarySceneTriangles,
      postPasses: this.stats.postPasses,
      config: this.params.quality,
    });

    this.stats.fps = Math.round(verdict.metrics.fpsMean);
    this.stats.fpsP20 = Math.round(verdict.metrics.fpsP20);
    this.stats.qualityLocked = verdict.metrics.locked;
    this.stats.qualityReason = verdict.reason;

    if (verdict.nextTier) {
      this.setTier(verdict.nextTier, verdict.reason);
    } else if (verdict.reason !== this.qualityReason) {
      this.qualityReason = verdict.reason;
      this._envCache = null;
      this.emit('environment', this.getEnvironment());
    }
  }

  setTier(tier, reason = `manual-${tier}`) {
    if (tier === this.resolvedTier) return;
    this.resolvedTier = tier;
    this.qualityReason = reason;
    this.qualityGovernor.acceptTier(tier, reason);
    this.effective = effectiveParams(this.params, tier);
    // The quality tier is a compile-time switch in the world shader.
    for (const key of ['terrain', 'tower', 'branch', 'glow', 'plate', 'fan', 'framing']) {
      const mat = this.materials[key];
      mat.defines.Q_FULL = tier === 'reduced' ? 0 : 1;
      mat.needsUpdate = true;
    }
    this.refreshSkyOctaves();
    this.setSize(this.cssWidth, this.cssHeight);
    this._envCache = null;
    this.emit('environment', this.getEnvironment());
    this.emit('tier', { tier, reason, locked: this.qualityGovernor.locked });
    this.rebuild();
  }

  /** Re-derives `effective` after the GUI mutates `params`. */
  refreshEffective() {
    this.effective = effectiveParams(this.params, this.resolvedTier);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this._motionQuery?.removeEventListener?.('change', this._onMotionPreference);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.post?.dispose();
    this.group.traverse((o) => o.geometry?.dispose?.());
    for (const m of Object.values(this.materials)) m?.dispose?.();
    this.skyMaterial.dispose();
    this.skyOcclusionMaterial.dispose();
    this.occluderMaterial.dispose();
    this.renderer.dispose();
  }
}

export { AREA_ID, CONTRACT_VERSION, createParams };
