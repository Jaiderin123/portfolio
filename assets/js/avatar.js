// Avatar con giro 3D (foto delante) y esfera de partículas WebGL detrás.

// 8. Esfera de partículas WebGL (cara trasera del avatar). Sin librerías.
//    initCrystalBall(contenedor) devuelve destroy().
function initCrystalBall(containerEl) {
  const NOOP = () => {};
  if (!containerEl) return NOOP;

  // --- Ajustes (cantidad de partículas, color y comportamiento) -------------
  const COUNT = window.innerWidth < 900 ? 3500 : 7000;   // partículas
  const MAX_DPR = 2;
  const HOVER_STRENGTH = 0.7;      // fuerza con que el cursor empuja los puntos
  const ROT_Y = 0.15;              // rad/s
  const FILL = 0.45, DEPTH = 0.5, SWAY = 0.4, TWINKLE = 0.6, HAZE = 0.8, GLOW = 0.9;  // preset "nebula"
  const COLOR_BASE = [0.580, 0.471, 1.000];   // #9478FF
  const COLOR_A    = [0.486, 0.361, 1.000];   // #7C5CFF
  const COLOR_B    = [0.655, 0.584, 1.000];   // #A795FF
  const PUSH_RADIUS = 0.55, PUSH_AMP = 0.35, SPRING_K = 0.12, SPRING_DAMP = 0.82;
  const SPHERE_NDC = 0.78;         // radio aproximado de la esfera en pantalla
  const SWAY_AMP = 0.28 * SWAY;    // oscilación en X (rad)

  const root = containerEl.closest('.avatar-flip') || containerEl;
  const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const f3 = (v) => `vec3(${v.map((n) => n.toFixed(3)).join(',')})`;

  const VS = `
attribute vec3 aPos;
attribute vec3 aOff;     // desplazamiento por resorte (calculado en la CPU)
attribute vec4 aRand;    // x fase, y tamaño, z color
uniform float uTime;
uniform float uDpr;
uniform float uAspect;
varying vec3 vColor;
varying float vAlpha;
const float ROT_Y = ${ROT_Y.toFixed(3)};
const float SWAY_AMP = ${SWAY_AMP.toFixed(4)};
const float FILL = ${FILL.toFixed(2)};
const float DEPTH = ${DEPTH.toFixed(2)};
const float TWINKLE = ${TWINKLE.toFixed(2)};
const float HAZE = ${HAZE.toFixed(2)};
const float GLOW = ${GLOW.toFixed(2)};
const float NDC = ${SPHERE_NDC.toFixed(2)};
const vec3 C0 = ${f3(COLOR_BASE)};
const vec3 C1 = ${f3(COLOR_A)};
const vec3 C2 = ${f3(COLOR_B)};
float ay;
float ax;
vec3 rot(vec3 v) {
  float cy = cos(ay), sy = sin(ay);
  v = vec3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);
  float cx = cos(ax), sx = sin(ax);
  return vec3(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);
}
void main() {
  ay = uTime * ROT_Y;
  ax = sin(uTime * 0.5) * SWAY_AMP;
  float breathe = 1.0 + 0.015 * sin(uTime * 0.8);          // el radio respira muy poco
  vec3 p = rot((aPos + aOff) * breathe);
  vec3 n = rot(normalize(aPos));

  float persp = 1.0 / (1.0 - p.z * DEPTH * 0.45);
  vec2 s = vec2(min(1.0, 1.0 / uAspect), min(1.0, uAspect));
  gl_Position = vec4(p.xy * persp * NDC * s, 0.0, 1.0);
  gl_PointSize = mix(1.5, 3.0, aRand.y) * uDpr * persp;

  float front = 0.5 + 0.5 * n.z;
  float depthA = mix(1.0 - HAZE * 0.75, 1.0, front);       // bruma: lo trasero se apaga
  float tw = 1.0 - TWINKLE * (0.5 + 0.5 * sin(uTime * (1.1 + aRand.y * 1.6) + aRand.x * 6.2831853));
  float rim = pow(1.0 - abs(n.z), 2.5);                    // Fresnel: contorno más luminoso

  vec3 col = aRand.z < 0.5 ? mix(C0, C1, aRand.z * 2.0) : mix(C0, C2, (aRand.z - 0.5) * 2.0);
  vColor = col * (1.0 + GLOW * rim * 0.22);
  vAlpha = min(FILL * depthA * tw * (1.0 + GLOW * rim * 0.9), 0.9);
}`;
  const FS = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(vColor, vAlpha); }`;

  let canvas = null, gl = null, program = null, loseExt = null;
  let posBuf = null, rndBuf = null, offBuf = null, uniforms = null;
  let raf = 0, running = false, inView = true, destroyed = false, contextLost = false;
  let time = 0, last = null, w = 0, h = 0, dpr = 1, keepAlive = 0, settled = true;
  let timer = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };

  // --- Geometría: esfera de Fibonacci con ruido en el radio ---------------------
  const pos = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT * 4);
  const off = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / COUNT;
    const r = Math.sqrt(1 - y * y);
    const th = i * golden;
    const rad = 1 + (Math.random() - 0.5) * 0.10;
    pos[i * 3] = Math.cos(th) * r * rad;
    pos[i * 3 + 1] = y * rad;
    pos[i * 3 + 2] = Math.sin(th) * r * rad;
    rnd[i * 4] = Math.random();
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
  }

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  }
  function buildGL() {
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.bindAttribLocation(program, 1, 'aOff');
    gl.bindAttribLocation(program, 2, 'aRand');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    uniforms = {
      time: gl.getUniformLocation(program, 'uTime'),
      dpr: gl.getUniformLocation(program, 'uDpr'),
      aspect: gl.getUniformLocation(program, 'uAspect'),
    };
    posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    offBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
    gl.bufferData(gl.ARRAY_BUFFER, off, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    rndBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rndBuf);
    gl.bufferData(gl.ARRAY_BUFFER, rnd, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);       // mezcla aditiva
    gl.clearColor(0.031, 0.024, 0.055, 1);    // #08060E, igual que la cara trasera
    return true;
  }

  function fallback() {
    containerEl.classList.add('no-webgl');
    if (canvas) canvas.remove();
    canvas = gl = null;
    destroyed = true;
  }

  try {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl || !buildGL()) throw new Error('webgl');
    loseExt = gl.getExtension('WEBGL_lose_context');
    containerEl.appendChild(canvas);
  } catch (e) {
    fallback();
    return NOOP;
  }

  // --- Tamaño ------------------------------------------------------------------------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    w = Math.max(1, Math.round(containerEl.clientWidth * dpr));
    h = Math.max(1, Math.round(containerEl.clientHeight * dpr));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(containerEl);

  // --- Resortes: empuje del cursor y retorno ---------------------------------------------
  function updateSprings() {
    mouse.s += (mouse.ts - mouse.s) * 0.12;
    mouse.x += (mouse.tx - mouse.x) * 0.3;
    mouse.y += (mouse.ty - mouse.y) * 0.3;
    const strength = mouse.s * HOVER_STRENGTH;
    const hasContact = strength > 0.002;
    if (!hasContact && settled) return;

    let cx = 0, cy = 0, cz = 0;
    if (hasContact) {
      // cursor -> punto sobre la esfera (vista) -> espacio del objeto (rotación inversa)
      let vx = mouse.x / SPHERE_NDC, vy = mouse.y / SPHERE_NDC;
      const r2 = vx * vx + vy * vy;
      let vz;
      if (r2 <= 1) { vz = Math.sqrt(1 - r2); }
      else { const r = Math.sqrt(r2); vx /= r; vy /= r; vz = 0; }
      const ay = time * ROT_Y, ax = Math.sin(time * 0.5) * SWAY_AMP;
      const cxr = Math.cos(ax), sxr = Math.sin(ax);
      const y1 = cxr * vy + sxr * vz, z1 = -sxr * vy + cxr * vz;
      const cyr = Math.cos(ay), syr = Math.sin(ay);
      cx = cyr * vx - syr * z1; cy = y1; cz = syr * vx + cyr * z1;
    }

    const R2 = PUSH_RADIUS * PUSH_RADIUS;
    let energy = 0;
    for (let i = 0; i < COUNT; i++) {
      const k = i * 3;
      let tx = 0, ty = 0, tz = 0;
      if (hasContact) {
        const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = pos[k + 2] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 1e-4;
          const f = 1 - d / PUSH_RADIUS;
          const m = (f * f * strength * PUSH_AMP) / d;     // empuja hacia afuera del cursor
          tx = dx * m; ty = dy * m; tz = dz * m;
        }
      }
      vel[k]     = (vel[k]     + (tx - off[k])     * SPRING_K) * SPRING_DAMP; off[k]     += vel[k];
      vel[k + 1] = (vel[k + 1] + (ty - off[k + 1]) * SPRING_K) * SPRING_DAMP; off[k + 1] += vel[k + 1];
      vel[k + 2] = (vel[k + 2] + (tz - off[k + 2]) * SPRING_K) * SPRING_DAMP; off[k + 2] += vel[k + 2];
      energy += Math.abs(vel[k]) + Math.abs(off[k]) + Math.abs(vel[k + 1]) + Math.abs(off[k + 1]) +
                Math.abs(vel[k + 2]) + Math.abs(off[k + 2]);
    }
    if (!hasContact && energy < 0.05) { off.fill(0); vel.fill(0); settled = true; }
    else settled = false;
    gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, off);
  }

  function draw() {
    if (!gl || contextLost) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.dpr, dpr);
    gl.uniform1f(uniforms.aspect, w / h);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (last === null) last = now;
    time += Math.min((now - last) / 1000, 0.1);
    last = now;
    updateSprings();
    draw();
  }
  function start() { if (running || destroyed || contextLost) return; running = true; last = null; raf = requestAnimationFrame(frame); }
  function stop() { if (!running) return; running = false; cancelAnimationFrame(raf); raf = 0; }

  // --- Solo se anima si la cara trasera está visible y el avatar en pantalla -----------------
  function backVisible() {
    return root.classList.contains('is-flipped') || (hoverMq.matches && root.matches(':hover'));
  }
  function update() {
    const want = inView && !document.hidden && (backVisible() || performance.now() < keepAlive);
    if (want) start(); else stop();
  }
  function onFlipChange() {
    keepAlive = performance.now() + 1000;       // deja terminar la animación del giro
    update();
    clearTimeout(timer);
    timer = setTimeout(update, 1050);
  }

  function onPointerMove(e) {
    const rect = containerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mouse.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.ts = 1;
    settled = false;
  }
  function onPointerLeave() { mouse.ts = 0; }
  function onContextLost(e) { e.preventDefault(); contextLost = true; stop(); }
  function onContextRestored() {
    contextLost = false;
    if (buildGL()) { resize(); update(); } else fallback();
  }

  const io = new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1].isIntersecting;
    update();
  });
  io.observe(root);
  const mo = new MutationObserver(onFlipChange);
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  root.addEventListener('pointerenter', onFlipChange);
  root.addEventListener('pointerleave', onFlipChange);
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('pointercancel', onPointerLeave);
  document.addEventListener('visibilitychange', update);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  resize();     // dibuja un primer fotograma estático
  update();

  return function destroy() {
    if (destroyed && !canvas) return;
    destroyed = true;
    stop();
    clearTimeout(timer);
    io.disconnect(); ro.disconnect(); mo.disconnect();
    root.removeEventListener('pointerenter', onFlipChange);
    root.removeEventListener('pointerleave', onFlipChange);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    root.removeEventListener('pointercancel', onPointerLeave);
    document.removeEventListener('visibilitychange', update);
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (loseExt) loseExt.loseContext();
      canvas.remove();
    }
    canvas = gl = null;
  };
}

// Giro del avatar: hover en escritorio, toque / Enter / Espacio en táctil y teclado.
// Con prefers-reduced-motion no hay giro y se queda la foto.
function initAvatarFlip() {
  const root = document.getElementById('avatarFlip');
  if (!root) return;
  const ball = root.querySelector('.crystalized-ball');
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  let enabled = false, destroyBall = null;

  function setFlipped(on) {
    root.classList.toggle('is-flipped', on);
    root.setAttribute('aria-pressed', String(on));
  }
  const toggle = () => setFlipped(!root.classList.contains('is-flipped'));
  function onClick(e) {
    if (hoverMq.matches && e.detail !== 0) return;   // en escritorio el giro es por hover
    toggle();
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(); }
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', 'Ver efecto');
    root.setAttribute('aria-pressed', 'false');
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    destroyBall = initCrystalBall(ball);
  }
  function disable() {
    enabled = false;
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    root.classList.remove('is-flipped');
    // sin giro no es un botón: se quitan también los atributos que vienen en el HTML
    ['role', 'tabindex', 'aria-label', 'aria-pressed'].forEach((a) => root.removeAttribute(a));
    if (destroyBall) { destroyBall(); destroyBall = null; }
  }
  function sync() { if (reduceMq.matches) disable(); else enable(); }
  reduceMq.addEventListener('change', sync);
  sync();
}
initAvatarFlip();
