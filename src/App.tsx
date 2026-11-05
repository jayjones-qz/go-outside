import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCardsFromLocation, sampleUrl } from './parseCards';
import { Game } from './game/Game';
import { BOOT_EXIT_MS, BOOT_MS, BootScreen } from './BootScreen';

type Phase = 'boot' | 'exiting' | 'ready';

export function App() {
  const result = useMemo(() => loadCardsFromLocation(window.location), []);
  const [phase, setPhase] = useState<Phase>('boot');

  const skip = useCallback(() => setPhase((p) => (p === 'boot' ? 'exiting' : p)), []);

  useEffect(() => {
    if (phase === 'boot') {
      const t = setTimeout(skip, BOOT_MS - BOOT_EXIT_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'exiting') {
      const t = setTimeout(() => setPhase('ready'), BOOT_EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [phase, skip]);

  // Game mounts as the boot screen powers off, so its clock (elapsedMs, auto-speak) excludes the boot.
  const showContent = phase !== 'boot';

  return (
    <>
      {showContent && (result.error ? <ErrorScreen error={result.error} /> : <Game cards={result.cards} />)}
      {phase !== 'ready' && <BootScreen exiting={phase === 'exiting'} onSkip={skip} />}
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
