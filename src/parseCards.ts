export interface Card {
  id: string;
  front: string;
  back: string;
}

export const MAX_CARDS = 10;

export type LoadResult =
  | { cards: Card[]; error: null }
  | { cards: []; error: 'missing' | 'unparseable' };

/**
 * Reads cards from `?cards=...`. The host format is loosely specified
 * (`[{id:...,front:"...",back:"..."}]`, possibly base64), so this accepts:
 * strict JSON, JS-object-literal style (bare keys, single quotes, trailing commas),
 * URL-encoded (once or twice), and base64 (standard or URL-safe, UTF-8).
 */
export function loadCardsFromLocation(loc: { search: string; hash: string }): LoadResult {
  const candidates = readCardsParam(loc.search, loc.hash);
  if (candidates.length === 0) return { cards: [], error: 'missing' };
  for (const c of candidates) {
    const cards = parseCardsText(c);
    if (cards && cards.length > 0) return { cards, error: null };
  }
  console.warn('[go-outside] could not parse cards param', candidates);
  return { cards: [], error: 'unparseable' };
}

/** Candidate raw values for `cards`, most to least likely. */
export function readCardsParam(search: string, hash = ''): string[] {
  const out: string[] = [];
  const m = /[?&]cards=([^&]*)/.exec(search);
  if (m) {
    // decodeURIComponent keeps '+' (URLSearchParams would turn it into a space).
    out.push(safeDecode(m[1]));
    // Unencoded '&' or '#' inside card text: take everything after `cards=`.
    const rest = search.slice(m.index + m[0].length - m[1].length) + hash;
    out.push(safeDecode(rest));
  }
  const usp = new URLSearchParams(search).get('cards');
  if (usp !== null) out.push(usp);
  return [...new Set(out.filter((s) => s.trim().length > 0))];
}

export function parseCardsText(text: string, depth = 0): Card[] | null {
  const t = text.trim();
  if (!t || depth > 3) return null;

  if (t.startsWith('[') || t.startsWith('{')) {
    let value = tryJson(t);
    if (value === undefined) {
      try {
        value = tryJson(relaxedToJson(t));
      } catch {
        value = undefined;
      }
    }
    if (value !== undefined) {
      const cards = normalize(value);
      if (cards) return cards;
    }
  }

  if (/%[0-9A-Fa-f]{2}/.test(t)) {
    const d = safeDecode(t);
    if (d !== t) {
      const r = parseCardsText(d, depth + 1);
      if (r) return r;
    }
  }

  if (looksBase64(t)) {
    const d = decodeBase64(t);
    if (d !== null) {
      const r = parseCardsText(d, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function normalize(value: unknown): Card[] | null {
  let v = value;
  if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { cards?: unknown }).cards)) {
    v = (v as { cards: unknown[] }).cards;
  }
  if (!Array.isArray(v)) return null;

  const cards: Card[] = [];
  v.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const front = str(o.front);
    const back = str(o.back);
    if (!front || !back) return;
    let id = str(o.id ?? o.activityItemId ?? o.activity_item_id);
    if (!id) {
      id = `idx-${i}`;
      console.warn(`[go-outside] card ${i} has no id; using "${id}"`);
    }
    cards.push({ id, front, back });
  });
  return cards.length ? cards.slice(0, MAX_CARDS) : null;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function tryJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function looksBase64(s: string): boolean {
  return s.length >= 8 && /^[A-Za-z0-9+/_\-\s]+=*$/.test(s);
}

export function decodeBase64(s: string): string | null {
  // '+' may have become ' ' via form-style decoding.
  let b = s.replace(/ /g, '+').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  b = b.replace(/=+$/, '');
  if (b.length % 4 === 1) return null;
  b += '='.repeat((4 - (b.length % 4)) % 4);
  let bin: string;
  try {
    bin = atob(b);
  } catch {
    return null;
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bin;
  }
}

const ESCAPES: Record<string, string> = {
  n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '\\': '\\', '/': '/', '"': '"', "'": "'",
};

/** Converts a JS object/array literal (bare keys, single quotes, trailing commas) to JSON. No eval. */
export function relaxedToJson(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      let val = '';
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < n) {
          const nx = src[i + 1];
          const hex = src.slice(i + 2, i + 6);
          if (nx === 'u' && /^[0-9a-fA-F]{4}$/.test(hex)) {
            val += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            val += ESCAPES[nx] ?? nx;
            i += 2;
          }
          continue;
        }
        val += src[i++];
      }
      i++; // closing quote
      out += JSON.stringify(val);
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$.\-]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true' || word === 'false' || word === 'null') out += word;
      else if (/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(word)) out += word;
      else out += JSON.stringify(word);
      i = j;
      continue;
    }
    if (ch === ']' || ch === '}') {
      out = out.replace(/,\s*$/, '');
    }
    out += ch;
    i++;
  }
  return out;
}

export const SAMPLE_CARDS: Card[] = [
  { id: 'demo-1', front: 'árbol', back: 'tree' },
  { id: 'demo-2', front: 'pájaro', back: 'bird' },
  { id: 'demo-3', front: 'río', back: 'river' },
  { id: 'demo-4', front: 'cielo', back: 'sky' },
  { id: 'demo-5', front: 'nube', back: 'cloud' },
  { id: 'demo-6', front: 'flor', back: 'flower' },
  { id: 'demo-7', front: 'hoja', back: 'leaf' },
  { id: 'demo-8', front: 'cascada', back: 'waterfall' },
];

export function sampleUrl(cards: Card[] = SAMPLE_CARDS): string {
  return `?cards=${encodeURIComponent(JSON.stringify(cards))}`;
}
