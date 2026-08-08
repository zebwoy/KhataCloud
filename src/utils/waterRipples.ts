/**
 * waterRipples.ts — Pure WebGL Water Ripple Engine
 * No jQuery. No CDN. Mouse-hover driven fluid ripples on a background element.
 *
 * Algorithm: ping-pong framebuffer wave simulation (shallow water equations)
 * with final render pass that distorts a background texture.
 */

export interface WaterRipplesOptions {
  /** Wave simulation grid resolution (default 256). Lower = faster. */
  resolution?: number;
  /** How strongly waves distort the background image (default 0.03). */
  perturbance?: number;
  /** Ripple radius in UV space 0..1 (default 0.04). */
  dropRadius?: number;
  /** Wave damping per frame (default 0.985, 1.0 = no damping). */
  damping?: number;
}

export function initWaterRipples(
  target: HTMLElement,
  backgroundImageSrc: string,
  opts: WaterRipplesOptions = {}
): { destroy: () => void } {
  const RES       = opts.resolution  ?? 256;
  const PERTURB   = opts.perturbance ?? 0.03;
  const DROP_R    = opts.dropRadius  ?? 0.04;
  const DAMPING   = opts.damping     ?? 0.985;

  // ── Canvas overlay ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', display: 'block',
  });
  target.style.position = target.style.position || 'relative';
  target.appendChild(canvas);

  // ── WebGL context ──────────────────────────────────────────────────────────
  const gl = (canvas.getContext('webgl') ??
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

  if (!gl) {
    // WebGL unavailable — silently remove canvas, nothing breaks
    canvas.remove();
    return { destroy: () => {} };
  }

  // Try float textures; fall back to UNSIGNED_BYTE if unavailable
  const floatExt = gl.getExtension('OES_texture_float');
  gl.getExtension('OES_texture_float_linear');
  const USE_FLOAT = !!floatExt;

  const INTERNAL_FORMAT = gl.RGBA;
  const DATA_TYPE       = USE_FLOAT ? gl.FLOAT : gl.UNSIGNED_BYTE;

  // ── Shader sources ─────────────────────────────────────────────────────────
  const VS = `
    attribute vec2 a_pos;
    varying   vec2 v_uv;
    void main() {
      v_uv        = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  // Adds a cosine-shaped drop at u_center
  const DROP_FS = `
    precision highp float;
    uniform sampler2D u_buf;
    uniform vec2  u_center;
    uniform float u_radius;
    uniform float u_strength;
    varying vec2  v_uv;
    void main() {
      vec4  px = texture2D(u_buf, v_uv);
      float d  = length(v_uv - u_center);
      if (d < u_radius) {
        float t = (1.0 - d / u_radius);
        float h = 0.5 - 0.5 * cos(t * 3.14159265);
        px.r   += h * u_strength;
      }
      gl_FragColor = px;
    }
  `;

  // Shallow-water wave propagation on packed (height, velocity) in rg channels
  const UPDATE_FS = `
    precision highp float;
    uniform sampler2D u_buf;
    uniform vec2      u_px;     // 1/resolution texel size
    uniform float     u_damp;
    varying vec2 v_uv;
    void main() {
      vec4  c  = texture2D(u_buf, v_uv);
      float h  = c.r;
      float v  = c.g;
      float n  = texture2D(u_buf, v_uv + vec2(0.0,  u_px.y)).r;
      float s  = texture2D(u_buf, v_uv + vec2(0.0, -u_px.y)).r;
      float e  = texture2D(u_buf, v_uv + vec2( u_px.x, 0.0)).r;
      float w  = texture2D(u_buf, v_uv + vec2(-u_px.x, 0.0)).r;
      float avg = (n + s + e + w) * 0.25;
      v  = (v + (avg - h) * 2.0) * u_damp;
      h += v;
      gl_FragColor = vec4(h, v, 0.0, 1.0);
    }
  `;

  // Final render: sample background distorted by wave normals
  const RENDER_FS = `
    precision highp float;
    uniform sampler2D u_buf;
    uniform sampler2D u_bg;
    uniform vec2      u_px;
    uniform float     u_perturb;
    varying vec2 v_uv;
    void main() {
      float nx = texture2D(u_buf, v_uv + vec2( u_px.x, 0.0)).r
               - texture2D(u_buf, v_uv + vec2(-u_px.x, 0.0)).r;
      float ny = texture2D(u_buf, v_uv + vec2(0.0,  u_px.y)).r
               - texture2D(u_buf, v_uv + vec2(0.0, -u_px.y)).r;
      // Flip Y to match CSS background convention
      vec2  uv = vec2(v_uv.x + nx * u_perturb,
                      1.0 - v_uv.y + ny * u_perturb);
      gl_FragColor = texture2D(u_bg, uv);
    }
  `;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function compileShader(type: number, src: string): WebGLShader {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }

  function buildProgram(fsSrc: string): WebGLProgram {
    const p = gl!.createProgram()!;
    gl!.attachShader(p, compileShader(gl!.VERTEX_SHADER, VS));
    gl!.attachShader(p, compileShader(gl!.FRAGMENT_SHADER, fsSrc));
    gl!.linkProgram(p);
    return p;
  }

  function loc(p: WebGLProgram, name: string) {
    return gl!.getUniformLocation(p, name);
  }

  // ── Programs ───────────────────────────────────────────────────────────────
  const progDrop   = buildProgram(DROP_FS);
  const progUpdate = buildProgram(UPDATE_FS);
  const progRender = buildProgram(RENDER_FS);

  // ── Full-screen quad ───────────────────────────────────────────────────────
  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  function drawQuad(prog: WebGLProgram) {
    gl!.useProgram(prog);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
    const a = gl!.getAttribLocation(prog, 'a_pos');
    gl!.enableVertexAttribArray(a);
    gl!.vertexAttribPointer(a, 2, gl!.FLOAT, false, 0, 0);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  // ── Simulation textures & framebuffers (ping-pong) ─────────────────────────
  function makeSimTex(): WebGLTexture {
    const t = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, t);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, INTERNAL_FORMAT,
      RES, RES, 0, INTERNAL_FORMAT, DATA_TYPE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);

    // Zero-initialise
    if (!USE_FLOAT) {
      const zeros = new Uint8Array(RES * RES * 4);
      gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, RES, RES,
        INTERNAL_FORMAT, DATA_TYPE, zeros);
    }
    return t;
  }

  function makeFBO(tex: WebGLTexture): WebGLFramebuffer {
    const fb = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER,
      gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    return fb;
  }

  let texA = makeSimTex(), texB = makeSimTex();
  let fboA = makeFBO(texA), fboB = makeFBO(texB);

  // ── Background image texture ───────────────────────────────────────────────
  const bgTex = gl.createTexture()!;
  let bgLoaded = false;
  const bgImg  = new Image();
  bgImg.crossOrigin = 'anonymous';
  bgImg.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImg);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    bgLoaded = true;
  };
  bgImg.src = backgroundImageSrc;

  // ── Mouse → drop queue ─────────────────────────────────────────────────────
  interface Drop { x: number; y: number; strength: number }
  const drops: Drop[] = [];

  const onMouseMove = (e: MouseEvent) => {
    const r = target.getBoundingClientRect();
    drops.push({
      x: (e.clientX - r.left)  / r.width,
      y: (e.clientY - r.top)   / r.height,
      strength: 0.04,
    });
  };
  target.addEventListener('mousemove', onMouseMove);

  // ── Render loop ────────────────────────────────────────────────────────────
  let rafId = 0;
  const PX = [1 / RES, 1 / RES] as const;

  function frame() {
    // Keep canvas pixel-perfect
    const W = target.clientWidth;
    const H = target.clientHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    // 1. Apply pending drops into simulation buffer
    while (drops.length > 0) {
      const d = drops.shift()!;
      gl!.viewport(0, 0, RES, RES);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fboB);
      gl!.useProgram(progDrop);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, texA);
      gl!.uniform1i(loc(progDrop, 'u_buf'), 0);
      gl!.uniform2f(loc(progDrop, 'u_center'), d.x, d.y);
      gl!.uniform1f(loc(progDrop, 'u_radius'),   DROP_R);
      gl!.uniform1f(loc(progDrop, 'u_strength'), d.strength);
      drawQuad(progDrop);
      // swap
      [texA, texB] = [texB, texA];
      [fboA, fboB] = [fboB, fboA];
    }

    // 2. Wave propagation step
    gl!.viewport(0, 0, RES, RES);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fboB);
    gl!.useProgram(progUpdate);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texA);
    gl!.uniform1i(loc(progUpdate, 'u_buf'),  0);
    gl!.uniform2f(loc(progUpdate, 'u_px'),   PX[0], PX[1]);
    gl!.uniform1f(loc(progUpdate, 'u_damp'), DAMPING);
    drawQuad(progUpdate);
    [texA, texB] = [texB, texA];
    [fboA, fboB] = [fboB, fboA];

    // 3. Render distorted background to screen (only once bg image loaded)
    if (bgLoaded) {
      gl!.viewport(0, 0, W, H);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.useProgram(progRender);

      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, texA);
      gl!.uniform1i(loc(progRender, 'u_buf'), 0);

      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, bgTex);
      gl!.uniform1i(loc(progRender, 'u_bg'),  1);

      gl!.uniform2f(loc(progRender, 'u_px'),      PX[0], PX[1]);
      gl!.uniform1f(loc(progRender, 'u_perturb'), PERTURB);
      drawQuad(progRender);
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  return {
    destroy() {
      cancelAnimationFrame(rafId);
      target.removeEventListener('mousemove', onMouseMove);
      canvas.remove();
    },
  };
}
