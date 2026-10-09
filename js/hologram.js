/* Mist Tech — holofoil 3D logo (contact section)
   The Mist mark is extruded into 3D with three.js and given an iridescent holographic-foil shader:
   a chrome base with rainbow diffraction bands that slide with the viewing angle, plus tiny glints.
   It floats on its own, spins slowly, tilts toward the cursor, and spins faster while hovered. */
(() => {
  const host = document.querySelector('[data-hologram]');
  if (!host || !window.THREE) return; // fallback image stays visible
  const THREE = window.THREE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  host.classList.add('is-3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11.5);

  /* ---------- Logo geometry: the Mist mark outline (assets/logos/mist-mark.svg) ---------- */
  const MARK_PATH = 'M43.6953 44H32.7715V33.0752H43.6953V44ZM12.0166 43.999H0V21.0586H12.0166V43.999ZM33.0273 24.834L32.6406 32.9453L24.5303 33.3311L0 9.04297L0.385742 0.932617L8.49707 0.545898L33.0273 24.834ZM43.3096 0.385742L43.6953 8.49707L34.207 17.8828L26.0957 17.4961L25.71 9.38574L35.1992 0L43.3096 0.385742Z';
  const MARK_W = 43.6953;
  const MARK_H = 44;

  // Minimal parser for absolute M / L / H / V / Z commands (all the mark uses); SVG y points down, so flip it
  function pathToShapes(d) {
    const tokens = d.match(/[MLHVZ]|-?\d*\.?\d+/g);
    const shapes = [];
    let shape = null, cmd = null, x = 0, y = 0, i = 0;
    const num = () => parseFloat(tokens[i++]);
    const pt = () => [x - MARK_W / 2, MARK_H / 2 - y];
    while (i < tokens.length) {
      const t = tokens[i];
      if (/[MLHVZ]/.test(t)) { cmd = t; i++; if (cmd !== 'Z') continue; }
      switch (cmd) {
        case 'M': x = num(); y = num(); shape = new THREE.Shape(); shape.moveTo(...pt()); cmd = 'L'; break;
        case 'L': x = num(); y = num(); shape.lineTo(...pt()); break;
        case 'H': x = num(); shape.lineTo(...pt()); break;
        case 'V': y = num(); shape.lineTo(...pt()); break;
        case 'Z': shape.closePath(); shapes.push(shape); cmd = null; break;
      }
    }
    return shapes;
  }

  const geometry = new THREE.ExtrudeGeometry(pathToShapes(MARK_PATH), {
    depth: 7, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.6, bevelSegments: 4, curveSegments: 4,
  });
  geometry.center();

  /* ---------- Holofoil shader ---------- */
  const uniforms = { uTime: { value: 0 } };
  const foil = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vPos = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vView);
        vec3 R = reflect(-V, N);
        vec3 L = normalize(vec3(-0.4, 0.7, 0.6));
        float cosT = abs(dot(N, V));

        // Pearl base: a soft studio reflection (bright above, slightly cooler below)
        vec3 pearl = mix(vec3(0.80, 0.83, 0.90), vec3(1.0), smoothstep(-0.5, 0.8, R.y));

        // Thin-film interference (soap bubble / pearl): the colour depends on the film thickness and the
        // viewing angle. Thickness varies slowly across the surface so colour flows smoothly over each face,
        // and it shifts only as the viewing angle changes (spin / mouse tilt). No noise, no time drift.
        float thickness = 0.62 + 0.22 * sin(vPos.x * 0.055 + vPos.y * 0.045) + 0.12 * sin(vPos.y * 0.07 - vPos.x * 0.03);
        float phase = thickness * (2.2 - cosT) * 1.9 + R.x * 0.22 + R.y * 0.12;
        vec3 film = 0.5 + 0.5 * cos(6.2831 * (phase + vec3(0.0, 0.33, 0.67)));

        // Iridescence is strongest at glancing angles, softer where the face looks straight at you
        float strength = 0.62 + 0.33 * (1.0 - cosT);
        vec3 col = mix(pearl, film, strength);
        col *= 0.88 + 0.12 * max(dot(N, L), 0.0);

        // One soft specular highlight
        col += vec3(1.0) * pow(max(dot(R, L), 0.0), 24.0) * 0.35;

        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const logo = new THREE.Mesh(geometry, foil);
  logo.scale.setScalar(0.072);
  scene.add(logo);

  /* ---------- Sizing ---------- */
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  /* ---------- Mouse: tilt toward the cursor, spin faster on hover ---------- */
  const target = { rx: 0, ry: 0 };
  const current = { rx: 0, ry: 0 };
  let spin = 0, spinSpeed = 0.45, spinTarget = 0.45;
  window.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    const nx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2;  // -1..1 around the logo
    const ny = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 2;
    target.ry = Math.max(-1, Math.min(1, nx)) * 0.9;
    target.rx = Math.max(-1, Math.min(1, ny)) * 0.5;
  }, { passive: true });
  host.addEventListener('pointerenter', () => { spinTarget = 2.2; });
  host.addEventListener('pointerleave', () => { spinTarget = 0.45; });

  /* ---------- Loop (only while the section is on screen) ---------- */
  const clock = new THREE.Clock();
  let running = false;
  const tick = () => {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    if (!reduceMotion) {
      spinSpeed += (spinTarget - spinSpeed) * 0.04;
      spin += dt * spinSpeed;
    }
    current.rx += (target.rx - current.rx) * 0.06;
    current.ry += (target.ry - current.ry) * 0.06;
    logo.rotation.set(current.rx + (reduceMotion ? 0 : Math.sin(t * 0.7) * 0.08), spin + current.ry, 0);
    logo.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.18;   // gentle float

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running) { running = true; clock.getDelta(); requestAnimationFrame(tick); }
    if (!visible) running = false;
  }).observe(host);
})();
