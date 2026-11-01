import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

const BRASS = 0xc6a36a;

export function mountCube(canvas: HTMLCanvasElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    canvas.dataset.state = 'off';
    return () => {};
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(1.85, 1.28, 2.35);
  camera.lookAt(0, 0, 0);

  const geometry = new BoxGeometry(1.15, 1.15, 1.15);
  const edges = new EdgesGeometry(geometry);
  const material = new LineBasicMaterial({ color: BRASS });
  const lines = new LineSegments(edges, material);
  lines.rotation.set(0.18, 0.62, 0);
  scene.add(lines);

  let frame = 0;
  let running = false;
  let last = 0;

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(): void {
    renderer.render(scene, camera);
  }

  function tick(): void {
    if (!running) return;
    const now = performance.now();
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    lines.rotation.y += delta * 0.32;
    lines.rotation.x += delta * 0.08;
    render();
    frame = window.requestAnimationFrame(tick);
  }

  function start(): void {
    if (running || reduced) return;
    running = true;
    last = performance.now();
    tick();
  }

  function stop(): void {
    running = false;
    window.cancelAnimationFrame(frame);
  }

  function onVisibility(): void {
    if (document.hidden) stop();
    else start();
  }

  const observer = new ResizeObserver(() => {
    resize();
    render();
  });
  observer.observe(canvas);
  resize();
  render();
  start();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    observer.disconnect();
    geometry.dispose();
    edges.dispose();
    material.dispose();
    renderer.dispose();
  };
}
