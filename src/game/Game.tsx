import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Card } from '../parseCards';
import { BIRD_H, GROUND_Y, H, SIGN_H, SIGN_W, W, layoutTree, type Pt } from '../layout';
import { hashString, mulberry32 } from '../rng';
import { pickTheme } from '../themes';
import { buildScene } from '../scene/drawScene';
import { Background } from '../scene/Background';
import { birdSprite } from '../sprites';
import { postMatch } from '../messaging';
import { autoSpeak, birdFrame, createSim, dropBird, resolveAttempt, sendToBranch, speak, step, type Sim } from './sim';
import { useViewportScale } from './useViewportScale';

const nowS = () => performance.now() / 1000;
const BUBBLE_MAX_CHARS = 140;

export const seedFromCards = (cards: Card[]) =>
  hashString(cards.map((c) => `${c.id}\u0000${c.front}`).join('\u0001'));

interface Drag {
  key: number;
  pointerId: number;
  start: Pt;
  offset: Pt;
  moved: boolean;
}

export function Game({ cards }: { cards: Card[] }) {
  const seed = useMemo(() => seedFromCards(cards), [cards]);
  const theme = useMemo(() => pickTheme(seed), [seed]);
  const tree = useMemo(() => layoutTree(cards.length, mulberry32(seed), theme.tree), [cards.length, seed, theme]);
  const scene = useMemo(() => buildScene(theme, seed, tree), [theme, seed, tree]);
  const speakSeconds = (key: number) => Math.min(9, Math.max(3, 2.5 + cards[key].back.length * 0.06));

  const onMatch = (key: number, elapsedMs: number) => postMatch(cards[key].id, elapsedMs);
  const simRef = useRef<Sim | null>(null);
  if (simRef.current === null) simRef.current = createSim(cards.length, tree, nowS(), onMatch);
  const sim = simRef.current;
  sim.onMatch = onMatch;

  const dragRef = useRef<Drag | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const scale = useViewportScale();
  const [, setFrame] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = nowS();
    const loop = () => {
      const now = nowS();
      const s = simRef.current!;
      step(s, Math.min(0.05, now - last), now);
      autoSpeak(s, (k) => Math.min(9, Math.max(3, 2.5 + cards[k].back.length * 0.06)));
      last = now;
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cards]);

  const toWorld = (e: RPointerEvent): Pt => {
    const r = worldRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const branchAt = (p: Pt): number | null => {
    const i = tree.branches.findIndex(
      (br) =>
        !sim.matched.has(br.cardIndex) &&
        p.x >= br.sign.x - 3 &&
        p.x <= br.sign.x + SIGN_W + 3 &&
        p.y >= br.sign.y - BIRD_H - 4 &&
        p.y <= br.sign.y + SIGN_H + 6,
    );
    return i < 0 ? null : i;
  };

  const touch = () => {
    sim.lastInteraction = sim.now;
  };

  const onBirdDown = (key: number, e: RPointerEvent<HTMLButtonElement>) => {
    touch();
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    const b = sim.birds[key];
    dragRef.current = { key, pointerId: e.pointerId, start: p, offset: { x: b.x - p.x, y: b.y - p.y }, moved: false };
  };

  const onBirdMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const b = sim.birds[d.key];
    if (sim.matched.has(d.key)) return;
    const p = toWorld(e);
    if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) > 3) {
      d.moved = true;
      b.mode = 'drag';
      b.perch = null;
      b.rot = 0;
    }
    if (!d.moved) return;
    const nx = Math.max(8, Math.min(W - 8, p.x + d.offset.x));
    if (Math.abs(nx - b.x) > 0.5) b.facing = nx > b.x ? 1 : -1;
    b.x = nx;
    b.y = Math.max(BIRD_H, Math.min(H - 2, p.y + d.offset.y));
    sim.hoverBranch = branchAt(p);
    touch();
  };

  const onBirdUp = (e: RPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    sim.hoverBranch = null;
    touch();
    const b = sim.birds[d.key];
    if (!d.moved) {
      if (!cancelled) speak(sim, d.key, speakSeconds(d.key));
      return;
    }
    const idx = cancelled ? null : branchAt(toWorld(e));
    if (idx !== null) resolveAttempt(sim, b, idx);
    else dropBird(b);
  };

  const onSignClick = (branchIdx: number) => {
    touch();
    const sp = sim.speaking;
    if (sp) sendToBranch(sim, sp.key, branchIdx);
  };

  const restart = () => {
    dragRef.current = null;
    simRef.current = createSim(cards.length, tree, nowS(), onMatch);
    setFrame((f) => f + 1);
  };

  const now = sim.now;
  const speakingKey = sim.speaking?.key ?? null;
  const canTarget = speakingKey !== null && !sim.matched.has(speakingKey);
  const draggingKey = dragRef.current?.moved ? dragRef.current.key : null;
  const won = sim.wonAt !== null && now - sim.wonAt > 1.2;

  return (
    <div
      className="viewport"
      style={{
        background: `linear-gradient(to bottom, ${theme.sky[0]} 0%, ${theme.sky[theme.sky.length - 1]} ${(GROUND_Y / H) * 100}%, ${theme.ground} ${(GROUND_Y / H) * 100}%)`,
      }}
    >
      <div
        ref={worldRef}
        className="world"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <Background scene={scene} />

        {tree.branches.map((br, i) => {
          const matched = sim.matched.has(br.cardIndex);
          const cls = ['sign', matched && 'matched', !matched && canTarget && 'targetable', sim.hoverBranch === i && 'hover']
            .filter(Boolean)
            .join(' ');
          const front = cards[br.cardIndex].front;
          return (
            <button
              key={br.slot}
              className={cls}
              style={{ left: br.sign.x, top: br.sign.y, width: SIGN_W }}
              title={front}
              aria-label={matched ? `${front} (matched)` : `Branch: ${front}`}
              onClick={() => onSignClick(i)}
            >
              <span className="sign-text">{front}</span>
            </button>
          );
        })}

        {sim.birds.map((b) => {
          // Stable DOM order (reordering would drop pointer capture mid-drag); depth via z-index.
          const matched = sim.matched.has(b.key);
          return (
            <button
              key={b.key}
              className={`bird${b.key === draggingKey ? ' dragging' : ''}${matched ? ' matched' : ''}`}
              style={{
                transform: `translate(${Math.round(b.x - 12)}px, ${Math.round(b.y - 20)}px)`,
                zIndex: b.key === draggingKey ? 500 : 10 + Math.round(b.y),
              }}
              aria-label={matched ? `Matched bird: ${cards[b.key].back}` : `Bird. Press to hear it: ${cards[b.key].back}`}
              onPointerDown={(e) => onBirdDown(b.key, e)}
              onPointerMove={onBirdMove}
              onPointerUp={(e) => onBirdUp(e)}
              onPointerCancel={(e) => onBirdUp(e, true)}
              onLostPointerCapture={(e) => onBirdUp(e)}
              onClick={(e) => {
                // Keyboard activation only (pointer clicks are handled in pointerup).
                if (e.detail === 0) {
                  touch();
                  speak(sim, b.key, speakSeconds(b.key));
                }
              }}
            >
              <img
                src={birdSprite(birdFrame(b, now), b.variant)}
                alt=""
                draggable={false}
                style={{ transform: `scaleX(${b.facing}) rotate(${Math.round(b.rot)}deg)` }}
              />
            </button>
          );
        })}

        {speakingKey !== null && <Bubble bird={sim.birds[speakingKey]} text={cards[speakingKey].back} />}

        <div className="hud" aria-live="polite">
          {sim.matched.size}/{cards.length}
        </div>

        {won && (
          <div className="overlay">
            <div className="panel" role="dialog" aria-label="All matched">
              <div className="panel-title">All birds are home!</div>
              <div className="panel-sub">{Math.round(sim.wonAt! - sim.startedAt)}s</div>
              <button className="btn" onClick={restart} autoFocus>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ bird, text }: { bird: Sim['birds'][number]; text: string }) {
  const t = text.length > BUBBLE_MAX_CHARS ? `${text.slice(0, BUBBLE_MAX_CHARS - 1)}…` : text;
  const maxW = 165;
  const charW = 4.6;
  // Estimates are only used to keep the bubble on-screen; actual width is max-content.
  const estW = Math.min(maxW, t.length * charW + 20);
  const estH = 13 + Math.ceil((t.length * charW) / (maxW - 16)) * 10;
  const headY = bird.y - 16;
  const below = headY - estH - 6 < 0;
  const center = Math.max(estW / 2 + 4, Math.min(W - estW / 2 - 4, bird.x));
  const tailOffset = Math.max(-estW / 2 + 6, Math.min(estW / 2 - 10, bird.x - center));
  return (
    <div
      className={`bubble${below ? ' below' : ''}`}
      style={{
        left: center,
        top: below ? bird.y + 6 : headY - 6,
        maxWidth: maxW,
        transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
      role="status"
    >
      {t}
      <span className="bubble-tail" style={{ left: `calc(50% + ${tailOffset - 3.5}px)` }} />
    </div>
  );
}
