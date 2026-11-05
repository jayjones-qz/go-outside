import { useEffect, useState } from 'react';
import { H, W } from '../layout';

const calc = () => Math.min(window.innerWidth / W, window.innerHeight / H);

/** Scale factor that fits the W×H world into the iframe (letterboxed). */
export function useViewportScale(): number {
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const on = () => setScale(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return scale;
}
