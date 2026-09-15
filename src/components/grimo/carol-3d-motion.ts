import type * as THREE from "three";

/** Stable authoring boundary: these names are exported by the Carol builder.
 * Add performances here; pointer recognition and renderer ownership stay outside.
 */
export const CAROL_MORPHS = ["Blink", "Smile", "Surprise", "Squint", "LookLeft", "LookRight", "LookUp", "LookDown"] as const;
type Rig = {
  nodes: Map<string, THREE.Object3D>;
  bases: Map<string, { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>;
  faces: THREE.Mesh[];
};
type Performance = {
  time: number; reduced: boolean; joy: number; surprise: number; lean: number;
  compression: number; lookX: number; lookY: number; contactPart: string; weight: number;
  gesture: string; feedAge: number; reactionAge: number;
};

export function rotateCarolPart(rig: Rig, name: string, x = 0, y = 0, z = 0) {
  const node = rig.nodes.get(name), base = rig.bases.get(name);
  if (node && base) node.rotation.set(base.rotation.x+x, base.rotation.y+y, base.rotation.z+z);
}

function moveCarolPart(rig: Rig, name: string, x = 0, y = 0, z = 0) {
  const node = rig.nodes.get(name), base = rig.bases.get(name);
  if (node && base) node.position.set(base.position.x+x, base.position.y+y, base.position.z+z);
}

function scaleCarolPart(rig: Rig, name: string, x = 1, y = 1, z = 1) {
  const node = rig.nodes.get(name), base = rig.bases.get(name);
  if (node && base) node.scale.set(base.scale.x*x, base.scale.y*y, base.scale.z*z);
}

export function clampCarolUnit(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function applyCarolPerformance(rig: Rig, p: Performance) {
  const { time: t, reduced, lookX, lookY, weight, contactPart, gesture, feedAge, reactionAge } = p;
  const joy = clampCarolUnit(p.joy);
  const surprise = clampCarolUnit(p.surprise);
  const lean = Number.isFinite(p.lean) ? p.lean : 0;
  const compression = clampCarolUnit(p.compression);
  const feeding = feedAge >= 0;
  const reachesTreat = feeding && feedAge < 1.04 ? Math.min(1, Math.max(0, (feedAge-.28)/.5)) : 0;
  const chewing = feeding && feedAge >= 1.04 && feedAge < 1.5 ? Math.sin((feedAge-1.04)*Math.PI*8)*.028 : 0;
  // This is an authored, isolated startle: the rooted tail first tucks, then
  // snaps sideways, while Carol's body recoils and ears flare.
  const tailStartle = gesture === "tail" ? clampCarolUnit(weight) : 0;
  const tailPhase = Number.isFinite(reactionAge) ? Math.max(0, reactionAge) : 0;
  const bell = (start: number, end: number) => {
    const progress = Math.min(1, Math.max(0, (tailPhase-start)/(end-start)));
    return Math.sin(progress*Math.PI);
  };
  const tailTuck = tailStartle * bell(.02, .30);
  const tailSnap = tailStartle * bell(.16, .62);
  const bodyRecoil = tailStartle * bell(.06, .52);
  const smoothstep = (value: number, start: number, end: number) => {
    const progress = Math.min(1, Math.max(0, (value-start)/(end-start)));
    return progress*progress*(3-2*progress);
  };
  // Tail contact is a quick, readable startle: close immediately, hold the
  // expression for a beat, then let the eyes reopen before the tail settles.
  // Reduced motion keeps the semantic closed-eye state without adding a new
  // animated facial performance.
  const tailBlink = tailStartle * (reduced ? 1 :
    smoothstep(tailPhase, .04, .12) * (1-smoothstep(tailPhase, .42, .82)));
  moveCarolPart(rig, "Body", reduced ? 0 : bodyRecoil*.032, 0, 0);
  rotateCarolPart(rig, "Head", reduced ? 0 : Math.sin(t*1.7)*.008+compression*.045-surprise*.045+lookY*.012 + reachesTreat*.12 + chewing,
    reduced ? 0 : lookX*.025, reduced ? 0 : -lean*.065+joy*.022*Math.sin(t*2.7));
  rotateCarolPart(rig, "Body", reduced ? 0 : bodyRecoil*.035, 0, reduced ? 0 : -lean*.025-bodyRecoil*.026);
  scaleCarolPart(rig, "Body", 1+compression*.025-bodyRecoil*.012, 1-compression*.04+(reduced ? 0 : Math.sin(t*1.65)*.004)-bodyRecoil*.018, 1+compression*.018);
  for (const [name, sign] of [["EarL", -1], ["EarR", 1]] as const) {
    const localTouch = contactPart === name ? weight*.22 : 0;
    rotateCarolPart(rig, name, reduced ? 0 : Math.sin(t*2.4+sign)*.025+joy*.09,
      0, reduced ? 0 : sign*(surprise*.23+tailStartle*.16-joy*.13+localTouch+Math.sin(t*1.8)*.015));
  }
  const cycle = t%4.9;
  const blink = reduced ? 0 : cycle > 4.55 ? Math.sin((cycle-4.55)/.35*Math.PI)**2 : 0;
  // Actual continuous eyelid/cheek morphs; legacy empty Eye nodes are not swapped.
  const morphValues = {
    Blink: Math.max(blink,Math.min(1,joy/.85),tailBlink), Smile: joy*.85, Surprise: surprise*.68, Squint: feeding && feedAge > 1.1 ? .22 : 0,
    LookLeft: Math.max(0,-lookX)*(1-joy), LookRight: Math.max(0,lookX)*(1-joy),
    LookUp: Math.max(0,-lookY)*(1-joy), LookDown: Math.max(0,lookY)*(1-joy),
  };
  for (const face of rig.faces) {
    const dict = face.morphTargetDictionary, weights = face.morphTargetInfluences;
    if (!dict || !weights) continue;
    for (const name of CAROL_MORPHS) if (dict[name] !== undefined) weights[dict[name]] = clampCarolUnit(morphValues[name]);
  }
  // The tail leads the emotion then settles after the body: a pleased stroke
  // makes a soft wag, a poke gives a quick startled flick, and a gentle press
  // curls it in close.  It remains nearly still when reduced motion is requested.
  const tailFlick = surprise * Math.sin(t * 10.5) * Math.exp(-Math.max(0, t % 1.35 - .42) * 4);
  const tailWag = joy * Math.sin(t * 6.1) + (gesture === "touch" ? weight * Math.sin(t * 4.2) * .18 : 0);
  rotateCarolPart(rig, "Tail",
    reduced ? 0 : -.045 + tailWag * .16 + tailFlick * .11 - compression * .08 + tailTuck*.17-tailSnap*.15,
    0,
    reduced ? 0 : .035 + tailWag * .22 + tailFlick * .28 + lean * .045 + tailTuck*.30-tailSnap*.72);
  scaleCarolPart(rig, "Tail", 1 + (joy + compression) * .025, 1 - compression * .035, 1 + joy * .04);
}
