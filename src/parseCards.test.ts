import { describe, expect, it } from 'vitest';
import { loadCardsFromLocation, parseCardsText, relaxedToJson } from './parseCards';

const cards = [
  { id: '101', front: 'perro', back: 'dog' },
  { id: '102', front: 'gato', back: 'cat' },
];
const json = JSON.stringify(cards);
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const load = (search: string, hash = '') => loadCardsFromLocation({ search, hash });

describe('parseCardsText', () => {
  it('parses strict JSON', () => {
    expect(parseCardsText(json)).toEqual(cards);
  });

  it('parses the host literal format (bare keys, numeric id)', () => {
    expect(parseCardsText('[{id:101,front:"perro", back:"dog"},{id:102,front:"gato", back:"cat"}]')).toEqual(cards);
  });

  it('parses single quotes, bare string ids, trailing commas', () => {
    expect(parseCardsText("[{id:abc-1,front:'it\\'s', back:'yes',},]")).toEqual([
      { id: 'abc-1', front: "it's", back: 'yes' },
    ]);
  });

  it('accepts a {cards:[...]} wrapper', () => {
    expect(parseCardsText(JSON.stringify({ cards }))).toEqual(cards);
  });

  it('drops invalid items and caps at 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: i, front: `f${i}`, back: `b${i}` }));
    const input = JSON.stringify([{ id: 'x', front: '', back: 'b' }, 'nope', ...many]);
    const out = parseCardsText(input)!;
    expect(out).toHaveLength(10);
    expect(out[0]).toEqual({ id: '0', front: 'f0', back: 'b0' });
  });

  it('returns null for garbage', () => {
    expect(parseCardsText('hello world')).toBeNull();
    expect(parseCardsText('[1,2,3]')).toBeNull();
    expect(parseCardsText('')).toBeNull();
  });

  it('relaxedToJson leaves valid JSON semantics intact', () => {
    expect(JSON.parse(relaxedToJson(json))).toEqual(cards);
  });
});

describe('loadCardsFromLocation', () => {
  it('reads URL-encoded JSON', () => {
    expect(load(`?cards=${encodeURIComponent(json)}`).cards).toEqual(cards);
  });

  it('reads double-encoded JSON', () => {
    expect(load(`?cards=${encodeURIComponent(encodeURIComponent(json))}`).cards).toEqual(cards);
  });

  it('keeps literal + in unencoded text', () => {
    const c = [{ id: '1', front: '1+1', back: '2' }];
    expect(load(`?cards=${JSON.stringify(c)}`).cards).toEqual(c);
  });

  it('reads base64 with unicode', () => {
    const c = [{ id: '1', front: 'árbol 🌳', back: '木' }];
    expect(load(`?cards=${b64(JSON.stringify(c))}`).cards).toEqual(c);
  });

  it('reads URL-safe base64 without padding', () => {
    const s = b64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(load(`?cards=${s}`).cards).toEqual(cards);
  });

  it('reads base64 of URL-encoded JSON (btoa(encodeURIComponent(x)))', () => {
    expect(load(`?cards=${b64(encodeURIComponent(json))}`).cards).toEqual(cards);
  });

  it('reads base64 of the literal format', () => {
    expect(load(`?cards=${b64('[{id:101,front:"perro",back:"dog"}]')}`).cards).toEqual([cards[0]]);
  });

  it('tolerates unencoded & in text', () => {
    const c = [{ id: '1', front: 'salt & pepper', back: 'sal y pimienta' }];
    expect(load(`?cards=${JSON.stringify(c)}`).cards).toEqual(c);
  });

  it('reports missing and unparseable', () => {
    expect(load('').error).toBe('missing');
    expect(load('?cards=%%%nope').error).toBe('unparseable');
  });
});
