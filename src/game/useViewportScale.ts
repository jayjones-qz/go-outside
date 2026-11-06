import { useEffect, useState } from 'react';
import { computeDims, type Dims } from '../layout';

export interface Viewport {
  dims: Dims;
  scale: number;
}

function measure(prev?: Viewport): Viewport {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const next = computeDims(vw, vh);
  const dims = prev && prev.dims.w === next.w && prev.dims.h === next.h ? prev.dims : next;
  return { dims, scale: Math.min(vw / dims.w, vh / dims.h) };
}

/**
 * World dims + scale for the iframe. Width is 480 (landscape) or 280 (portrait);
 * height stretches to fill the viewport, letterboxing only at extreme aspect ratios.
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState(() => measure());
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp((p) => measure(p)));
    };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return vp;
}
