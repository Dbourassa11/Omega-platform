/**
 * @omega/cosmos-engine — shaders
 *
 * All GLSL for the Step 4 WebGL renderer, kept as plain string exports so
 * the module stays framework-agnostic and unit-testable without a GL
 * context. Materials are assembled in `renderer.ts`.
 *
 * Creator: David Charles Bourassa
 */

/* ------------------------------------------------------------------ */
/* Shared GLSL chunks                                                  */
/* ------------------------------------------------------------------ */

/**
 * Hash / value-noise / fbm chunk shared by the nebula fragment shader.
 * Value noise with smooth interpolation, summed over several octaves.
 */
export const GLSL_NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int octave = 0; octave < 5; octave++) {
    sum += amp * valueNoise(p * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
`;

/** Cheap deterministic 2D hash used for animated film grain. */
export const GLSL_HASH_2D = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/* ------------------------------------------------------------------ */
/* Nebula sky-sphere                                                   */
/* ------------------------------------------------------------------ */

export const NEBULA_VERTEX = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const NEBULA_FRAGMENT = /* glsl */ `
uniform float uTime;

varying vec3 vDir;

${GLSL_NOISE}

void main() {
  vec3 dir = normalize(vDir);

  // Slow drift so the nebula feels alive without ever distracting.
  float drift = uTime * 0.008;
  vec3 p = dir * 2.6 + vec3(drift, drift * 0.6, -drift * 0.4);

  float clouds = fbm(p);
  float wisps = fbm(p * 2.4 - vec3(0.0, drift * 0.7, drift));
  float density = pow(smoothstep(0.42, 0.92, clouds * 0.72 + wisps * 0.38), 1.6);

  vec3 deepBlack = vec3(0.004, 0.004, 0.010);
  vec3 gold = vec3(0.831, 0.686, 0.216); // #d4af37
  vec3 teal = vec3(0.05, 0.32, 0.34);

  // Gold carries the main wisps; teal only ghosts through the thinner
  // edges of the same density field so the two never compete.
  vec3 color = deepBlack;
  color += gold * density * 0.42;
  color += teal * pow(density, 3.0) * (1.0 - density) * 0.9;
  color += gold * pow(wisps, 6.0) * 0.18;

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Instanced nodes                                                     */
/* ------------------------------------------------------------------ */

/**
 * Node shaders for an `InstancedMesh`.
 *
 * Per-instance attributes (installed on the geometry by the renderer):
 * - `aColor` (vec3)     — base colour for the node's kind
 * - `aData` (vec3)      — x: pulse phase, y: pulse speed, z: brightness
 * - `aHighlight` (float) — 0 = none, 1 = hovered, 2 = selected
 *
 * `instanceMatrix` is deliberately NOT declared here: three injects it
 * into the shader prefix whenever the material renders an InstancedMesh.
 */
export const NODE_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute vec3 aData;
attribute float aHighlight;

uniform float uTime;
uniform float uMotion;

varying vec3 vColor;
varying float vBrightness;
varying float vHighlight;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vColor = aColor;
  vHighlight = aHighlight;

  float pulsePhase = aData.x;
  float pulseSpeed = aData.y;
  float brightness = aData.z;
  float pulse = 1.0 + 0.18 * sin(uTime * pulseSpeed + pulsePhase) * uMotion;
  vBrightness = brightness * pulse;

  vec3 instanceNormal = mat3(instanceMatrix) * normal;
  vNormal = normalize(normalMatrix * instanceNormal);

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const NODE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vBrightness;
varying float vHighlight;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float fresnel = pow(1.0 - abs(dot(n, v)), 2.0);

  vec3 color = vColor * vBrightness * (0.75 + 0.65 * fresnel);

  // Highlight: hover (1) lifts brightness; selection (2) lifts it
  // further and mixes a little white in so the chosen node reads as lit
  // from inside rather than merely bigger.
  float boost = 0.0;
  float whiteMix = 0.0;
  if (vHighlight > 1.5) {
    boost = 0.55;
    whiteMix = 0.28;
  } else if (vHighlight > 0.5) {
    boost = 0.30;
    whiteMix = 0.12;
  }
  color = color * (1.0 + boost) + vColor * fresnel * boost;
  color = mix(color, vec3(1.0), whiteMix * (0.35 + 0.65 * fresnel));

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Consent-ring shells                                                 */
/* ------------------------------------------------------------------ */

export const SHELL_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SHELL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float alpha = pow(1.0 - abs(dot(n, v)), 3.0) * uIntensity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* Beacon particle flow (member nodes -> Trust Beacon at origin)       */
/* ------------------------------------------------------------------ */

/**
 * Particle shaders for `THREE.Points`.
 *
 * Per-particle attributes:
 * - `position` (vec3) — quadratic-bezier start point; the renderer
 *   re-writes this every frame with the source node's live position.
 * - `aCtrl` (vec3)    — bezier control point (fixed at build time)
 * - `aOffset` (float) — phase offset in [0, 1)
 * - `aColor` (vec3)   — particle colour
 * - `aScale` (float)  — point-size multiplier: the source member star's
 *   stellar haloScale (stellar.ts); 1 for neutral members, larger for
 *   dense, bright stars so their glow reads bigger around the star.
 *
 * The curve ends at the world origin, the Trust Beacon.
 */
export const PARTICLE_VERTEX = /* glsl */ `
attribute vec3 aCtrl;
attribute float aOffset;
attribute vec3 aColor;
attribute float aScale;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vT;

void main() {
  float t = fract(aOffset + uTime * 0.05 * (0.7 + aOffset * 0.6));
  vT = t;
  vColor = aColor;

  vec3 endPoint = vec3(0.0, 0.0, 0.0);
  float invT = 1.0 - t;
  vec3 pos = invT * invT * position
    + 2.0 * invT * t * aCtrl
    + t * t * endPoint;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float swell = 0.7 + 0.6 * sin(3.14159265 * t);
  gl_PointSize = 3.4 * swell * aScale * uPixelRatio * (120.0 / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vT;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  float disc = smoothstep(0.5, 0.05, dist);
  float alpha = sin(3.14159265 * vT) * 0.85 * disc;
  if (alpha < 0.003) {
    discard;
  }
  gl_FragColor = vec4(vColor, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* Film grain + vignette post pass (ShaderPass-compatible)             */
/* ------------------------------------------------------------------ */

export const GRAIN_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GRAIN_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAmount;

varying vec2 vUv;

${GLSL_HASH_2D}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);

  // Animated grain: the hash input scrolls with time so the noise never
  // sits still long enough to look like dirt on the lens.
  float grain = hash21(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 371.0) - 0.5;
  color.rgb += grain * uAmount;

  // Vignette: gentle darkening towards the corners.
  vec2 centred = vUv - 0.5;
  float vignette = smoothstep(0.95, 0.35, length(centred) * 1.35);
  color.rgb *= mix(0.72, 1.0, vignette);

  gl_FragColor = color;
}
`;

/**
 * Shader object in the exact shape `ShaderPass` expects: a `uniforms`
 * map of `{ value }` entries plus vertex/fragment sources. `ShaderPass`
 * clones the uniforms on construction, so this object stays pristine.
 */
export const GRAIN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.035 },
  },
  vertexShader: GRAIN_VERTEX,
  fragmentShader: GRAIN_FRAGMENT,
};
