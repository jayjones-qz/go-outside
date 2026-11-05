import { useEffect, useMemo, useRef } from 'react';
import { H, W } from '../layout';
import { drawFrame, renderStatic, type SceneSpec } from './drawScene';

export function Background({ scene }: { scene: SceneSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layers = useMemo(() => renderStatic(scene), [scene]);

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      drawFrame(ctx, scene, layers, (now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene, layers]);

  return <canvas ref={ref} className="bg" width={W} height={H} aria-hidden="true" />;
}
