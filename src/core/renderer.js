// Painterly fantasy renderer: ACES tone mapping, soft shadows, bloom on magic and lamplight,
// and a gentle grade pass (warm/cool split toning, vignette). Each realm has its own light "mood".
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { G } from './state.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uShadow: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() }, uVignette: { value: 0.8 }, uSat: { value: 1.05 }, uFlash: { value: 0 }, uBreak: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 uShadow, uHigh; uniform float uVignette, uSat, uFlash, uBreak, uTime; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      // split toning: tint shadows and highlights separately
      float t = clamp(l * 1.4, 0.0, 1.0);
      c.rgb *= mix(uShadow, uHigh, t);
      vec2 v = vUv - 0.5; c.rgb *= 1.0 - dot(v, v) * uVignette;
      // Initiative Break: time freezes into a cold, desaturated tableau
      float g = dot(c.rgb, vec3(0.3, 0.59, 0.11));
      c.rgb = mix(c.rgb, vec3(g) * vec3(0.85, 0.92, 1.1), uBreak * 0.7);
      c.rgb += uFlash * vec3(1.0, 0.9, 0.7) * 0.35;
      gl_FragColor = c;
    }`,
};

export const STYLES = {
  default:  { exposure: 1.0, bloom: 0.45, threshold: 0.85, shadow: 0xe8e4ff, high: 0xfff4e4, sat: 1.05, vignette: 0.9 },
  tavern:   { exposure: 1.05, bloom: 0.7, threshold: 0.75, shadow: 0xd8c8f0, high: 0xfff0d8, sat: 1.08, vignette: 1.2 },
  emberwood:{ exposure: 1.05, bloom: 0.4, threshold: 0.85, shadow: 0xe0d8ff, high: 0xfff0d8, sat: 1.12, vignette: 0.8 },
  neon:     { exposure: 1.0, bloom: 0.75, threshold: 0.7, shadow: 0xc8c8ff, high: 0xfff0d0, sat: 1.05, vignette: 1.0 },
  asterion: { exposure: 1.0, bloom: 0.85, threshold: 0.65, shadow: 0xb8d0ff, high: 0xf0f8ff, sat: 0.98, vignette: 1.1 },
  rift:     { exposure: 1.0, bloom: 0.7, threshold: 0.7, shadow: 0xd8c0ff, high: 0xfff0f0, sat: 1.1, vignette: 1.0 },
  loom:     { exposure: 1.1, bloom: 0.9, threshold: 0.7, shadow: 0xf0e8ff, high: 0xffffff, sat: 0.95, vignette: 0.6 },
};

export class FantasyRenderer {
  constructor(container) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.flash = 0; this.breakAmt = 0;
    this.scene = null; this.camera = null;
    this.composer = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  build(scene, camera) {
    this.scene = scene; this.camera = camera;
    const c = this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(scene, camera); c.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.85); c.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader); c.addPass(this.grade);
    c.addPass(new OutputPass());
    this.setStyle('default');
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    if (G.camera) { G.camera.aspect = w / h; G.camera.updateProjectionMatrix(); }
  }
  setStyle(name) {
    const s = STYLES[name] || STYLES.default; this.style = s;
    this.renderer.toneMappingExposure = s.exposure;
    if (!this.bloom) return;
    this.bloom.strength = s.bloom; this.bloom.threshold = s.threshold;
    const u = this.grade.uniforms; u.uShadow.value.setHex(s.shadow); u.uHigh.value.setHex(s.high); u.uSat.value = s.sat; u.uVignette.value = s.vignette;
  }
  render(scene, camera, dt) {
    this.flash = Math.max(0, this.flash - dt * 3);
    this.breakAmt += ((G.inBreak ? 1 : 0) - this.breakAmt) * Math.min(1, dt * 6);
    if (!G.settings.postfx || !this.composer) { this.renderer.render(scene, camera); return; }
    const u = this.grade.uniforms; u.uFlash.value = Math.min(0.6, this.flash); u.uBreak.value = this.breakAmt; u.uTime.value = G.realTime;
    this.composer.render(dt);
  }
}
