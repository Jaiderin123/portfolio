// Fondo de líneas animadas (WebGL) del inicio. Se apaga desde la consola con destroyHeroLines().

// 6. Fondo animado de líneas (WebGL) en el hero. Sin librerías.
//    Estados visibles en #line-waves-container[data-state]:
//    running | paused | static | unsupported | destroyed
function initHeroLines() {
  const section = document.getElementById('inicio');
  if (!section) return () => {};

  let container = document.getElementById('line-waves-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'line-waves-container';
    container.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:auto;';
    section.insertBefore(container, section.firstChild);
  }

  // --- Ajustes ---------------------------------------------------------
  const LINES = 240;          // número de líneas
  const SPEED = 0.08;         // velocidad del tiempo (lento y suave)
  const MOUSE_LERP = 0.05;    // suavizado del mouse por frame
  const MAX_DPR = 1.5;
  const MIN_WIDTH = 900;      // por debajo no se inicia el shader

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrowMq = window.matchMedia(`(max-width: ${MIN_WIDTH - 0.02}px)`);

  let canvas = null, gl = null, program = null, uniforms = null, buffer = null, loseExt = null;
  let raf = 0, running = false, visible = true, destroyed = false, unsupported = false;
  let contextLost = false, needsResize = true, last = null, time = 0, w = 0, h = 0;
  const mouse = { x: 0, y: 0, s: 0, tx: 0, ty: 0, ts: 0 };

  const setState = (v) => { container.dataset.state = v; };

  // --- Shaders ----------------------------------------------------------
  function sources(isGL2, hasDerivatives) {
    const vs = (isGL2 ? '#version 300 es\nin vec2 aPos;\n' : 'attribute vec2 aPos;\n') +
      'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

    const head = isGL2
      ? '#version 300 es\n'
      : (hasDerivatives ? '#extension GL_OES_standard_derivatives : enable\n' : '');
    const out = isGL2 ? 'out vec4 outColor;\n' : '';
    const fin = isGL2 ? 'outColor' : 'gl_FragColor';
    const deriv = (isGL2 || hasDerivatives)
      ? ''
      : '#define fwidth(x) (LINES / uRes.y * 1.6)\n';

    const fs = head + `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
${out}
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uMouse;           // x, y en espacio p, z = intensidad
const float LINES = ${LINES.toFixed(1)};
const vec3 COLOR = vec3(0.486, 0.361, 1.0);   // #7C5CFF
${deriv}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
         mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
v += a * noise(p);
p = p * 2.03 + vec2(17.1, 9.7);
a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Deformación suave alrededor del mouse (efecto lente)
  vec2 d = p - uMouse.xy;
  float infl = exp(-dot(d, d) / 0.045) * uMouse.z;
  p += d * infl * 0.35;

  // Ondulación automática (sin mouse): ruido + ondas horizontales y diagonales
  float t = uTime;
  float n1 = fbm(vec2(p.x * 1.1 + t * 0.8, p.y * 0.8 - t * 0.5));
  float n2 = noise(vec2(p.x * 2.3 - t * 0.6, p.y * 1.7 + t * 0.7));
  float breathe = 0.75 + 0.25 * sin(t * 1.3);                       // la amplitud "respira"
  float wH  = sin(p.x * 2.2 + t * 3.0);                             // horizontal
  float wD1 = sin((p.x * 0.8 + p.y * 1.1) * 3.4 - t * 2.6);         // diagonal ↗
  float wD2 = sin((p.x * 0.9 - p.y * 1.0) * 2.8 + t * 2.0);         // diagonal ↘
  float disp = (n1 - 0.5) * 0.80 + (n2 - 0.5) * 0.16
         + breathe * (0.10 * wH + 0.085 * wD1 + 0.07 * wD2);

  // Líneas finas con antialiasing
  float v = (p.y + disp + 0.5) * LINES;
  float id = floor(v);
  float f = fract(v);
  float dist = min(f, 1.0 - f);
  float fw = fwidth(v);
  float hw = 0.6 * fw;
  float line = 1.0 - smoothstep(hw * 0.3, hw * 1.3, dist);
  line *= smoothstep(1.6, 0.7, fw);            // evita moiré si se juntan demasiado

  float r = hash(vec2(id, 7.0));
  float lineAlpha = mix(0.35, 1.0, r * r);      // cada línea con su propio brillo
  float env = mix(0.55, 1.0, smoothstep(0.1, 0.9, uv.x));

  // Brillo bajo para que el negro domine
  float a = line * lineAlpha * env * (0.30 + 0.40 * infl);
  ${fin} = vec4(COLOR * a, a);                  // alfa premultiplicado
}`;
    return { vs, fs };
  }

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  function buildProgram() {
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const hasDeriv = isGL2 || !!gl.getExtension('OES_standard_derivatives');
    const src = sources(isGL2, hasDeriv);
    const vs = compile(gl.VERTEX_SHADER, src.vs);
    const fs = compile(gl.FRAGMENT_SHADER, src.fs);
    if (!vs || !fs) return false;
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    uniforms = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      mouse: gl.getUniformLocation(program, 'uMouse'),
    };
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  // Crea el canvas y el contexto solo cuando hace falta (nunca en móvil)
  function setup() {
    try {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const opts = { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' };
      gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) ||
           canvas.getContext('experimental-webgl', opts);
      if (!gl || !buildProgram()) throw new Error('webgl');
      loseExt = gl.getExtension('WEBGL_lose_context');
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);
      container.appendChild(canvas);
      needsResize = true;
      return true;
    } catch (e) {
      if (canvas) canvas.remove();
      canvas = gl = null;
      unsupported = true;
      setState('unsupported');   // sin errores visibles: simplemente no se dibuja
      return false;
    }
  }

  function onContextLost(e) { e.preventDefault(); contextLost = true; stop(); }
  function onContextRestored() {
    contextLost = false;
    if (buildProgram()) { needsResize = true; update(); } else { unsupported = true; setState('unsupported'); }
  }

  // --- Tamaño -----------------------------------------------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const rect = container.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width * dpr));
    const nh = Math.max(1, Math.round(rect.height * dpr));
    if (nw !== w || nh !== h) { w = nw; h = nh; canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    needsResize = false;
  }
  function onResize() { needsResize = true; update(); }

  // --- Mouse (con lerp) ---------------------------------------------------
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const aspect = rect.width / rect.height;
    mouse.tx = ((e.clientX - rect.left) / rect.width - 0.5) * aspect;
    mouse.ty = 0.5 - (e.clientY - rect.top) / rect.height;
    mouse.ts = 1;
  }
  function onPointerLeave() { mouse.ts = 0; }

  // --- Bucle ----------------------------------------------------------------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (last === null) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt * SPEED;

    mouse.x += (mouse.tx - mouse.x) * MOUSE_LERP;
    mouse.y += (mouse.ty - mouse.y) * MOUSE_LERP;
    mouse.s += (mouse.ts - mouse.s) * MOUSE_LERP;

    if (needsResize) resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.res, w, h);
    gl.uniform1f(uniforms.time, time);
    gl.uniform3f(uniforms.mouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-ready');
  }
  function start() {
    if (running || destroyed || !gl || contextLost) return;
    running = true;
    last = null;
    setState('running');
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    setState('paused');
  }

  // --- Decide si el efecto debe estar activo ------------------------------------
  function update() {
    if (destroyed || unsupported) return;
    if (reduceMq.matches || narrowMq.matches) {     // fondo negro estático
      stop();
      if (canvas) canvas.style.display = 'none';
      setState('static');
      return;
    }
    if (!gl && !setup()) return;
    canvas.style.display = '';
    if (visible && !document.hidden) start(); else stop();
  }

  // --- Visibilidad de la sección ---------------------------------------------------
  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    update();
  });
  io.observe(section);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(container);

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', update);
  reduceMq.addEventListener('change', update);
  narrowMq.addEventListener('change', update);
  section.addEventListener('pointermove', onPointerMove, { passive: true });
  section.addEventListener('pointerleave', onPointerLeave);

  update();

  // --- Desactivar por completo ----------------------------------------------------------
  return function destroy() {
    if (destroyed) return;
    stop();
    destroyed = true;
    io.disconnect();
    if (ro) ro.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', update);
    reduceMq.removeEventListener('change', update);
    narrowMq.removeEventListener('change', update);
    section.removeEventListener('pointermove', onPointerMove);
    section.removeEventListener('pointerleave', onPointerLeave);
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (loseExt) loseExt.loseContext();
      canvas.remove();
    }
    canvas = gl = null;
    setState('destroyed');
  };
}

// Para desactivarlo desde la consola: destroyHeroLines()
const destroyHeroLines = initHeroLines();
