import * as THREE from "three";
import { theme } from "@apex/shared";

/** Himmel mit Farbverlauf, Horizont-Glühen und Neon-Sonne. */
export function createSky(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.background) },
      mid: { value: new THREE.Color(0x2a0b4a) },
      horizon: { value: new THREE.Color(theme.magenta) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vPos;
      void main(){ float h = max(vPos.y, 0.0);
        vec3 c = mix(horizon * 0.55, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.6, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat));
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshBasicMaterial({ color: theme.orange, fog: false, transparent: true, opacity: 0.85 }),
  );
  sun.position.set(0, 40, 480);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  return group;
}
