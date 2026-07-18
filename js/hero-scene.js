// Hero 3D — noyau IA + réseau de nœuds (Three.js)
import * as THREE from 'three';

const canvas = document.getElementById('hero-canvas');
const heroSection = document.getElementById('hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

try {
  initHeroScene();
} catch (err) {
  console.warn('Scène 3D désactivée (WebGL indisponible) :', err);
}

function initHeroScene() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 13;

  const isMobile = window.innerWidth < 700;

  // ─── Réseau de nœuds en arrière-plan ───
  const pointCount = isMobile ? 40 : 90;
  const spread = 10;
  const positions = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread - 2;
  }
  const network = new THREE.Group();
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  network.add(new THREE.Points(pointsGeo, new THREE.PointsMaterial({
    color: 0x818cf8, size: 0.08, transparent: true, opacity: 0.6, sizeAttenuation: true,
  })));
  const linkThreshold = isMobile ? 2.6 : 3;
  const linkPositions = [];
  for (let i = 0; i < pointCount; i++) {
    const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
    for (let j = i + 1; j < pointCount; j++) {
      const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
      if (Math.hypot(ax - bx, ay - by, az - bz) < linkThreshold) linkPositions.push(ax, ay, az, bx, by, bz);
    }
  }
  const linksGeo = new THREE.BufferGeometry();
  linksGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linkPositions), 3));
  network.add(new THREE.LineSegments(linksGeo, new THREE.LineBasicMaterial({
    color: 0x6366f1, transparent: true, opacity: 0.12,
  })));
  scene.add(network);

  // ─── Noyau IA central ───
  const orb = new THREE.Group();

  // bruit simplex 3D (Ashima Arts, domaine public) pour une coque organique et vivante
  const noiseGLSL = `
    vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `;

  const shellUniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x6366f1) },
    uColorB: { value: new THREE.Color(0xc4b5fd) },
  };
  const shellGeo = new THREE.IcosahedronGeometry(2, isMobile ? 2 : 3);
  const shellMat = new THREE.ShaderMaterial({
    uniforms: shellUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying float vDisp;
      ${noiseGLSL}
      void main() {
        vNormal = normalize(normalMatrix * normal);
        float n = snoise(position * 1.1 + uTime * 0.25);
        vDisp = n;
        vec3 displaced = position + normal * n * 0.28;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vNormal;
      varying float vDisp;
      void main() {
        float fresnel = pow(1.0 - abs(vNormal.z), 2.2);
        vec3 color = mix(uColorA, uColorB, vDisp * 0.5 + 0.5);
        gl_FragColor = vec4(color, clamp(fresnel * 0.55 + 0.04, 0.0, 0.5));
      }
    `,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  orb.add(shell);

  // cage cristalline (filaire, basse résolution, contraste géométrique face au bruit organique)
  const wireGeo = new THREE.IcosahedronGeometry(2.18, 1);
  const wire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
    color: 0xa5b4fc, wireframe: true, transparent: true, opacity: 0.22,
  }));
  orb.add(wire);

  // cœur lumineux
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.9 })
  );
  orb.add(core);

  // halos additifs (glow) — sprite radial en dégradé, toujours face caméra
  function makeGlowTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(199,210,254,0.75)');
    g.addColorStop(0.4, 'rgba(129,140,248,0.25)');
    g.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();
  const glowInner = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glowInner.scale.set(3.6, 3.6, 1);
  const glowOuter = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glowOuter.scale.set(6.5, 6.5, 1);
  orb.add(glowOuter, glowInner);

  // anneaux de particules en orbite ("électrons")
  const orbits = [];
  const ringColors = [0xc7d2fe, 0x818cf8, 0xa78bfa];
  for (let r = 0; r < 3; r++) {
    const n = 16;
    const radius = 3.1 + r * 0.45;
    const ringPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ringPos[i * 3] = Math.cos(a) * radius;
      ringPos[i * 3 + 1] = Math.sin(a) * radius;
      ringPos[i * 3 + 2] = 0;
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    const ringPts = new THREE.Points(ringGeo, new THREE.PointsMaterial({
      color: ringColors[r], size: 0.07, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    const pivot = new THREE.Group();
    pivot.rotation.x = [0.9, 1.9, 1.2][r];
    pivot.rotation.y = [0.3, -0.6, 1.1][r];
    pivot.add(ringPts);
    orbits.push({ pivot, speed: [0.006, -0.0045, 0.0035][r] });
    orb.add(pivot);
  }

  scene.add(orb);

  // ─── Interaction souris → parallax caméra + rotation ───
  let targetX = 0, targetY = 0;
  if (!reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  function resize() {
    const w = heroSection.clientWidth, h = heroSection.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 })
    .observe(heroSection);

  let camX = 0, camY = 0, baseRotY = 0, netTiltX = 0, netTiltY = 0;
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();

    if (!reduceMotion) {
      camX += (targetX * 1.1 - camX) * 0.04;
      camY += (-targetY * 0.7 - camY) * 0.04;
      camera.position.x = camX;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);

      baseRotY += 0.0016;
      orb.rotation.y = baseRotY + targetX * 0.15;
      orb.rotation.x = targetY * 0.12;
      const pulse = 1 + Math.sin(t * 1.4) * 0.035;
      orb.scale.setScalar(pulse);
      glowInner.material.opacity = 0.32 + Math.sin(t * 1.8) * 0.08;
      shellUniforms.uTime.value = t;

      orbits.forEach(o => { o.pivot.rotation.z += o.speed; });

      netTiltX += (targetY * 0.08 - netTiltX) * 0.03;
      netTiltY += (targetX * 0.08 - netTiltY) * 0.03;
      network.rotation.y = t * 0.02 + netTiltY;
      network.rotation.x = netTiltX;
    }
    renderer.render(scene, camera);
  }
  frame();
  canvas.classList.add('ready');
}
