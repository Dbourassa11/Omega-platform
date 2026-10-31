/**
 * @omega/cosmos-engine — WebGL renderer
 *
 * Framework-agnostic three.js engine for the Holographic Cosmos:
 * instanced nodes orbiting inside consent-ring shells around a central
 * Trust Beacon, over a procedural nebula, with bloom + film grain.
 *
 * There are no React (or any framework) imports here — the engine owns
 * a canvas inside the supplied container and exposes the small
 * imperative `CosmosEngine` surface from `types.ts`.
 *
 * Creator: David Charles Bourassa
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import type { RingType } from "@omega/consent-core";
import type {
  ActiveRing,
  CosmosData,
  CosmosEngine,
  CosmosEngineOptions,
  CosmosNode,
  CosmosNodeKind,
  CosmosEdgeKind,
} from "./types.js";
import { layoutCosmos, positionAt, RING_SHELL_RADIUS } from "./layout.js";
import { boundingSphereOfPoints, fitDistanceForRadius } from "./framing.js";
import type { Vec3 } from "./types.js";
import type { OrbitParams } from "./layout.js";
import { scaleLevelFor } from "./scale.js";
import type { ScaleLevelId } from "./scale.js";
import { edgeBrightness, nodeVisualState } from "./filter.js";
import { stellarPropertiesForNode, stellarVisuals } from "./stellar.js";
import { QualityController } from "./quality.js";
import type { QualityTier } from "./quality.js";
import { mulberry32 } from "./prng.js";
import {
  GRAIN_SHADER,
  NEBULA_FRAGMENT,
  NEBULA_VERTEX,
  NODE_FRAGMENT,
  NODE_VERTEX,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  SHELL_FRAGMENT,
  SHELL_VERTEX,
} from "./shaders.js";

/** Base colour per node kind (hex strings, converted via THREE.Color). */
export const NODE_KIND_COLORS: Record<CosmosNodeKind, string> = {
  member: "#ffd977",
  memory: "#f5f2e8",
  creation: "#ffb347",
  company: "#57d7ff",
  legacy: "#cfc4ff",
  connector: "#4fe3c1",
  galaxy: "#bcd8ff",
};

/** Base colour per edge kind, before ring dimming / highlight boost. */
export const EDGE_KIND_COLORS: Record<CosmosEdgeKind, string> = {
  relationship: "#8a7a3a",
  branch: "#4a5a8a",
  economic: "#2a8a5a",
};

/** Fresnel shell colour per consent ring. */
export const RING_SHELL_COLORS: Record<RingType, string> = {
  family: "#ffa07a",
  friends: "#ffd166",
  work: "#6ee7ff",
  public: "#b18cff",
};

const RING_ORDER: readonly RingType[] = ["family", "friends", "work", "public"];

/**
 * Fixed layout seed: the same dataset always produces the same cosmos,
 * so a member's universe does not reshuffle between visits.
 */
const LAYOUT_SEED = 1337;

/** Simulation time the cosmos starts at (and freezes at, reduced-motion). */
const SIM_TIME_START = 12;

/** Auto-framing clamps: never dolly inside 24 (inside the family shell's
 * neighbourhood the frame would clip nodes), and never beyond 860 —
 * the nebula backdrop is a BackSide sphere of radius 900, so the camera
 * must stay inside it with headroom. Datasets whose true fit exceeds
 * 860 (measured: universe / multiverse — see the framing report) are
 * framed at the cap rather than pushed through the backdrop. */
const FRAME_MIN_DISTANCE = 24;
const FRAME_MAX_DISTANCE = 860;
const FRAME_TWEEN_DURATION = 1.2;

/** Direction of the classic default camera position (0, 60, 150). */
function classicIntroDirection(): THREE.Vector3 {
  return new THREE.Vector3(0, 60, 150).normalize();
}

const MAX_PARTICLE_SOURCES = 240;
const PARTICLES_PER_SOURCE = 3;

type SelectCallback = (node: CosmosNode | null) => void;

interface FocusTween {
  nodeId: string;
  elapsed: number;
  duration: number;
  fromTarget: THREE.Vector3;
  fromCamera: THREE.Vector3;
}

function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 240, 190, 1)");
    gradient.addColorStop(0.25, "rgba(255, 207, 94, 0.55)");
    gradient.addColorStop(0.6, "rgba(255, 180, 60, 0.14)");
    gradient.addColorStop(1, "rgba(255, 180, 60, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCosmosEngine(
  container: HTMLElement,
  options: CosmosEngineOptions = {},
): CosmosEngine {
  const reducedMotion = options.reducedMotion ?? false;
  const quality = options.quality ?? "auto";
  const useComposer = quality !== "low" && (options.bloom ?? true);

  let disposed = false;

  /* ---------------- renderer / scene / camera ---------------- */

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  const pixelRatio =
    quality === "low"
      ? 1
      : quality === "high"
        ? Math.min(window.devicePixelRatio, 2)
        : Math.min(window.devicePixelRatio, 1.75);
  const basePixelRatio = pixelRatio;
  renderer.setPixelRatio(pixelRatio);

  /* Adaptive quality (quality:"auto" only): sustained slow frames step
   * the tier down (pixel ratio, then grain, then bloom); recovery needs
   * a much longer fast run, and never happens under reduced motion.
   * Explicit "high"/"low" settings pin quality — no auto stepping. */
  const qualityController =
    quality === "auto" ? new QualityController({ reducedMotion }) : null;
  let activeTier: QualityTier | null = qualityController?.tier ?? null;
  let composerAllowedByTier = true;

  function applyQualityTier(tier: QualityTier): void {
    activeTier = tier;
    renderer.setPixelRatio(
      Math.max(0.75, basePixelRatio * tier.pixelRatioScale),
    );
    composerAllowedByTier = tier.bloom;
    if (grainPass !== null) {
      grainPass.enabled = tier.grain;
    }
    if (particleMaterial !== null) {
      const uniform = particleMaterial.uniforms["uPixelRatio"];
      if (uniform !== undefined) {
        uniform.value = renderer.getPixelRatio();
      }
    }
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const initialWidth = Math.max(1, container.clientWidth);
  const initialHeight = Math.max(1, container.clientHeight);
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    initialWidth / initialHeight,
    0.1,
    5000,
  );
  camera.position.set(0, 60, 150);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.4;
  controls.minDistance = 8;
  controls.maxDistance = 1500;

  /* ---------------- background: nebula + starfield ---------------- */

  const nebulaUniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
  };
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(900, 40, 28),
    new THREE.ShaderMaterial({
      uniforms: nebulaUniforms,
      vertexShader: NEBULA_VERTEX,
      fragmentShader: NEBULA_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  nebula.frustumCulled = false;
  scene.add(nebula);

  const starCount = 2500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  {
    const rng = mulberry32(4242);
    const starPalette = [
      new THREE.Color("#ffffff"),
      new THREE.Color("#ffe9b0"),
      new THREE.Color("#bfefff"),
      new THREE.Color("#ffd977"),
    ];
    const dir = new THREE.Vector3();
    for (let i = 0; i < starCount; i++) {
      // Uniform random direction, shell radius 420..860 (inside nebula).
      const z = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      dir.set(r * Math.cos(theta), r * Math.sin(theta), z);
      const radius = 420 + rng() * 440;
      starPositions[i * 3] = dir.x * radius;
      starPositions[i * 3 + 1] = dir.y * radius;
      starPositions[i * 3 + 2] = dir.z * radius;
      const color = starPalette[Math.floor(rng() * starPalette.length)];
      const dim = 0.35 + rng() * 0.65;
      if (color !== undefined) {
        starColors[i * 3] = color.r * dim;
        starColors[i * 3 + 1] = color.g * dim;
        starColors[i * 3 + 2] = color.b * dim;
      }
    }
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 1.9,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  stars.frustumCulled = false;
  scene.add(stars);

  /* ---------------- consent-ring shells ---------------- */

  const shellsGroup = new THREE.Group();
  scene.add(shellsGroup);
  let shellsVisible = true;
  const shellMaterials = new Map<RingType, THREE.ShaderMaterial>();
  for (const ring of RING_ORDER) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(RING_SHELL_COLORS[ring]) },
        uIntensity: { value: 0.1 },
      },
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(RING_SHELL_RADIUS[ring], 56, 36),
      material,
    );
    shell.frustumCulled = false;
    shellsGroup.add(shell);
    shellMaterials.set(ring, material);
  }

  /* ---------------- Trust Beacon ---------------- */

  const beaconGroup = new THREE.Group();
  const beaconCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.6, 2),
    new THREE.MeshBasicMaterial({ color: "#ffcf5e" }),
  );
  beaconGroup.add(beaconCore);
  const beaconWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.6, 1)),
    new THREE.LineBasicMaterial({
      color: "#d4af37",
      transparent: true,
      opacity: 0.35,
    }),
  );
  beaconGroup.add(beaconWire);
  const glowTexture = makeGlowTexture();
  const beaconGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: "#ffcf5e",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  beaconGlow.scale.set(30, 30, 1);
  beaconGroup.add(beaconGlow);
  scene.add(beaconGroup);

  /* ---------------- post-processing ---------------- */

  let composer: EffectComposer | null = null;
  let grainPass: ShaderPass | null = null;
  if (useComposer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(initialWidth, initialHeight),
      1.1,
      0.6,
      0.15,
    );
    composer.addPass(bloomPass);
    grainPass = new ShaderPass(GRAIN_SHADER);
    composer.addPass(grainPass);
    composer.addPass(new OutputPass());
  }

  /* ---------------- dynamic dataset state ---------------- */

  let nodes: CosmosNode[] = [];
  let nodeById = new Map<string, CosmosNode>();
  let nodeIndexById = new Map<string, number>();
  let layout = new Map<string, OrbitParams>();
  let currentPositions = new Float32Array(0);
  let visualScales = new Float32Array(0);

  let nodeMesh: THREE.InstancedMesh | null = null;
  let nodeMaterial: THREE.ShaderMaterial | null = null;

  interface EdgeRuntime {
    sourceIndex: number;
    targetIndex: number;
    edge: CosmosData["edges"][number];
  }
  let edgeRuntime: EdgeRuntime[] = [];
  let edgeLines: THREE.LineSegments | null = null;
  let edgeGeometry: THREE.BufferGeometry | null = null;
  const edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  let particlePoints: THREE.Points | null = null;
  let particleGeometry: THREE.BufferGeometry | null = null;
  let particleMaterial: THREE.ShaderMaterial | null = null;
  let particleSources = new Int32Array(0);

  let filamentLines: THREE.LineSegments | null = null;
  let filamentGeometry: THREE.BufferGeometry | null = null;
  let filamentMaterial: THREE.LineBasicMaterial | null = null;

  let bubbleGroup: THREE.Group | null = null;
  let bubbleMaterials: THREE.ShaderMaterial[] = [];

  /** Engine-clock time (seconds) at which the current data was born with
   * a transition, or null when nodes should render at factor exactly 1. */
  let birthStart: number | null = null;
  let elapsedTime = 0;

  /** Frame computed by the most recent framing setData call, or null
   * when nothing has been framed yet (or the dataset was empty). */
  let currentFrame: { center: THREE.Vector3; distance: number } | null =
    null;

  let activeRing: ActiveRing = "all";
  let hoveredIndex: number | null = null;
  let selectedIndex: number | null = null;

  const selectCallbacks = new Set<SelectCallback>();
  const hoverCallbacks = new Set<SelectCallback>();

  function nodeAt(index: number | null): CosmosNode | null {
    if (index === null) {
      return null;
    }
    return nodes[index] ?? null;
  }

  function fireSelect(node: CosmosNode | null): void {
    for (const cb of selectCallbacks) {
      cb(node);
    }
  }

  function fireHover(node: CosmosNode | null): void {
    for (const cb of hoverCallbacks) {
      cb(node);
    }
  }

  function highlightValue(index: number): number {
    if (index === selectedIndex) {
      return 2;
    }
    if (index === hoveredIndex) {
      return 1;
    }
    return 0;
  }

  function refreshHighlights(): void {
    if (nodeMesh === null) {
      return;
    }
    const attr = nodeMesh.geometry.getAttribute("aHighlight");
    if (attr === undefined) {
      return;
    }
    const array = attr.array as Float32Array;
    for (let i = 0; i < nodes.length; i++) {
      array[i] = highlightValue(i);
    }
    attr.needsUpdate = true;
  }

  function recomputeEdgeColors(): void {
    if (edgeGeometry === null) {
      return;
    }
    const attr = edgeGeometry.getAttribute("color");
    if (attr === undefined) {
      return;
    }
    const array = attr.array as Float32Array;
    const base = new THREE.Color();
    for (let k = 0; k < edgeRuntime.length; k++) {
      const runtime = edgeRuntime[k];
      if (runtime === undefined) {
        continue;
      }
      base.set(EDGE_KIND_COLORS[runtime.edge.kind]);
      let factor = edgeBrightness(runtime.edge, nodeById, activeRing);
      if (
        runtime.sourceIndex === hoveredIndex ||
        runtime.targetIndex === hoveredIndex ||
        runtime.sourceIndex === selectedIndex ||
        runtime.targetIndex === selectedIndex
      ) {
        factor *= 2.4;
      }
      for (const endpoint of [0, 1]) {
        const offset = (k * 2 + endpoint) * 3;
        array[offset] = base.r * factor;
        array[offset + 1] = base.g * factor;
        array[offset + 2] = base.b * factor;
      }
    }
    attr.needsUpdate = true;
  }

  /** Re-derive per-node brightness + scale from the active ring. */
  function applyVisualState(): void {
    if (nodeMesh !== null) {
      const attr = nodeMesh.geometry.getAttribute("aData");
      if (attr !== undefined) {
        const array = attr.array as Float32Array;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node === undefined) {
            continue;
          }
          const state = nodeVisualState(node, activeRing);
          array[i * 3 + 2] = state.brightness;
          // Stellar physics (stellar.ts): member stars are scaled by
          // their stellar radius on top of the ring-dimming scale.
          // Neutral (1) for non-members and count-less members.
          visualScales[i] = state.scale * stellarVisuals(node).sizeScale;
        }
        attr.needsUpdate = true;
      }
    }
    for (const ring of RING_ORDER) {
      const material = shellMaterials.get(ring);
      if (material === undefined) {
        continue;
      }
      const intensity = material.uniforms["uIntensity"];
      if (intensity !== undefined) {
        intensity.value =
          activeRing !== "all" && ring === activeRing ? 0.32 : 0.1;
      }
    }
    recomputeEdgeColors();
  }

  /* ---------------- dataset construction ---------------- */

  function disposeDynamicObjects(): void {
    if (nodeMesh !== null) {
      scene.remove(nodeMesh);
      nodeMesh.geometry.dispose();
      nodeMesh.dispose();
      nodeMesh = null;
    }
    if (nodeMaterial !== null) {
      nodeMaterial.dispose();
      nodeMaterial = null;
    }
    if (edgeLines !== null) {
      scene.remove(edgeLines);
      edgeLines = null;
    }
    if (edgeGeometry !== null) {
      edgeGeometry.dispose();
      edgeGeometry = null;
    }
    if (particlePoints !== null) {
      scene.remove(particlePoints);
      particlePoints = null;
    }
    if (particleGeometry !== null) {
      particleGeometry.dispose();
      particleGeometry = null;
    }
    if (particleMaterial !== null) {
      particleMaterial.dispose();
      particleMaterial = null;
    }
    particleSources = new Int32Array(0);
    if (filamentLines !== null) {
      scene.remove(filamentLines);
      filamentLines = null;
    }
    if (filamentGeometry !== null) {
      filamentGeometry.dispose();
      filamentGeometry = null;
    }
    if (filamentMaterial !== null) {
      filamentMaterial.dispose();
      filamentMaterial = null;
    }
    if (bubbleGroup !== null) {
      scene.remove(bubbleGroup);
      bubbleGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
        }
      });
      bubbleGroup = null;
    }
    for (const material of bubbleMaterials) {
      material.dispose();
    }
    bubbleMaterials = [];
    birthStart = null;
  }

  function buildNodes(): void {
    const count = nodes.length;
    if (count === 0) {
      return;
    }
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const colors = new Float32Array(count * 3);
    const data = new Float32Array(count * 3);
    const highlights = new Float32Array(count);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (node === undefined) {
        continue;
      }
      color.set(node.color ?? NODE_KIND_COLORS[node.kind]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      // Pulse phase/speed come from the layout params, so pulsing is as
      // deterministic as the orbits themselves.
      const params = layout.get(node.id);
      data[i * 3] = params?.pulsePhase ?? 0;
      data[i * 3 + 1] = params?.pulseSpeed ?? 1;
      data[i * 3 + 2] = 1; // brightness — set by applyVisualState()
    }
    const stellarColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (node === undefined) {
        continue;
      }
      // Stellar physics (stellar.ts): a member star's instance colour
      // shifts toward its temperature colour (gold → blue-white with
      // density) and is scaled by its emissive intensity, all through
      // the existing aColor attribute path below.
      if (stellarPropertiesForNode(node) !== null) {
        const visuals = stellarVisuals(node);
        color.set(node.color ?? NODE_KIND_COLORS[node.kind]);
        stellarColor.set(visuals.colorHex);
        color.lerp(stellarColor, 0.85);
        colors[i * 3] = color.r * visuals.emissiveIntensity;
        colors[i * 3 + 1] = color.g * visuals.emissiveIntensity;
        colors[i * 3 + 2] = color.b * visuals.emissiveIntensity;
      }
    }
    const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    const dataAttr = new THREE.InstancedBufferAttribute(data, 3);
    dataAttr.setUsage(THREE.DynamicDrawUsage);
    const highlightAttr = new THREE.InstancedBufferAttribute(highlights, 1);
    highlightAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aColor", colorAttr);
    geometry.setAttribute("aData", dataAttr);
    geometry.setAttribute("aHighlight", highlightAttr);

    nodeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: SIM_TIME_START },
        uMotion: { value: reducedMotion ? 0 : 1 },
      },
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
    });
    nodeMesh = new THREE.InstancedMesh(geometry, nodeMaterial, count);
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodeMesh.frustumCulled = false;
    scene.add(nodeMesh);
  }

  function buildEdges(dataEdges: CosmosData["edges"]): void {
    edgeRuntime = [];
    for (const edge of dataEdges) {
      const sourceIndex = nodeIndexById.get(edge.source);
      const targetIndex = nodeIndexById.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined) {
        continue;
      }
      edgeRuntime.push({ sourceIndex, targetIndex, edge });
    }
    edgeGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(edgeRuntime.length * 2 * 3);
    const colors = new Float32Array(edgeRuntime.length * 2 * 3);
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    edgeGeometry.setAttribute("position", positionAttr);
    edgeGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.frustumCulled = false;
    scene.add(edgeLines);
  }

  function buildParticles(): void {
    const memberIndices: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]?.kind === "member") {
        memberIndices.push(i);
        if (memberIndices.length >= MAX_PARTICLE_SOURCES) {
          break;
        }
      }
    }
    const count = memberIndices.length * PARTICLES_PER_SOURCE;
    if (count === 0) {
      return;
    }
    const positions = new Float32Array(count * 3);
    const controlsArr = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    particleSources = new Int32Array(count);
    const rng = mulberry32(777);
    const memberColor = new THREE.Color(NODE_KIND_COLORS.member);
    const start = new THREE.Vector3();
    const perp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let p = 0;
    for (const sourceIndex of memberIndices) {
      const node = nodes[sourceIndex];
      if (node === undefined) {
        continue;
      }
      const params = layout.get(node.id);
      if (params === undefined) {
        continue;
      }
      const initial = positionAt(params, SIM_TIME_START);
      start.set(initial.x, initial.y, initial.z);
      // Stellar halo (stellar.ts): the member particle stream is the
      // engine's existing per-member glow rendering — it originates at
      // the star and arcs to the beacon. High-density (bright) stars
      // get a larger, brighter glow: point size scales by haloScale
      // (via the aScale attribute) and colour intensity by its root.
      // Neutral members keep haloScale 1 — exactly the old rendering.
      const haloScale = stellarVisuals(node).haloScale;
      const glowIntensity = Math.sqrt(haloScale);
      for (let j = 0; j < PARTICLES_PER_SOURCE; j++) {
        particleSources[p] = sourceIndex;
        positions[p * 3] = start.x;
        positions[p * 3 + 1] = start.y;
        positions[p * 3 + 2] = start.z;
        // Control point: halfway to the beacon, raised, with a small
        // deterministic sideways bow so the streams arc instead of
        // collapsing onto straight spokes.
        perp.crossVectors(start.clone().normalize(), up);
        if (perp.lengthSq() < 0.001) {
          perp.set(1, 0, 0);
        } else {
          perp.normalize();
        }
        const bow = (rng() - 0.5) * 7;
        controlsArr[p * 3] = start.x * 0.5 + perp.x * bow;
        controlsArr[p * 3 + 1] =
          start.y * 0.5 + Math.abs(start.length()) * 0.18 + perp.y * bow;
        controlsArr[p * 3 + 2] = start.z * 0.5 + perp.z * bow;
        offsets[p] = rng();
        const dim = 0.75 + rng() * 0.25;
        colors[p * 3] = memberColor.r * dim * glowIntensity;
        colors[p * 3 + 1] = memberColor.g * dim * glowIntensity;
        colors[p * 3 + 2] = memberColor.b * dim * glowIntensity;
        scales[p] = haloScale;
        p++;
      }
    }
    particleGeometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    particleGeometry.setAttribute("position", positionAttr);
    particleGeometry.setAttribute(
      "aCtrl",
      new THREE.BufferAttribute(controlsArr, 3),
    );
    particleGeometry.setAttribute(
      "aOffset",
      new THREE.BufferAttribute(offsets, 1),
    );
    particleGeometry.setAttribute(
      "aColor",
      new THREE.BufferAttribute(colors, 3),
    );
    particleGeometry.setAttribute(
      "aScale",
      new THREE.BufferAttribute(scales, 1),
    );
    particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    particlePoints.frustumCulled = false;
    scene.add(particlePoints);
  }

  function buildFilaments(data: CosmosData): void {
    if (data.filamentPaths === undefined || data.filamentPaths.length === 0) {
      return;
    }
    let segmentCount = 0;
    for (const path of data.filamentPaths) {
      segmentCount += Math.max(0, path.length - 1);
    }
    if (segmentCount === 0) {
      return;
    }
    const positions = new Float32Array(segmentCount * 2 * 3);
    let o = 0;
    for (const path of data.filamentPaths) {
      for (let s = 0; s + 1 < path.length; s++) {
        const a = path[s];
        const b = path[s + 1];
        if (a === undefined || b === undefined) continue;
        positions[o++] = a.x;
        positions[o++] = a.y;
        positions[o++] = a.z;
        positions[o++] = b.x;
        positions[o++] = b.y;
        positions[o++] = b.z;
      }
    }
    filamentGeometry = new THREE.BufferGeometry();
    filamentGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    filamentMaterial = new THREE.LineBasicMaterial({
      color: "#8fb7ff",
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    filamentLines = new THREE.LineSegments(filamentGeometry, filamentMaterial);
    filamentLines.frustumCulled = false;
    scene.add(filamentLines);
  }

  function buildBubbles(data: CosmosData): void {
    if (data.bubbles === undefined || data.bubbles.length === 0) {
      return;
    }
    bubbleGroup = new THREE.Group();
    for (const bubble of data.bubbles) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(bubble.color) },
          uIntensity: { value: 0.16 },
        },
        vertexShader: SHELL_VERTEX,
        fragmentShader: SHELL_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      bubbleMaterials.push(material);
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(bubble.radius, 48, 32),
        material,
      );
      shell.position.set(bubble.center.x, bubble.center.y, bubble.center.z);
      shell.frustumCulled = false;
      bubbleGroup.add(shell);
    }
    scene.add(bubbleGroup);
  }

  /** Compute the dataset's bounding sphere (node positions at the
   * current sim time, bubble extents, filament points), inflate it by
   * the largest node size, and derive the clamped fit distance. */
  function computeFrame(
    data: CosmosData,
  ): { center: THREE.Vector3; distance: number } | null {
    const points: Vec3[] = [];
    let maxNodeSize = 0;
    for (const node of nodes) {
      const params = layout.get(node.id);
      if (params === undefined) {
        continue;
      }
      points.push(positionAt(params, simTime));
      // Inflate by the RENDERED size: layout size × stellar sizeScale
      // (stellar.ts), so framing agrees with the instance scaling in
      // updateInstances / applyVisualState. Neutral nodes scale by 1.
      maxNodeSize = Math.max(
        maxNodeSize,
        params.size * stellarVisuals(node).sizeScale,
      );
    }
    if (data.bubbles !== undefined) {
      for (const bubble of data.bubbles) {
        // Centre ± radius along each axis: the sphere through these six
        // points encloses the whole bubble shell.
        for (const axis of ["x", "y", "z"] as const) {
          for (const sign of [1, -1] as const) {
            const point: Vec3 = { ...bubble.center };
            point[axis] += sign * bubble.radius;
            points.push(point);
          }
        }
      }
    }
    if (data.filamentPaths !== undefined) {
      for (const path of data.filamentPaths) {
        for (const point of path) {
          points.push(point);
        }
      }
    }
    const sphere = boundingSphereOfPoints(points);
    if (sphere === null) {
      return null;
    }
    const distance = Math.min(
      FRAME_MAX_DISTANCE,
      Math.max(
        FRAME_MIN_DISTANCE,
        fitDistanceForRadius(
          sphere.radius + maxNodeSize,
          camera.fov,
          camera.aspect,
        ),
      ),
    );
    return {
      center: new THREE.Vector3(sphere.center.x, sphere.center.y, sphere.center.z),
      distance,
    };
  }

  /** Move the camera onto a computed frame (see setData). */
  function applyFrame(frame: { center: THREE.Vector3; distance: number }): void {
    if (introTween !== null) {
      // Retarget the running cinematic: it lands on the framed view
      // instead of the classic default. The curve's earlier points
      // (the wide establishing sweep) are untouched.
      const end = frame.center
        .clone()
        .add(classicIntroDirection().multiplyScalar(frame.distance));
      const points = introTween.curve.points;
      points[points.length - 1] = end;
      introTween.toTarget = frame.center.clone();
      return;
    }
    if (reducedMotion) {
      const direction = camera.position.clone().sub(frame.center);
      if (direction.lengthSq() < 0.0001) {
        direction.copy(classicIntroDirection());
      } else {
        direction.normalize();
      }
      camera.position.copy(
        frame.center.clone().add(direction.multiplyScalar(frame.distance)),
      );
      controls.target.copy(frame.center);
      cameraTween = null;
      focusTween = null;
      return;
    }
    const direction = camera.position.clone().sub(frame.center);
    if (direction.lengthSq() < 0.0001) {
      direction.copy(classicIntroDirection());
    } else {
      direction.normalize();
    }
    cameraTween = {
      elapsed: 0,
      duration: FRAME_TWEEN_DURATION,
      fromTarget: controls.target.clone(),
      toTarget: frame.center.clone(),
      fromCamera: camera.position.clone(),
      toCamera: frame.center
        .clone()
        .add(direction.multiplyScalar(frame.distance)),
    };
    focusTween = null;
  }

  function setData(
    data: CosmosData,
    opts?: { transition?: boolean; frame?: boolean },
  ): void {
    if (disposed) {
      return;
    }
    const hadSelection = selectedIndex !== null;
    const hadHover = hoveredIndex !== null;
    disposeDynamicObjects();
    hoveredIndex = null;
    selectedIndex = null;

    nodes = data.nodes;
    nodeById = new Map(nodes.map((node) => [node.id, node]));
    nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]));
    layout = layoutCosmos(nodes, LAYOUT_SEED);
    currentPositions = new Float32Array(nodes.length * 3);
    visualScales = new Float32Array(nodes.length).fill(1);

    buildNodes();
    buildEdges(data.edges);
    buildParticles();
    buildFilaments(data);
    buildBubbles(data);
    if (particlePoints !== null) {
      particlePoints.visible = shellsVisible;
    }
    // Birth-shimmer transition: record the birth time; updateInstances
    // ramps each node's scale in with a deterministic stagger.
    birthStart = opts?.transition === true ? elapsedTime : null;
    applyVisualState();
    refreshHighlights();

    // Auto-framing (default on; opts.frame === false opts out entirely,
    // leaving both the camera and any stored frame untouched). An
    // empty dataset has no bounds: clear the stored frame and leave
    // the camera exactly where it is.
    if (opts?.frame !== false) {
      const frame = computeFrame(data);
      currentFrame = frame;
      if (frame !== null) {
        applyFrame(frame);
      }
    }

    if (hadSelection) {
      fireSelect(null);
    }
    if (hadHover) {
      fireHover(null);
    }
    canvas.style.cursor = "";
  }

  /* ---------------- picking ---------------- */

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerDirty = false;
  let downX = 0;
  let downY = 0;

  function setNdcFromEvent(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    pointerNdc.x = ((event.clientX - rect.left) / width) * 2 - 1;
    pointerNdc.y = -(((event.clientY - rect.top) / height) * 2 - 1);
  }

  function pickIndex(): number | null {
    if (nodeMesh === null || nodes.length === 0) {
      return null;
    }
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(nodeMesh);
    const hit = hits[0];
    if (hit === undefined || hit.instanceId === undefined) {
      return null;
    }
    return hit.instanceId;
  }

  function setHovered(index: number | null): void {
    if (index === hoveredIndex) {
      return;
    }
    hoveredIndex = index;
    refreshHighlights();
    recomputeEdgeColors();
    canvas.style.cursor = index !== null ? "pointer" : "";
    fireHover(nodeAt(index));
  }

  function setSelected(index: number | null): void {
    if (index === selectedIndex) {
      return;
    }
    selectedIndex = index;
    refreshHighlights();
    recomputeEdgeColors();
    fireSelect(nodeAt(index));
  }

  function onPointerMove(event: PointerEvent): void {
    setNdcFromEvent(event);
    pointerDirty = true;
  }

  function onPointerDown(event: PointerEvent): void {
    downX = event.clientX;
    downY = event.clientY;
    // Any pointerdown cancels the intro straight to its end state.
    if (introTween !== null) {
      finishIntro();
    }
  }

  function onPointerUp(event: PointerEvent): void {
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    if (dx * dx + dy * dy > 36) {
      return; // it was a drag, not a click
    }
    setNdcFromEvent(event);
    setSelected(pickIndex());
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);

  /* ---------------- focus tween ---------------- */

  let focusTween: FocusTween | null = null;

  function onControlsStart(): void {
    controls.autoRotate = false; // first interaction ends auto-rotate for good
    focusTween = null;
    cameraTween = null;
  }
  controls.addEventListener("start", onControlsStart);

  function focusNode(id: string): void {
    if (disposed) {
      return;
    }
    const index = nodeIndexById.get(id);
    if (index === undefined || !layout.has(id)) {
      return;
    }
    if (introTween !== null) {
      finishIntro();
    }
    cameraTween = null;
    focusTween = {
      nodeId: id,
      elapsed: 0,
      duration: 1.2,
      fromTarget: controls.target.clone(),
      fromCamera: camera.position.clone(),
    };
  }

  function stepFocusTween(dt: number): void {
    if (focusTween === null) {
      return;
    }
    const params = layout.get(focusTween.nodeId);
    const index = nodeIndexById.get(focusTween.nodeId);
    if (params === undefined || index === undefined) {
      focusTween = null;
      return;
    }
    focusTween.elapsed += dt;
    const raw = Math.min(1, focusTween.elapsed / focusTween.duration);
    const eased = raw * raw * (3 - 2 * raw); // smoothstep
    const pos = positionAt(params, simTime);
    const target = new THREE.Vector3(pos.x, pos.y, pos.z);
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0.45, 1);
    }
    direction.normalize();
    const distance = Math.max(10, params.size * 8);
    const desiredCamera = target.clone().add(direction.multiplyScalar(distance));
    controls.target.lerpVectors(focusTween.fromTarget, target, eased);
    camera.position.lerpVectors(focusTween.fromCamera, desiredCamera, eased);
    if (raw >= 1) {
      focusTween = null;
    }
  }

  /* ---------------- camera tweens: scale levels + intro ---------------- */

  function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  /**
   * The one internal camera tween: target + camera position lerped
   * with easeInOutCubic. Scale-level jumps (setScaleLevel, 1.6s) and
   * auto-framing moves (applyFrame, 1.2s) both run through it.
   */
  interface CameraTween {
    elapsed: number;
    duration: number;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromCamera: THREE.Vector3;
    toCamera: THREE.Vector3;
  }
  let cameraTween: CameraTween | null = null;

  function setScaleLevel(level: ScaleLevelId): void {
    if (disposed) {
      return;
    }
    if (introTween !== null) {
      finishIntro();
    }
    const distance = scaleLevelFor(level).distance;
    const target = controls.target.clone();
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0.38, 1);
    }
    direction.normalize();
    cameraTween = {
      elapsed: 0,
      duration: 1.6,
      fromTarget: target,
      toTarget: target.clone(),
      fromCamera: camera.position.clone(),
      toCamera: target.clone().add(direction.multiplyScalar(distance)),
    };
    focusTween = null;
  }

  function stepCameraTween(dt: number): void {
    if (cameraTween === null) {
      return;
    }
    cameraTween.elapsed += dt;
    const raw = Math.min(1, cameraTween.elapsed / cameraTween.duration);
    const eased = easeInOutCubic(raw);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
    camera.position.lerpVectors(cameraTween.fromCamera, cameraTween.toCamera, eased);
    if (raw >= 1) {
      cameraTween = null;
    }
  }

  interface IntroTween {
    elapsed: number;
    duration: number;
    curve: THREE.CatmullRomCurve3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  }
  let introTween: IntroTween | null = null;

  function finishIntro(): void {
    if (introTween === null) {
      return;
    }
    camera.position.copy(introTween.curve.getPoint(1));
    controls.target.copy(introTween.toTarget);
    introTween = null;
    controls.enabled = true;
    controls.autoRotate = !reducedMotion;
  }

  function playIntro(): void {
    if (disposed) {
      return;
    }
    if (reducedMotion) {
      // No animation under reduced motion: jump straight to the end
      // state — the stored frame when one exists, else the classic
      // default (0, 60, 150) / origin, exactly as before framing.
      introTween = null;
      controls.enabled = true;
      if (currentFrame !== null) {
        camera.position.copy(
          currentFrame.center
            .clone()
            .add(
              classicIntroDirection().multiplyScalar(currentFrame.distance),
            ),
        );
        controls.target.copy(currentFrame.center);
      } else {
        camera.position.set(0, 60, 150);
        controls.target.set(0, 0, 0);
      }
      return;
    }
    // With a stored frame the cinematic lands on the framed view;
    // without one the curve and target are exactly the classic ones.
    const endPoint =
      currentFrame !== null
        ? currentFrame.center
            .clone()
            .add(
              classicIntroDirection().multiplyScalar(currentFrame.distance),
            )
        : new THREE.Vector3(0, 60, 150);
    const endTarget =
      currentFrame !== null
        ? currentFrame.center.clone()
        : new THREE.Vector3(0, 0, 0);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 180, 640),
      new THREE.Vector3(260, 120, 380),
      new THREE.Vector3(60, 90, 190),
      endPoint,
    ]);
    introTween = {
      elapsed: 0,
      duration: 5.2,
      curve,
      fromTarget: controls.target.clone(),
      toTarget: endTarget,
    };
    cameraTween = null;
    focusTween = null;
    camera.position.copy(curve.getPoint(0));
    controls.enabled = false;
    controls.autoRotate = false;
  }

  function stepIntroTween(dt: number): void {
    if (introTween === null) {
      return;
    }
    introTween.elapsed += dt;
    const raw = Math.min(1, introTween.elapsed / introTween.duration);
    const eased = easeInOutCubic(raw);
    camera.position.copy(introTween.curve.getPoint(eased));
    controls.target.lerpVectors(introTween.fromTarget, introTween.toTarget, eased);
    if (raw >= 1) {
      finishIntro();
    }
  }

  /* ---------------- resize ---------------- */

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (composer !== null) {
      composer.setSize(width, height);
    }
    if (particleMaterial !== null) {
      const uniform = particleMaterial.uniforms["uPixelRatio"];
      if (uniform !== undefined) {
        uniform.value = renderer.getPixelRatio();
      }
    }
  });
  resizeObserver.observe(container);

  /* ---------------- animation loop ---------------- */

  const clock = new THREE.Clock();
  const dummy = new THREE.Object3D();
  let rafId = 0;
  let simTime = SIM_TIME_START;
  let flowTime = 0;
  let fps = 0;

  function updateInstances(): void {
    if (nodeMesh === null) {
      return;
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node === undefined) {
        continue;
      }
      const params = layout.get(node.id);
      if (params === undefined) {
        continue;
      }
      const pos = positionAt(params, simTime);
      currentPositions[i * 3] = pos.x;
      currentPositions[i * 3 + 1] = pos.y;
      currentPositions[i * 3 + 2] = pos.z;
      dummy.position.set(pos.x, pos.y, pos.z);
      const highlighted = i === hoveredIndex || i === selectedIndex;
      let birthFactor = 1;
      if (birthStart !== null) {
        const delay = (i % 97) * 0.012;
        const local = (elapsedTime - birthStart - delay) / 0.9;
        if (local <= 0) {
          birthFactor = 0;
        } else if (local >= 1) {
          birthFactor = 1;
        } else {
          const inv = 1 - local;
          birthFactor = 1 - inv * inv * inv; // easeOutCubic
        }
        if (elapsedTime - birthStart > 0.9 + 97 * 0.012) {
          birthStart = null;
          birthFactor = 1;
        }
      }
      const scale =
        params.size *
        (visualScales[i] ?? 1) *
        (highlighted ? 1.3 : 1) *
        birthFactor;
      dummy.scale.setScalar(scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
  }

  function updateEdges(): void {
    if (edgeGeometry === null) {
      return;
    }
    const attr = edgeGeometry.getAttribute("position");
    if (attr === undefined) {
      return;
    }
    const array = attr.array as Float32Array;
    for (let k = 0; k < edgeRuntime.length; k++) {
      const runtime = edgeRuntime[k];
      if (runtime === undefined) {
        continue;
      }
      const s = runtime.sourceIndex * 3;
      const t = runtime.targetIndex * 3;
      const o = k * 6;
      array[o] = currentPositions[s] ?? 0;
      array[o + 1] = currentPositions[s + 1] ?? 0;
      array[o + 2] = currentPositions[s + 2] ?? 0;
      array[o + 3] = currentPositions[t] ?? 0;
      array[o + 4] = currentPositions[t + 1] ?? 0;
      array[o + 5] = currentPositions[t + 2] ?? 0;
    }
    attr.needsUpdate = true;
  }

  function updateParticles(): void {
    if (particleGeometry === null) {
      return;
    }
    const attr = particleGeometry.getAttribute("position");
    if (attr === undefined) {
      return;
    }
    const array = attr.array as Float32Array;
    for (let p = 0; p < particleSources.length; p++) {
      const source = particleSources[p];
      if (source === undefined) {
        continue;
      }
      const s = source * 3;
      array[p * 3] = currentPositions[s] ?? 0;
      array[p * 3 + 1] = currentPositions[s + 1] ?? 0;
      array[p * 3 + 2] = currentPositions[s + 2] ?? 0;
    }
    attr.needsUpdate = true;
    if (particleMaterial !== null) {
      const uniform = particleMaterial.uniforms["uTime"];
      if (uniform !== undefined) {
        uniform.value = flowTime;
      }
    }
  }

  function tick(): void {
    if (disposed) {
      return;
    }
    rafId = window.requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsedTime += dt;
    if (dt > 0) {
      fps = fps === 0 ? 1 / dt : fps + (1 / dt - fps) * 0.05;
    }
    if (qualityController !== null && dt > 0) {
      const step = qualityController.push(dt * 1000);
      if (step.changed) {
        applyQualityTier(step.tier);
      }
    }
    if (!reducedMotion) {
      simTime += dt;
      flowTime += dt;
    }

    if (pointerDirty) {
      pointerDirty = false;
      setHovered(pickIndex());
    }

    stepFocusTween(dt);
    stepCameraTween(dt);
    stepIntroTween(dt);
    updateInstances();
    updateEdges();
    updateParticles();

    if (nodeMaterial !== null) {
      const uniform = nodeMaterial.uniforms["uTime"];
      if (uniform !== undefined) {
        uniform.value = simTime;
      }
    }
    const nebulaTime = nebulaUniforms["uTime"];
    if (nebulaTime !== undefined) {
      nebulaTime.value = flowTime;
    }

    const spin = reducedMotion ? 0 : dt;
    beaconCore.rotation.y += spin * 0.35;
    beaconCore.rotation.x += spin * 0.12;
    beaconWire.rotation.y -= spin * 0.22;
    beaconWire.rotation.z += spin * 0.1;

    controls.update();

    if (composer !== null && composerAllowedByTier) {
      if (grainPass !== null) {
        const uniform = grainPass.uniforms["uTime"];
        if (uniform !== undefined) {
          uniform.value = flowTime;
        }
      }
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
  rafId = window.requestAnimationFrame(tick);

  /* ---------------- public API ---------------- */

  function setActiveRing(ring: ActiveRing): void {
    if (disposed) {
      return;
    }
    activeRing = ring;
    applyVisualState();
  }

  function setShellsVisible(visible: boolean): void {
    if (disposed) {
      return;
    }
    shellsVisible = visible;
    shellsGroup.visible = visible;
    if (particlePoints !== null) {
      particlePoints.visible = visible;
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    window.cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    controls.removeEventListener("start", onControlsStart);
    controls.dispose();

    disposeDynamicObjects();
    edgeMaterial.dispose();

    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments ||
        object instanceof THREE.Points ||
        object instanceof THREE.Sprite
      ) {
        // Sprites share one module-level geometry inside three — never
        // dispose that; only their materials are ours.
        if (!(object instanceof THREE.Sprite)) {
          object.geometry.dispose();
        }
        const material = object.material;
        if (Array.isArray(material)) {
          for (const entry of material) {
            entry.dispose();
          }
        } else {
          material.dispose();
        }
      }
    });
    glowTexture.dispose();
    scene.clear();

    if (composer !== null) {
      for (const pass of composer.passes) {
        pass.dispose();
      }
      composer.dispose();
      composer = null;
    }
    renderer.dispose();
    if (canvas.parentElement === container) {
      container.removeChild(canvas);
    }
    selectCallbacks.clear();
    hoverCallbacks.clear();
  }

  if (options.intro === true) {
    playIntro();
  }

  return {
    setData,
    setActiveRing,
    setShellsVisible,
    setScaleLevel,
    playIntro,
    onNodeSelect(cb: SelectCallback): () => void {
      selectCallbacks.add(cb);
      return () => {
        selectCallbacks.delete(cb);
      };
    },
    onNodeHover(cb: SelectCallback): () => void {
      hoverCallbacks.add(cb);
      return () => {
        hoverCallbacks.delete(cb);
      };
    },
    focusNode,
    getStats(): { fps: number; nodeCount: number; qualityTier?: QualityTier["id"] } {
      return {
        fps,
        nodeCount: nodes.length,
        ...(activeTier !== null ? { qualityTier: activeTier.id } : {}),
      };
    },
    dispose,
  };
}
