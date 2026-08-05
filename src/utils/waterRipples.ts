/**
 * waterRipples.ts — Pure WebGL Water Ripple Engine
 * Zero external script dependencies (No jQuery, No CDN).
 * Renders hardware-accelerated fluid ripples on mouse move/hover.
 */

export interface WaterRipplesOptions {
  resolution?: number;
  perturbance?: number;
  radius?: number;
}

export function initWaterRipples(
  target: HTMLElement,
  imageSrc: string,
  options: WaterRipplesOptions = {}
) {
  const resolution = options.resolution || 256;
  const perturbance = options.perturbance || 0.04;
  const radius = options.radius || 0.035;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  target.appendChild(canvas);

  const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  if (!gl) return { destroy: () => canvas.remove() };

  // Float texture extensions (fallback gracefully if unsupported)
  gl.getExtension('OES_texture_float');
  gl.getExtension('OES_texture_float_linear');

  const vsSource = `
    attribute vec2 position;
    varying vec2 v_uv;
    void main() {
      v_uv = position * 0.5 + 0.5;
      v_uv.y = 1.0 - v_uv.y;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const dropFs = `
    precision highp float;
    uniform sampler2D u_buffer;
    uniform vec2 u_center;
    uniform float u_radius;
    uniform float u_strength;
    varying vec2 v_uv;
    void main() {
      vec4 info = texture2D(u_buffer, v_uv);
      float d = length(v_uv - u_center);
      if (d < u_radius) {
        float drop = max(0.0, 1.0 - d / u_radius);
        drop = 0.5 - 0.5 * cos(drop * 3.14159265);
        info.r += drop * u_strength;
      }
      gl_FragColor = info;
    }
  `;

  const updateFs = `
    precision highp float;
    uniform sampler2D u_buffer;
    uniform vec2 u_delta;
    varying vec2 v_uv;
    void main() {
      vec4 info = texture2D(u_buffer, v_uv);
      vec2 dx = vec2(u_delta.x, 0.0);
      vec2 dy = vec2(0.0, u_delta.y);
      float average = (
        texture2D(u_buffer, v_uv - dx).r +
        texture2D(u_buffer, v_uv + dx).r +
        texture2D(u_buffer, v_uv - dy).r +
        texture2D(u_buffer, v_uv + dy).r
      ) * 0.25;
      info.g += (average - info.r) * 2.0;
      info.g *= 0.96;
      info.r += info.g;
      gl_FragColor = info;
    }
  `;

  const renderFs = `
    precision highp float;
    uniform sampler2D u_buffer;
    uniform sampler2D u_texture;
    uniform vec2 u_delta;
    uniform float u_perturbance;
    varying vec2 v_uv;
    void main() {
      vec2 dx = vec2(u_delta.x, 0.0);
      vec2 dy = vec2(0.0, u_delta.y);
      float nX = (texture2D(u_buffer, v_uv + dx).r - texture2D(u_buffer, v_uv - dx).r) * 0.5;
      float nY = (texture2D(u_buffer, v_uv + dy).r - texture2D(u_buffer, v_uv - dy).r) * 0.5;
      vec2 uv = v_uv + vec2(nX, nY) * u_perturbance;
      gl_FragColor = texture2D(u_texture, uv);
    }
  `;

  function createShader(type: number, src: string) {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, src);
    gl!.compileShader(shader);
    return shader;
  }

  function createProgram(vsSrc: string, fsSrc: string) {
    const p = gl!.createProgram()!;
    gl!.attachShader(p, createShader(gl!.VERTEX_SHADER, vsSrc));
    gl!.attachShader(p, createShader(gl!.FRAGMENT_SHADER, fsSrc));
    gl!.linkProgram(p);
    return p;
  }

  const dropProg = createProgram(vsSource, dropFs);
  const updateProg = createProgram(vsSource, updateFs);
  const renderProg = createProgram(vsSource, renderFs);

  // Quad geometry
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Framebuffers & Textures for wave simulation
  function createTexture() {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, resolution, resolution, 0, gl!.RGBA, gl!.FLOAT, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    return tex;
  }

  function createFramebuffer(tex: WebGLTexture) {
    const fb = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    return fb;
  }

  let texA = createTexture();
  let texB = createTexture();
  let fbA = createFramebuffer(texA);
  let fbB = createFramebuffer(texB);

  // Background Image Texture
  const bgTex = gl.createTexture()!;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  img.src = imageSrc;

  function drawQuad(prog: WebGLProgram) {
    gl!.useProgram(prog);
    const posLoc = gl!.getAttribLocation(prog, 'position');
    gl!.enableVertexAttribArray(posLoc);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
    gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 0, 0);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  let pendingDrops: Array<{ x: number; y: number; strength: number }> = [];

  function addDrop(x: number, y: number, strength = 0.05) {
    pendingDrops.push({ x, y, strength });
  }

  // Mouse hover event listener on container — only mousemove generates ripples!
  const onMouseMove = (e: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    addDrop(x, y, 0.04);
  };

  target.addEventListener('mousemove', onMouseMove);

  let animationFrameId: number;

  function step() {
    // Sync canvas size with target
    if (canvas.width !== target.clientWidth || canvas.height !== target.clientHeight) {
      canvas.width = target.clientWidth;
      canvas.height = target.clientHeight;
    }

    // Apply drops
    if (pendingDrops.length > 0) {
      gl!.viewport(0, 0, resolution, resolution);
      for (const drop of pendingDrops) {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbB);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, texA);
        gl!.uniform1i(gl!.getUniformLocation(dropProg, 'u_buffer'), 0);
        gl!.uniform2f(gl!.getUniformLocation(dropProg, 'u_center'), drop.x, drop.y);
        gl!.uniform1f(gl!.getUniformLocation(dropProg, 'u_radius'), radius);
        gl!.uniform1f(gl!.getUniformLocation(dropProg, 'u_strength'), drop.strength);
        drawQuad(dropProg);

        // Swap buffers
        const tmpTex = texA; texA = texB; texB = tmpTex;
        const tmpFb = fbA; fbA = fbB; fbB = tmpFb;
      }
      pendingDrops = [];
    }

    // Simulation update
    gl!.viewport(0, 0, resolution, resolution);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbB);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texA);
    gl!.uniform1i(gl!.getUniformLocation(updateProg, 'u_buffer'), 0);
    gl!.uniform2f(gl!.getUniformLocation(updateProg, 'u_delta'), 1.0 / resolution, 1.0 / resolution);
    drawQuad(updateProg);

    // Swap buffers
    const tmpTex = texA; texA = texB; texB = tmpTex;
    const tmpFb = fbA; fbA = fbB; fbB = tmpFb;

    // Render texture distortion to canvas
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texA);
    gl!.uniform1i(gl!.getUniformLocation(renderProg, 'u_buffer'), 0);

    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, bgTex);
    gl!.uniform1i(gl!.getUniformLocation(renderProg, 'u_texture'), 1);

    gl!.uniform2f(gl!.getUniformLocation(renderProg, 'u_delta'), 1.0 / resolution, 1.0 / resolution);
    gl!.uniform1f(gl!.getUniformLocation(renderProg, 'u_perturbance'), perturbance);

    drawQuad(renderProg);

    animationFrameId = requestAnimationFrame(step);
  }

  animationFrameId = requestAnimationFrame(step);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      target.removeEventListener('mousemove', onMouseMove);
      canvas.remove();
    },
  };
}
