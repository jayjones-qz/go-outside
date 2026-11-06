import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCardsFromLocation, sampleUrl } from './parseCards';
import { Game } from './game/Game';
import { BOOT_MS, BootScreen, FADE_MS, PIXELATE_MS } from './BootScreen';

type Phase = 'boot' | 'pixelate' | 'fade' | 'ready';

export function App() {
  const result = useMemo(() => loadCardsFromLocation(window.location), []);
  const [phase, setPhase] = useState<Phase>('boot');

  const skip = useCallback(() => setPhase((p) => (p === 'boot' ? 'pixelate' : p)), []);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next: Partial<Record<Phase, [Phase, number]>> = {
      boot: ['pixelate', BOOT_MS],
      pixelate: ['fade', reduced ? 0 : PIXELATE_MS],
      fade: ['ready', FADE_MS],
    };
    const step = next[phase];
    if (!step) return;
    const t = setTimeout(() => setPhase(step[0]), step[1]);
    return () => clearTimeout(t);
  }, [phase]);

  // Game mounts when the crossfade starts, so its clock (elapsedMs, auto-speak) excludes the boot.
  const showContent = phase === 'fade' || phase === 'ready';

  return (
    <>
      {showContent && (result.error ? <ErrorScreen error={result.error} /> : <Game cards={result.cards} />)}
      {phase !== 'ready' && <BootScreen phase={phase} onSkip={skip} />}
    </>
  );
}

function ErrorScreen({ error }: { error: 'missing' | 'unparseable' }) {
  return (
    <div className="error">
      <div className="panel">
        <div className="panel-title">{error === 'missing' ? 'No flashcards yet' : "Couldn't read the flashcards"}</div>
        <div className="panel-sub">
          Expected <code>?cards=[{'{'}id,front,back{'}'}, …]</code> (JSON or base64, max 10).
        </div>
        <a className="btn" href={sampleUrl()}>
          Try a sample
        </a>
      </div>
    </div>
  );
}
