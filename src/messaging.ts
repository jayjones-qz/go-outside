/**
 * iframe → host contract. One message per correct match:
 *   { source: "go-outside", version: 1, type: "match", activityItemId, elapsedMs, ts }
 */
export interface MatchMessage {
  source: 'go-outside';
  version: 1;
  type: 'match';
  activityItemId: string;
  elapsedMs: number;
  ts: number;
}

const ALLOWED: RegExp[] = [
  /^https:\/\/quizlet\.com$/,
  /^https:\/\/([a-z0-9-]+\.)+quizlet\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
];

export function isAllowedOrigin(origin: string): boolean {
  return origin === window.location.origin || ALLOWED.some((re) => re.test(origin));
}

export function parentOrigin(): string | null {
  if (window.parent === window) return null;
  const ao = window.location.ancestorOrigins;
  if (ao && ao.length > 0) return ao[0];
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function postMatch(activityItemId: string, elapsedMs: number): void {
  const msg: MatchMessage = {
    source: 'go-outside',
    version: 1,
    type: 'match',
    activityItemId,
    elapsedMs: Math.round(elapsedMs),
    ts: Date.now(),
  };
  const origin = parentOrigin();
  if (origin && isAllowedOrigin(origin)) {
    window.parent.postMessage(msg, origin);
  } else {
    console.debug('[go-outside] match not posted (no allowed parent origin)', { origin, msg });
  }
  if (import.meta.env.DEV) console.debug('[go-outside] match', msg);
}
