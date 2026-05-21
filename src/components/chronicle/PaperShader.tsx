"use client";

import { useEffect, useRef } from "react";

const VERT = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;
  uniform float uTime;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    vec3 paperBase = vec3(0.961, 0.941, 0.910);

    float fiber = fbm(uv * 180.0 + vec2(uTime * 0.02, 0.0));
    float grain = fbm(uv * 400.0);

    vec2 lightPos = vec2(0.3 + sin(uTime * 0.04) * 0.15, 0.6 + cos(uTime * 0.03) * 0.1);
    float dist = distance(uv, lightPos);
    float lightWarm = (1.0 - smoothstep(0.0, 0.8, dist)) * 0.025;

    float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.4);

    vec3 color = paperBase;
    color += fiber * 0.018;
    color -= grain * 0.012;
    color += vec3(lightWarm * 0.6, lightWarm * 0.4, lightWarm * 0.1);
    color *= (0.88 + vignette * 0.12);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function PaperShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      // WebGL unavailable — leave canvas blank (paper-colored via CSS fallback)
      return;
    }

    function compileShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uRes  = gl.getUniformLocation(prog, "uResolution");

    function resize() {
      canvas.width  = Math.round(canvas.offsetWidth  * devicePixelRatio);
      canvas.height = Math.round(canvas.offsetHeight * devicePixelRatio);
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf: number;
    const start = performance.now();

    function render() {
      const t = (performance.now() - start) / 1000;
      gl!.uniform1f(uTime, t);
      gl!.uniform2f(uRes, canvas.width, canvas.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width:      "100%",
        height:     "100%",
        display:    "block",
        background: "#F5F0E8", // CSS fallback when WebGL unavailable
      }}
    />
  );
}
