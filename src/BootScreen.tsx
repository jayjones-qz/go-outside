import { useEffect } from 'react';

export const BOOT_MS = 3000;
export const BOOT_EXIT_MS = 320;

const Q_PATH =
  'M12.586 3.019a9.1 9.1 0 0 0-3.69.528A9 9 0 0 0 5.74 5.512a8.9 8.9 0 0 0-2.083 3.065 8.9 8.9 0 0 0-.652 3.638c.152 4.681 4.004 8.487 8.724 8.623a9 9 0 0 0 4.449-1.011.25.25 0 0 1 .257.014q.393.258.816.464a7.1 7.1 0 0 0 3.136.695.25.25 0 0 0 .234-.154.3.3 0 0 0 .02-.095v-3.029a.245.245 0 0 0-.208-.244 3.5 3.5 0 0 1-.842-.24.25.25 0 0 1-.146-.263.3.3 0 0 1 .039-.1 8.83 8.83 0 0 0 1.502-5.438c-.242-4.488-3.876-8.133-8.4-8.418M6.55 11.922c0-1.068.32-2.113.918-3.001a5.44 5.44 0 0 1 2.446-1.99 5.5 5.5 0 0 1 3.148-.307 5.46 5.46 0 0 1 2.79 1.478 5.4 5.4 0 0 1 1.491 2.766 5.36 5.36 0 0 1-.31 3.122 5.4 5.4 0 0 1-2.007 2.425 5.48 5.48 0 0 1-6.88-.672 5.38 5.38 0 0 1-1.596-3.82';

/** Extrusion depth layers (back → front) to fake a 3D slab while spinning on Y. */
const DEPTH = 7;

function QLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <path d={Q_PATH} />
    </svg>
  );
}

/**
 * ~3s retro console boot: CRT power-on, Q logo spinning on the Y axis,
 * scanlines / noise / vignette / rolling bar, CRT power-off. Click or any key skips.
 */
export function BootScreen({ exiting, onSkip }: { exiting: boolean; onSkip: () => void }) {
  useEffect(() => {
    const onKey = () => onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  return (
    <div
      className={`boot${exiting ? ' boot-exit' : ''}`}
      onPointerDown={onSkip}
      role="img"
      aria-label="Quizlet loading"
    >
      <div className="boot-tube">
        <div className="boot-stage">
          <div className="boot-spinner">
            {Array.from({ length: DEPTH }, (_, i) => (
              <QLogo
                key={i}
                className="boot-q boot-q-depth"
                style={{ transform: `translateZ(${(i - DEPTH) * 1.2}px)` }}
              />
            ))}
            <QLogo className="boot-q boot-q-face" />
          </div>
        </div>
        <div className="boot-title">Quizlet</div>
      </div>
      <div className="crt crt-noise" />
      <div className="crt crt-scanlines" />
      <div className="crt crt-roll" />
      <div className="crt crt-vignette" />
    </div>
  );
}
