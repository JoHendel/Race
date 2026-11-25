import * as THREE from "three";
import { DEFAULT_ENVIRONMENT, type TrackEnvironment } from "@apex/shared";

/**
 * Sky dome with gradient and horizon glow, optionally a neon sun or animated aurora curtains.
 * Call `group.userData.update(dt)` every frame to animate the aurora.
 */
export function createSky(env: TrackEnvironment = DEFAULT_ENVIRONMENT): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(env.sky.top) },
      mid: { value: new THREE.Color(env.sky.mid) },
      horizon: { value: new THREE.Color(env.sky.horizon) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vPos;
      void main(){ float h = max(vPos.y, 0.0);
        vec3 c = mix(horizon * 0.55, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.6, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat));

  if (env.sun !== null) {
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64),
      new THREE.MeshBasicMaterial({ color: env.sun, fog: false, transparent: true, opacity: 0.85 }),
    );
    sun.position.set(0, 40, 480);
    sun.lookAt(0, 0, 0);
    group.add(sun);
  }

  const timeUniforms: { value: number }[] = [];
  if (env.aurora) {
    // Three wavy curtains of light high above the horizon
    const curtains: [number, number, number, number][] = [
      // radius, height, rotation, phase
      [430, 150, 0.3, 0],
      [400, 120, 2.4, 1.7],
      [450, 170, 4.3, 3.1],
    ];
    for (const [radius, height, rot, phase] of curtains) {
      const time = { value: phase };
      timeUniforms.push(time);
      const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true, 0, Math.PI * 0.9);
      const aurora = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
          uniforms: { time },
          vertexShader: `uniform float time; varying vec2 vUv;
            void main(){ vUv = uv; vec3 p = position;
              p.x += sin(uv.x * 18.0 + time * 0.6) * 12.0; p.z += cos(uv.x * 14.0 + time * 0.5) * 12.0;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
          fragmentShader: `uniform float time; varying vec2 vUv;
            void main(){
              float band = 0.55 + 0.45 * sin(vUv.x * 40.0 + time * 1.3 + sin(vUv.x * 9.0 + time) * 2.0);
              float fade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
              float ends = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
              vec3 green = vec3(0.2, 1.0, 0.65); vec3 violet = vec3(0.6, 0.35, 1.0);
              vec3 c = mix(green, violet, smoothstep(0.45, 1.0, vUv.y));
              gl_FragColor = vec4(c * band, band * fade * ends * 0.55); }`,
        }),
      );
      aurora.position.y = 110 + height / 2;
      aurora.rotation.y = rot;
      group.add(aurora);
    }
  }

  group.userData.update = (dt: number) => {
    for (const t of timeUniforms) t.value += dt;
  };
  return group;
}
