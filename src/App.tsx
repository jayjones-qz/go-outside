import { useMemo } from 'react';
import { loadCardsFromLocation, sampleUrl } from './parseCards';
import { Game } from './game/Game';

export function App() {
  const result = useMemo(() => loadCardsFromLocation(window.location), []);

  if (result.error) {
    return (
      <div className="error">
        <div className="panel">
          <div className="panel-title">{result.error === 'missing' ? 'No flashcards yet' : "Couldn't read the flashcards"}</div>
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

  return <Game cards={result.cards} />;
}
