import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { applyCarolPerformance } from "./carol-3d-motion";
import {
  beginCarolContact, moveCarolContact, heldCarolGesture, finishCarolContact,
  type CarolContact, type CarolGesture,
} from "@/lib/domain/carol-3d-input";

type Action = CarolGesture | "feed" | "front" | "zoomIn" | "zoomOut" | "left" | "right";
export type CarolWorld = {
  act: (action: Action) => void;
  setReference: (show: boolean) => void;
  setPaused: (pause: boolean) => void;
  setOutlineColor: (color: string) => void;
  dispose: () => void;
};
type Hooks = {
  onReady: () => void; onError: (message: string) => void; onReaction: (message: string) => void;
  onFeedState: (feeding: boolean) => void; onFeedHearts: (sequence: number | null) => void;
  onTailStartle: (sequence: number | null) => void;
};

export function createCarolWorld(host: HTMLElement, hooks: Hooks): CarolWorld {
  host.dataset.ready = "false";
  host.dataset.performance = "valid";
  host.dataset.feeding = "false";
  host.dataset.feedCount = "0";
  host.dataset.tailStartle = "false";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "default" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#7985a8");
  scene.fog = new THREE.Fog("#7985a8", 12, 32);
  // The reference itself is a three-quarter illustration. A parallel reference
  // camera preserves its measured proportions; orbit still reveals real depth.
  const camera = new THREE.OrthographicCamera(-3.5, 3.5, 2.3, -2.3, .1, 60);
  scene.add(camera);
  let aspect = 1, yaw = 0, pitch = 0, distance = 8.8;
  const aim = new THREE.Vector3(0, 1.38, 0);
  scene.add(new THREE.HemisphereLight("#eff3ff", "#afa6c2", 1.5));
  const key = new THREE.DirectionalLight("#fff1db", 2);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, far: 15 });
  key.shadow.normalBias = .035;
  key.shadow.bias = -.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#c2ceff", 2);
  rim.position.set(3, 3, -4);
  scene.add(rim);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(35, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    // Display-space backdrop matches the renderer's final fog color at the horizon.
    fragmentShader: "varying vec3 v; void main(){float h=smoothstep(.08,.38,normalize(v).y);gl_FragColor=vec4(mix(vec3(.47451,.52157,.65882),vec3(.08,.13,.25),h),1.);}",
  }));
  scene.add(sky);
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: "#c6cde7", roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), cloudMaterial);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -.28;
  ground.receiveShadow = true;
  scene.add(ground);
  // One merged bank keeps draw calls low; its flat summit supports actual footsteps.
  const cloudParts: THREE.BufferGeometry[] = [];
  const summit = new THREE.SphereGeometry(1, 36, 16);
  summit.scale(2.05, .27, 1.4);
  summit.translate(0, -.20, 0);
  cloudParts.push(summit);
  for (let i = 0; i < 15; i++) {
    const angle = i * Math.PI * 2 / 15;
    const shape = new THREE.SphereGeometry(1, 24, 12);
    shape.scale(.78 + Math.sin(i*3)*.12, .27, .66);
    shape.translate(Math.cos(angle)*1.75, -.25, Math.sin(angle)*1.15);
    cloudParts.push(shape);
  }
  const cloudGeometry = mergeGeometries(cloudParts);
  cloudParts.forEach(g => g.dispose());
  const bank = new THREE.Mesh(cloudGeometry, cloudMaterial);
  bank.receiveShadow = true;
  scene.add(bank);
  const starPositions = [];
  for (let i = 0; i < 95; i++) {
    const a = i * 2.39996, r = 15 + (i%7);
    starPositions.push(Math.cos(a)*r, 3+(i%17)*.5, Math.sin(a)*r);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#f9dfae", size: .045, sizeAttenuation: true })));

  let model: THREE.Object3D | null = null;
  let reference: THREE.Mesh | null = null;
  let referenceMode = false, paused = false;
  const atmosphere: THREE.Object3D[] = [];
  const nodes = new Map<string, THREE.Object3D>();
  const faceMeshes: THREE.Mesh[] = [];
  const bases = new Map<string, { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>();
  const outlineMaterials: THREE.MeshStandardMaterial[] = [];
  const woolTouches = new Map<THREE.Mesh, { point: { value: THREE.Vector3 }; amount: { value: number } }>();
  let touchedWool: THREE.Mesh | null = null;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  let disposed = false, unavailable = false, raf = 0, previous = 0, elapsed = 0, dirty = true;
  let gesture: CarolGesture = "touch", reactionUntil = 0, reactionStarted = 0, reactionStrength = 0, wasActive = false;
  let contactSide = 0, contactPart = "Head", lookX = 0, lookY = 0;
  let joy = 0, surprise = 0, lean = 0, compression = 0;
  let feedStarted = -Infinity, feedWasActive = false, feedHeartsShown = false, feedCount = 0, heartSequence = 0;
  let tailStartleSequence = 0, tailStartleToken = 0, tailStartleTimer: number | undefined;
  let tailStartleActive = false;
  const emotionAnchor = new THREE.Vector3();
  const emotionPage = host.parentElement;
  const feedTreat = createFeedTreat();
  feedTreat.visible = false;
  scene.add(feedTreat);
  const points = new Map<number, { x: number; y: number }>();
  let activeId: number | null = null, contact: CarolContact | null = null, tailContact = false;
  let orbit = false, pinching = false, pinchDistance = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const loadController = new AbortController();
  const loadTimeout = window.setTimeout(() => loadController.abort(), 20000);

  function disposeObject(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    object.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        geometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
      }
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => {
      Object.values(m).forEach(value => { if (value instanceof THREE.Texture) value.dispose(); });
      m.dispose();
    });
  }

  function createFeedTreat() {
    const treat = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: "#ff9fc1", roughness: .62, metalness: 0, toneMapped: false });
    const ruffle = new THREE.MeshStandardMaterial({ color: "#d85d90", roughness: .86, toneMapped: false });
    const cream = new THREE.MeshStandardMaterial({ color: "#fff1cb", roughness: .72, toneMapped: false });
    const top = new THREE.Mesh(new THREE.SphereGeometry(.38, 28, 18), shell);
    top.scale.set(1, .32, .22); top.position.y = .12;
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(.38, 28, 18), shell);
    bottom.scale.set(1, .32, .22); bottom.position.y = -.12;
    const filling = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .1, 28), cream);
    filling.rotation.x = Math.PI / 2;
    const topRuffle = new THREE.Mesh(new THREE.TorusGeometry(.31, .034, 7, 28), ruffle);
    topRuffle.rotation.x = Math.PI / 2; topRuffle.position.y = .057;
    const bottomRuffle = topRuffle.clone(); bottomRuffle.position.y = -.057;
    treat.add(top, bottom, filling, topRuffle, bottomRuffle);
    treat.scale.setScalar(.72);
    return treat;
  }

  async function load() {
    try {
      const response = await fetch("/grimo/carol-3d/carol.glb", { signal: loadController.signal });
      if (!response.ok) throw new Error("asset");
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
      if (disposed || unavailable) { disposeObject(gltf.scene); return; }
      model = gltf.scene.getObjectByName("Carol") ?? gltf.scene;
      gltf.scene.traverse(o => {
        nodes.set(o.name, o);
        bases.set(o.name, { position: o.position.clone(), rotation: o.rotation.clone(), scale: o.scale.clone() });
        if (o instanceof THREE.Mesh) {
          o.castShadow = true; o.receiveShadow = false;
          if (o.morphTargetDictionary?.Blink !== undefined && o.morphTargetInfluences) faceMeshes.push(o);
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          for (const material of materials) {
            if (material.name === "Carol • soft lavender contour" && material instanceof THREE.MeshStandardMaterial) outlineMaterials.push(material);
          }
          for (const material of materials) {
            material.toneMapped = false;
            if (material instanceof THREE.MeshBasicMaterial && material.map) {
              material.transparent = false;
              material.alphaTest = 0;
              material.alphaToCoverage = false;
              material.depthWrite = true;
            }
          }
          if (/Wool/.test(o.name) || /Wool/.test(o.parent?.name ?? "")) {
            const touch = { point: { value: new THREE.Vector3(99,99,99) }, amount: { value: 0 } };
            woolTouches.set(o, touch);
            // glTF shares the projection material. Each deformable surface needs
            // its own touch uniforms, including unlit painted wool primitives.
            const copies = materials.map(material => material.clone());
            o.material = Array.isArray(o.material) ? copies : copies[0];
            for (const material of copies) material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
              shader.uniforms.touchPoint = touch.point;
              shader.uniforms.touchAmount = touch.amount;
              shader.vertexShader = "uniform vec3 touchPoint; uniform float touchAmount;\n"+shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
                "#include <begin_vertex>\nfloat touchFalloff = exp(-dot(position-touchPoint,position-touchPoint)*12.0); transformed -= normal*touchAmount*touchFalloff;");
            };
          }
        }
        if (/^Atmosphere\d+$/.test(o.name)) atmosphere.push(o);
      });
      // The checked-in GLB predates the builder's corrected Tail pivot. Shift
      // its group to the fleece attachment while counter-shifting its children
      // so the painted tuft stays visually fixed; future generated GLBs use
      // that attachment pivot directly.
      const tail = nodes.get("Tail");
      if (tail) {
        const attachmentShift = 51*.007;
        tail.position.x += attachmentShift;
        tail.children.forEach(child => child.position.x -= attachmentShift);
        tail.updateMatrixWorld(true);
        bases.get("Tail")?.position.copy(tail.position);
        tail.children.forEach(child => bases.get(child.name)?.position.copy(child.position));
      }
      // Explicit comparison mode only: never part of the character or its GLB.
      const referenceMap = await new THREE.TextureLoader().loadAsync("/grimo/carol-transparent.png");
      referenceMap.colorSpace = THREE.SRGBColorSpace;
      if (disposed || unavailable) { referenceMap.dispose(); disposeObject(gltf.scene); return; }
      if (referenceMap) {
        reference = new THREE.Mesh(new THREE.PlaneGeometry(624*.007, 400*.007),
          new THREE.MeshBasicMaterial({ map: referenceMap, transparent: true, depthWrite: false, toneMapped: false }));
        reference.position.set((312-337)*.007, (394-200)*.007, 1.4);
        reference.visible = false;
        reference.name = "ReferenceComparisonOnly";
        scene.add(reference);
      }
      scene.add(gltf.scene);
      hooks.onReady();
      host.dataset.ready = "true";
      dirty = true;
    } catch {
      if (!disposed) hooks.onError("キャロルを読み込めませんでした。再読み込みしてお試しください。");
    } finally { window.clearTimeout(loadTimeout); }
  }
  void load();

  function clearTailStartle() {
    tailStartleToken += 1;
    tailStartleActive = false;
    if (tailStartleTimer !== undefined) {
      window.clearTimeout(tailStartleTimer);
      tailStartleTimer = undefined;
    }
    host.dataset.tailStartle = "false";
    hooks.onTailStartle(null);
  }

  function beginTailStartle() {
    tailStartleSequence += 1;
    const sequence = tailStartleSequence;
    const token = ++tailStartleToken;
    tailStartleActive = true;
    host.dataset.tailStartle = "true";
    hooks.onTailStartle(sequence);
    if (tailStartleTimer !== undefined) window.clearTimeout(tailStartleTimer);
    tailStartleTimer = window.setTimeout(() => {
      if (token !== tailStartleToken) return;
      tailStartleActive = false;
      tailStartleTimer = undefined;
      host.dataset.tailStartle = "false";
      hooks.onTailStartle(null);
    }, 1000);
  }

  function react(next: CarolGesture, strength = 1) {
    if (paused || referenceMode || feedWasActive) return;
    if (next === "tail") beginTailStartle();
    else if (tailStartleActive) clearTailStartle();
    gesture = next;
    reactionStrength = strength;
    reactionStarted = elapsed;
    reactionUntil = elapsed + (next === "tail" ? 1.65 : next === "poke" ? 1.35 : 2.1);
    dirty = true;
    host.dataset.reaction = next;
    host.dataset.part = contactPart;
    hooks.onReaction(next === "pet" ? "気持ちよさそうに目を細めた" : next === "hold" ? "そっと身体を預けている" : next === "poke" ? "目を丸くして、こちらを見た" : next === "tail" ? "尻尾に触れられて、びっくりして目をぎゅっと閉じた" : "こちらに気づいた");
  }

  function beginFeed() {
    if (paused || referenceMode || !model || feedWasActive) return;
    cancelContact();
    clearTailStartle();
    // Feeding owns the entire performance. No completed interaction may leave
    // a stale timer or deformation target behind to mix into this timeline.
    gesture = "touch"; reactionStrength = 0; reactionStarted = elapsed; reactionUntil = elapsed;
    contactSide = 0; contactPart = "Head"; lookX = 0; lookY = 0;
    joy = 0; surprise = 0; lean = 0; compression = 0;
    feedStarted = elapsed;
    feedWasActive = true;
    feedHeartsShown = false;
    feedCount += 1;
    host.dataset.feedCount = String(feedCount);
    feedTreat.visible = true;
    host.dataset.reaction = "feed";
    hooks.onFeedState(true);
    hooks.onFeedHearts(null);
    hooks.onReaction("マカロンを見つけて、口元へ顔を寄せた");
    dirty = true;
  }

  function hit(x: number, y: number) {
    if (!model || referenceMode) return null;
    const rect = host.getBoundingClientRect();
    pointer.set((x - rect.left)/rect.width*2-1, -(y-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer, camera);
    const result = raycaster.intersectObject(model, true).find(intersection => {
      let object: THREE.Object3D | null = intersection.object;
      while (object) { if (!object.visible) return false; object = object.parent; }
      return true;
    });
    if (!result) return null;
    let part = result.object;
    while (part.parent && !/^(Head|Body|Ear[LR]|Leg[LR](Front|Back)|Tail)$/.test(part.name)) part = part.parent;
    if (result.object instanceof THREE.Mesh && woolTouches.has(result.object)) {
      touchedWool = result.object;
      woolTouches.get(touchedWool)!.point.value.copy(touchedWool.worldToLocal(result.point.clone()));
    } else touchedWool = null;
    return { part: part.name, side: model.worldToLocal(result.point.clone()).x };
  }

  function cancelContact() {
    const captured = [...points.keys()];
    points.clear();
    contact = null; activeId = null; tailContact = false; orbit = false; pinching = false; touchedWool = null;
    host.dataset.contact = "false";
    for (const id of captured) if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
  }

  function down(event: PointerEvent) {
    if (event.button !== 0 || !model || unavailable || referenceMode || feedWasActive) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    host.setPointerCapture(event.pointerId);
    if (points.size > 1) {
      contact = null; activeId = null; pinching = true; orbit = false;
      host.dataset.contact = "false";
      const [a,b] = [...points.values()];
      pinchDistance = Math.hypot(a.x-b.x, a.y-b.y);
      return;
    }
    host.focus({ preventScroll: true });
    activeId = event.pointerId;
    const target = paused ? null : hit(event.clientX, event.clientY);
    orbit = !target;
    if (target) {
      contactSide = THREE.MathUtils.clamp(target.side, -1, 1);
      contactPart = target.part;
      host.dataset.contact = "true";
      if (target.part === "Tail") {
        tailContact = true;
        react("tail");
      } else {
        contact = beginCarolContact(event.clientX, event.clientY, performance.now());
        react("touch", .5);
      }
    }
  }

  function move(event: PointerEvent) {
    const rect = host.getBoundingClientRect();
    lookX = THREE.MathUtils.clamp((event.clientX-rect.left)/rect.width*2-1, -1, 1);
    lookY = THREE.MathUtils.clamp((event.clientY-rect.top)/rect.height*2-1, -1, 1);
    const old = points.get(event.pointerId);
    if (!old) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinching && points.size >= 2) {
      const [a,b] = [...points.values()];
      const nextDistance = Math.hypot(a.x-b.x, a.y-b.y);
      if (pinchDistance > 0) distance = THREE.MathUtils.clamp(distance * pinchDistance/Math.max(1, nextDistance), 4.2, 9.5);
      pinchDistance = nextDistance;
      dirty = true;
      return;
    }
    if (activeId !== event.pointerId) return;
    if (tailContact) return;
    if (orbit) {
      // Carol is a relief illustration, not a turntable model.  The tiny
      // parallax window makes depth tangible without exposing an invented back.
      yaw = THREE.MathUtils.clamp(yaw-(event.clientX-old.x)*.0022, -.12, .12);
      pitch = THREE.MathUtils.clamp(pitch+(event.clientY-old.y)*.0015, -.035, .035);
      dirty = true;
    } else if (contact) {
      const now = performance.now();
      contact = moveCarolContact(contact, event.clientX, event.clientY, now);
      const target = hit(event.clientX, event.clientY);
      if (!target) { contact = null; host.dataset.contact = "false"; return; }
      contactSide = THREE.MathUtils.clamp(target.side, -1, 1);
      contactPart = target.part;
      if (contact.gesture === "pet") react("pet");
    }
  }

  function up(event: PointerEvent) {
    if (event.pointerId === activeId && contact && event.type === "pointerup") {
      react(finishCarolContact(contact, performance.now()));
    }
    // Cancellation never creates a tap, and release never overwrites the last performance.
    if (event.pointerId === activeId) { activeId = null; contact = null; tailContact = false; orbit = false; }
    points.delete(event.pointerId);
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (points.size === 0) pinching = false;
    host.dataset.contact = "false";
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    distance = THREE.MathUtils.clamp(distance + Math.sign(event.deltaY)*.3, 4.2, 9.5);
    dirty = true;
  }

  function act(action: Action) {
    if (!model || unavailable || referenceMode) return;
    cancelContact();
    if (action === "front") { yaw = 0; pitch = 0; distance = 8.8; }
    else if (action === "zoomIn" || action === "zoomOut") distance = THREE.MathUtils.clamp(distance+(action === "zoomIn" ? -.6 : .6), 4.2, 9.5);
    else if (action === "left" || action === "right") yaw = THREE.MathUtils.clamp(yaw+(action === "left" ? -.06 : .06), -.12, .12);
    else if (action === "feed") beginFeed();
    else if (feedWasActive) return;
    else { contactSide = 0; contactPart = action === "tail" ? "Tail" : "Head"; react(action); }
    dirty = true;
  }

  function keydown(event: KeyboardEvent) {
    const actions: Record<string, Action> = { Enter: "poke", " ": "pet", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "zoomIn", ArrowDown: "zoomOut", Home: "front" };
    if (actions[event.key]) { event.preventDefault(); if (!event.repeat) act(actions[event.key]); }
  }

  function setReference(show: boolean) {
    if (!model || !reference || feedWasActive) return;
    cancelContact();
    clearTailStartle();
    referenceMode = show;
    reference.visible = show;
    model.visible = !show;
    for (const object of atmosphere) object.visible = !show;
    yaw = 0; pitch = 0; distance = 8.8;
    aim.x = 0;
    model.position.x = 0;
    reactionStarted = elapsed; reactionUntil = 0; reactionStrength = 0; joy = 0; surprise = 0; lean = 0; compression = 0;
    host.dataset.view = show ? "reference" : "3d";
    dirty = true;
  }

  function setOutlineColor(color: string) {
    // A native color input only supplies #RRGGBB.  Retaining this guard keeps
    // the renderer from accepting arbitrary CSS strings as Three.js colors.
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    outlineMaterials.forEach(material => material.color.set(color));
    host.dataset.outlineColor = color;
    dirty = true;
  }

  function updateEmotionAnchor() {
    if (!emotionPage || !tailStartleActive) return;
    const head = nodes.get("Head");
    if (!head) return;
    // Keep the mark attached to Carol's actual head instead of a viewport
    // percentage. The local lift leaves a little air above the fleece while
    // preserving the authored offset when the camera makes its small parallax.
    emotionAnchor.set(0, .58, 0);
    head.localToWorld(emotionAnchor);
    emotionAnchor.project(camera);
    const x = THREE.MathUtils.clamp((emotionAnchor.x * .5 + .5) * 100, 7, 93);
    const y = THREE.MathUtils.clamp((-emotionAnchor.y * .5 + .5) * 100, 10, 74);
    emotionPage.style.setProperty("--carol-emotion-x", `${x}%`);
    emotionPage.style.setProperty("--carol-emotion-y", `${y}%`);
  }

  function frame(now: number) {
    if (disposed || document.hidden || unavailable) return;
    const dt = paused || referenceMode ? 0 : Math.min((now-previous)/1000 || .016, .04);
    previous = now;
    elapsed += dt;
    if (contact && heldCarolGesture(contact, performance.now()) === "hold" && gesture !== "hold") react("hold");
    if (contact) reactionUntil = elapsed + .45;
    const feedAge = elapsed - feedStarted;
    const feeding = feedAge >= 0 && feedAge < 4.25;
    if (feedWasActive && !feeding) {
      feedWasActive = false;
      feedTreat.visible = false;
      hooks.onFeedState(false);
      hooks.onFeedHearts(null);
      hooks.onReaction("マカロンを食べ終え、しあわせそうに跳ねた");
    }
    const feedJoy = feeding ? THREE.MathUtils.smoothstep(feedAge, 2.02, 2.32) * (1 - THREE.MathUtils.smoothstep(feedAge, 3.7, 4.25)) : 0;
    const reactionActive = elapsed < reactionUntil;
    const active = reactionActive || feeding;
    if (active !== wasActive) { dirty = true; wasActive = active; }
    const weight = reactionActive ? THREE.MathUtils.clamp(reactionStrength * (reactionUntil-elapsed)*2.5, 0, 1) : 0;
    const smooth = paused || referenceMode ? 0 : reduced ? 1 : 1-Math.exp(-dt*9);
    joy += (((gesture === "pet" || gesture === "hold" ? weight : 0) + feedJoy)-joy)*smooth;
    surprise += (((gesture === "poke" || gesture === "tail") ? weight : 0)-surprise)*smooth;
    lean += (contactSide*weight-lean)*smooth;
    compression += ((gesture === "hold" ? weight : 0)-compression)*smooth;
    woolTouches.forEach((touch, mesh) => {
      const target = mesh === touchedWool && active ? (gesture === "hold" ? .075 : .03)*weight : 0;
      touch.amount.value += (target-touch.amount.value)*smooth;
    });
    if (model && !paused && !referenceMode) {
      applyCarolPerformance({ nodes, bases, faces: faceMeshes }, {
        time: elapsed, reduced, joy, surprise, lean, compression, lookX, lookY, contactPart, weight,
        gesture, feedAge: feeding ? feedAge : -1, reactionAge: elapsed-reactionStarted,
      });
      model.position.y = feeding && feedAge > 2.1 ? Math.max(0, Math.sin((feedAge-2.1)*Math.PI*2.5))*.075*feedJoy : 0;
      model.rotation.y = 0;
      // Clouds and stars retain their own nodes for future performances, but
      // presently inherit Carol's gentle emotional sway as companion layers.
      const ambient = nodes.get("CarolAtmosphere"), ambientBase = bases.get("CarolAtmosphere");
      if (ambient && ambientBase) {
        ambient.position.copy(ambientBase.position);
        ambient.rotation.set(ambientBase.rotation.x, ambientBase.rotation.y, ambientBase.rotation.z-lean*.018);
        ambient.position.y += (reduced ? 0 : Math.sin(elapsed*1.65)*.004) + compression*.012;
      }
      host.dataset.expression = joy > .7 ? "happy" : surprise > .5 ? "surprised" : "neutral";
      const validState = [joy, surprise, lean, compression, weight].every(Number.isFinite)
        && faceMeshes.every(face => Array.from(face.morphTargetInfluences ?? []).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      host.dataset.performance = validState ? "valid" : "invalid";
      host.dataset.feeding = String(feeding);
      const mouth = nodes.get("Mouth");
      if (mouth && feeding) {
        const mouthPosition = mouth.getWorldPosition(new THREE.Vector3());
        // The treat begins in the lower right of Carol's space, pauses where her gaze can find it,
        // then finishes at the authored Mouth pivot—not at a screen-relative approximation.
        const approach = THREE.MathUtils.smoothstep(feedAge, .05, .72);
        const start = mouthPosition.clone().add(new THREE.Vector3(2.55, -1.52, .55));
        const pause = mouthPosition.clone().add(new THREE.Vector3(.64, -.13, .32));
        const arrive = THREE.MathUtils.smoothstep(feedAge, .72, 1.06);
        feedTreat.position.copy(start.lerp(pause, approach).lerp(mouthPosition, arrive));
        feedTreat.rotation.set(0, 0, -.18 + approach*.22);
        const eaten = THREE.MathUtils.smoothstep(feedAge, 1.05, 2.02);
        feedTreat.scale.setScalar(.72*(1-eaten*.78));
        feedTreat.visible = eaten < .98;
        if (!feedHeartsShown && feedAge >= 2.08) {
          feedHeartsShown = true;
          heartSequence += 1;
          hooks.onFeedHearts(heartSequence);
        }
      }
    }
    aim.x += ((model?.position.x ?? 0)*.7-aim.x)*smooth;
    const halfHeight = Math.max(2.32, 2.12/aspect) * distance/8.8;
    camera.left = -halfHeight*aspect; camera.right = halfHeight*aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    const framedDistance = 9;
    camera.position.set(aim.x+Math.sin(yaw)*Math.cos(pitch)*framedDistance, aim.y+Math.sin(pitch)*framedDistance, Math.cos(yaw)*Math.cos(pitch)*framedDistance);
    camera.lookAt(aim);
    updateEmotionAnchor();
    host.dataset.cameraYaw = yaw.toFixed(3);
    host.dataset.cameraDistance = distance.toFixed(2);
    host.dataset.walking = "false";
    if ((!reduced && !paused) || dirty || active || feeding) {
      renderer.render(scene, camera);
      dirty = false;
      host.dataset.drawCalls = String(renderer.info.render.calls);
      host.dataset.triangles = String(renderer.info.render.triangles);
    }
    raf = requestAnimationFrame(frame);
  }

  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    aspect = width/height;
    renderer.setSize(width, height);
    dirty = true;
  });
  resize.observe(host);
  const visibility = () => {
    cancelContact();
    if (document.hidden) clearTailStartle();
    cancelAnimationFrame(raf);
    previous = 0;
    if (!document.hidden) { dirty = true; raf = requestAnimationFrame(frame); }
  };
  const changeMotion = () => { reduced = motion.matches; dirty = true; host.dataset.reducedMotion = String(reduced); };
  const contextLost = (event: Event) => {
    unavailable = true;
    host.dataset.ready = "false";
    event.preventDefault(); cancelContact(); clearTailStartle(); feedWasActive = false; feedTreat.visible = false;
    hooks.onFeedState(false); hooks.onFeedHearts(null); cancelAnimationFrame(raf);
    hooks.onError("3D表示が中断されました。再読み込みで戻れます。");
  };
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("lostpointercapture", up);
  host.addEventListener("wheel", wheel, { passive: false });
  host.addEventListener("keydown", keydown);
  window.addEventListener("blur", cancelContact);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", changeMotion);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  changeMotion();
  raf = requestAnimationFrame(frame);

  return { act, setReference, setOutlineColor, setPaused(pause) { if (feedWasActive) return; cancelContact(); clearTailStartle(); paused = pause; dirty = true; host.dataset.paused = String(pause); }, dispose() {
    disposed = true;
    loadController.abort(); window.clearTimeout(loadTimeout);
    cancelContact(); clearTailStartle(); hooks.onFeedHearts(null); cancelAnimationFrame(raf); resize.disconnect();
    host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", up);
    host.removeEventListener("lostpointercapture", up); host.removeEventListener("wheel", wheel);
    host.removeEventListener("keydown", keydown); window.removeEventListener("blur", cancelContact);
    document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", changeMotion);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    disposeObject(scene); renderer.dispose(); renderer.domElement.remove();
  } };
}
