// Comic-book renderer: scene → colour + normal targets → one post pass that inks
// outlines, posterises into cel bands, lays halftone / hatching, and misregisters
// the colour plates like a cheap print. Each realm swaps the "print style".
import * as THREE from 'three';
import { G } from './state.js';

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tNormal, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uTime;
uniform float uInk, uPoster, uHalftone, uHatch, uMisreg, uScan, uGrain, uDot, uGlitch, uFlash, uBreak, uVignette;
uniform vec3 uInkColor, uPaper, uShadowTint;

float lin(float d){ float z = d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear - z*(uFar-uNear)); }
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

void main(){
  vec2 px = 1.0/uRes;
  vec2 uv = vUv;
  // glitch tear (sci-fi realm / rift)
  if (uGlitch > 0.0) {
    float band = floor(uv.y*40.0 + floor(uTime*8.0)*3.1);
    float g = step(1.0 - uGlitch*0.08, rnd(vec2(band, floor(uTime*12.0))));
    uv.x += g * (rnd(vec2(band, uTime)) - 0.5) * 0.06;
  }
  float depth = texture2D(tDepth, uv).r;
  float ld = lin(depth);
  float far = clamp(ld / 90.0, 0.0, 1.0);
  // misregistered plates: stronger in the distance (Spider-Verse defocus)
  vec2 off = vec2(px.x, px.y*0.5) * uMisreg * (0.6 + far*3.0);
  vec3 col;
  col.r = texture2D(tColor, uv + off).r;
  col.g = texture2D(tColor, uv).g;
  col.b = texture2D(tColor, uv - off).b;
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2)); // render target is linear; work in display space
  col *= 1.12;
  float l0 = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l0), col, 1.3); // comic saturation

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // cel posterise (keep hue, band the value)
  float bands = 4.0;
  float pl = floor(lum * bands + 0.5) / bands;
  vec3 poster = col * (pl / max(lum, 0.001));
  col = mix(col, poster, uPoster);

  // halftone dots in the shadows
  float ang = 0.785;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 p = R * (gl_FragCoord.xy / uDot);
  vec2 cell = fract(p) - 0.5;
  float r = clamp((0.5 - lum) * 1.3, 0.0, 0.62);
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.02, length(cell));
  col = mix(col, uShadowTint, dotMask * uHalftone * 0.7);
  // Ben-Day tint dots in the lights (subtle)
  vec2 p2 = gl_FragCoord.xy / (uDot*0.7);
  float lightDot = 1.0 - smoothstep(0.18, 0.24, length(fract(p2) - 0.5));
  col += lightDot * uHalftone * 0.05 * smoothstep(0.55, 0.9, lum);

  // cross-hatching (storybook realms)
  float h1 = step(0.8, fract((gl_FragCoord.x + gl_FragCoord.y) / 5.0));
  float h2 = step(0.8, fract((gl_FragCoord.x - gl_FragCoord.y) / 5.0));
  float hatch = h1 * step(lum, 0.34) + h2 * step(lum, 0.18);
  col = mix(col, uShadowTint, clamp(hatch, 0.0, 1.0) * uHatch * 0.8);

  // ink lines: depth + normal discontinuities
  float e = 0.0;
  vec3 n0 = texture2D(tNormal, uv).rgb;
  float w = mix(1.6, 1.0, far);
  for (int i = 0; i < 4; i++) {
    vec2 o = (i==0) ? vec2(w,0.0) : (i==1) ? vec2(-w,0.0) : (i==2) ? vec2(0.0,w) : vec2(0.0,-w);
    float dd = lin(texture2D(tDepth, uv + o*px).r);
    e += clamp(abs(dd - ld) / (0.25 + ld*0.04) - 0.2, 0.0, 1.0);
    vec3 nn = texture2D(tNormal, uv + o*px).rgb;
    e += clamp(length(nn - n0) * 1.4 - 0.35, 0.0, 1.0);
  }
  float ink = clamp(e, 0.0, 1.0) * uInk * (1.0 - far*0.6);
  if (depth > 0.9999) ink = 0.0;
  col = mix(col, uInkColor, ink);

  // scanlines
  col *= 1.0 - uScan * 0.12 * step(0.5, fract(gl_FragCoord.y / 3.0));
  // paper grain
  float gr = rnd(floor(gl_FragCoord.xy / 2.0) + floor(uTime*8.0)) - 0.5;
  col += gr * uGrain;
  col = mix(col, col * uPaper, 0.12);
  // vignette
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc, vc) * uVignette * 0.6;
  // flash + initiative-break desaturated freeze
  float gray = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, vec3(gray) * vec3(1.05, 0.95, 0.85), uBreak * 0.75);
  col = mix(col, vec3(1.0, 0.97, 0.85), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;

export const STYLES = {
  default:  { ink: 1, poster: 0.55, halftone: 0.8, hatch: 0, misreg: 1.4, scan: 0, grain: 0.035, dot: 5, glitch: 0, vignette: 0.9, inkColor: 0x1a1020, paper: 0xfff4e0, shadowTint: 0x3a2850 },
  tavern:   { ink: 1, poster: 0.6, halftone: 0.9, hatch: 0.35, misreg: 1.2, scan: 0, grain: 0.04, dot: 5, glitch: 0, vignette: 1.2, inkColor: 0x1c0f08, paper: 0xffe8c0, shadowTint: 0x4a2418 },
  emberwood:{ ink: 1, poster: 0.5, halftone: 0.4, hatch: 0.8, misreg: 1.0, scan: 0, grain: 0.05, dot: 6, glitch: 0, vignette: 1.0, inkColor: 0x2a1408, paper: 0xfff0d0, shadowTint: 0x3a2a40 },
  neon:     { ink: 1, poster: 0.75, halftone: 1.0, hatch: 0, misreg: 2.4, scan: 0, grain: 0.03, dot: 6, glitch: 0, vignette: 0.8, inkColor: 0x0a0418, paper: 0xf8f0ff, shadowTint: 0x2a0a60 },
  asterion: { ink: 0.9, poster: 0.8, halftone: 0.35, hatch: 0, misreg: 1.0, scan: 1, grain: 0.03, dot: 4, glitch: 0.3, vignette: 1.3, inkColor: 0x02080c, paper: 0xe0f4ff, shadowTint: 0x082830 },
  rift:     { ink: 1, poster: 0.7, halftone: 0.8, hatch: 0.4, misreg: 3.0, scan: 0.4, grain: 0.05, dot: 5, glitch: 0.5, vignette: 1.1, inkColor: 0x100018, paper: 0xfff0ff, shadowTint: 0x401050 },
  loom:     { ink: 1, poster: 0.4, halftone: 0.6, hatch: 0.6, misreg: 2.0, scan: 0, grain: 0.04, dot: 7, glitch: 0.2, vignette: 0.7, inkColor: 0x181010, paper: 0xffffff, shadowTint: 0x503040 },
};

export class ComicRenderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.normalMat = new THREE.MeshNormalMaterial();
    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null },
        uRes: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 400 }, uTime: { value: 0 },
        uInk: { value: 1 }, uPoster: { value: 0.5 }, uHalftone: { value: 0.8 }, uHatch: { value: 0 }, uMisreg: { value: 1.5 },
        uScan: { value: 0 }, uGrain: { value: 0.03 }, uDot: { value: 5 }, uGlitch: { value: 0 }, uFlash: { value: 0 }, uBreak: { value: 0 }, uVignette: { value: 1 },
        uInkColor: { value: new THREE.Color() }, uPaper: { value: new THREE.Color() }, uShadowTint: { value: new THREE.Color() },
      },
    });
    this.quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post); quad.frustumCulled = false;
    this.quadScene.add(quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.flash = 0; this.breakAmt = 0; this.glitchBoost = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.setStyle('default');
  }
  resize() {
    const w = innerWidth, h = innerHeight, pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h);
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    if (this.rtColor) { this.rtColor.dispose(); this.rtNormal.dispose(); }
    const depthTex = new THREE.DepthTexture(W, H); depthTex.type = THREE.UnsignedIntType;
    this.rtColor = new THREE.WebGLRenderTarget(W, H, { depthTexture: depthTex, samples: 0 });
    this.rtNormal = new THREE.WebGLRenderTarget(W, H);
    this.post.uniforms.uRes.value.set(W, H);
    if (G.camera) { G.camera.aspect = w / h; G.camera.updateProjectionMatrix(); }
  }
  setStyle(name) {
    const s = STYLES[name] || STYLES.default; this.style = s;
    const u = this.post.uniforms;
    u.uInk.value = s.ink; u.uPoster.value = s.poster; u.uHalftone.value = s.halftone; u.uHatch.value = s.hatch;
    u.uMisreg.value = s.misreg; u.uScan.value = s.scan; u.uGrain.value = s.grain; u.uDot.value = s.dot; u.uGlitch.value = s.glitch; u.uVignette.value = s.vignette;
    u.uInkColor.value.setHex(s.inkColor); u.uPaper.value.setHex(s.paper); u.uShadowTint.value.setHex(s.shadowTint);
  }
  render(scene, camera, dt) {
    const r = this.renderer, u = this.post.uniforms;
    this.flash = Math.max(0, this.flash - dt * 4);
    const bTarget = G.inBreak ? 1 : 0; this.breakAmt += (bTarget - this.breakAmt) * Math.min(1, dt * 8);
    this.glitchBoost = Math.max(0, this.glitchBoost - dt * 2);
    if (!G.settings.postfx) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.rtColor); r.render(scene, camera);
    const bg = scene.background; scene.background = null;
    const fog = scene.fog; scene.fog = null;
    scene.overrideMaterial = this.normalMat;
    r.setClearColor(0x000000, 1);
    r.setRenderTarget(this.rtNormal); r.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    u.tColor.value = this.rtColor.texture; u.tNormal.value = this.rtNormal.texture; u.tDepth.value = this.rtColor.depthTexture;
    u.uNear.value = camera.near; u.uFar.value = camera.far; u.uTime.value = G.realTime;
    u.uFlash.value = this.flash; u.uBreak.value = this.breakAmt;
    u.uGlitch.value = this.style.glitch + this.glitchBoost;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}
