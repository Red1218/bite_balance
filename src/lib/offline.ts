// Offline support for every table read and write, done once in the Supabase client's fetch:
// - Reads (/rest/v1 GET/HEAD) are cached; with no connection the last copy is served.
// - Writes with no connection, or while older offline writes still wait, go into an outbox, get a
//   stand-in success reply, and are sent in order once the connection is back.
// - Waiting writes are laid over every read (offlineOverlay.ts), so screens show them at once.
// Edge functions (AI logging, voice) and sign-in pass straight through and fail offline as before.
import { Network } from '@capacitor/network';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import { applyPending, filtersOf, matches, tableOf, toRows, withDefaults, type PendingWrite, type Row } from './offlineOverlay';

const OUTBOX = 'bb:outbox';
const CACHE = 'bb:cache:';
const CACHE_INDEX = 'bb:cache-index';
const MAX_CACHED = 150;
const MAX_BODY = 300_000; // skip caching big one-off reads such as the data export
// ponytail: fixed timeout; a write that timed out but did reach the server is still safe to resend
// (inserts carry their own id, so a repeat is rejected as a duplicate and dropped).
const TIMEOUT_MS = 12_000;
const NO_ID = new Set(['checklist_checks']); // keyed by (item_id, checked_date), no id column

const read = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const outbox: PendingWrite[] = read(OUTBOX, []);

// ---- status, for the offline pill ----
// From the Network plugin: Android's WebView can keep navigator.onLine true in Airplane mode.
let status = { online: true, pending: outbox.length };
const listeners = new Set<() => void>();
const publish = (online = status.online) => {
  if (online === status.online && outbox.length === status.pending) return;
  status = { online, pending: outbox.length };
  listeners.forEach((l) => l());
  if (online && outbox.length) void flush();
};
export const offlineStatus = () => status;
export const onOfflineStatus = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

// ---- read cache (localStorage, oldest dropped past MAX_CACHED) ----
interface Cached {
  status: number;
  headers: Record<string, string>;
  body: string;
}
const cacheIndex: Record<string, number> = read(CACHE_INDEX, {});
const dropOldest = (n: number) => {
  for (const key of Object.keys(cacheIndex).sort((a, b) => cacheIndex[a] - cacheIndex[b]).slice(0, n)) {
    localStorage.removeItem(key);
    delete cacheIndex[key];
  }
};
const putCache = (key: string, entry: Cached) => {
  if (entry.body.length > MAX_BODY) return;
  if (!write(key, entry)) {
    dropOldest(20);
    if (!write(key, entry)) return;
  }
  cacheIndex[key] = Date.now();
  const extra = Object.keys(cacheIndex).length - MAX_CACHED;
  if (extra > 0) dropOldest(extra);
  write(CACHE_INDEX, cacheIndex);
};

/** Every cached row of a table (null if none is cached), optionally with waiting writes applied. */
const knownRows = (table: string, pending = true): Row[] | null => {
  const byId = new Map<unknown, Row>();
  let seen = false;
  for (const key of Object.keys(cacheIndex)) {
    if (!key.includes(`/rest/v1/${table}?`)) continue;
    seen = true;
    const entry = read<Cached | null>(key, null);
    try {
      for (const r of toRows(entry?.body || null)) byId.set(r.id ?? byId.size, r);
    } catch {
      /* not JSON rows (a count); skip */
    }
  }
  if (!seen) return null;
  return pending ? applyPending([...byId.values()], new URL(`https://x/rest/v1/${table}`), outbox) : [...byId.values()];
};

export const clearOfflineData = () => {
  outbox.length = 0;
  localStorage.removeItem(OUTBOX);
  dropOldest(Infinity);
  localStorage.removeItem(CACHE_INDEX);
  publish();
};

// ---- network ----
const isNetworkError = (e: unknown, init?: RequestInit) =>
  !init?.signal?.aborted && (e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError'));

const send = (url: string, init: RequestInit | undefined, body: BodyInit | null | undefined) =>
  fetch(url, { ...init, body, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) });

const reply = (statusCode: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
  });

const overlay = (text: string, u: URL) => {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return JSON.stringify(applyPending(parsed, u, outbox));
  return JSON.stringify(applyPending([parsed], u, outbox)[0] ?? parsed);
};

const cachedRead = async (url: string, u: URL, method: string, headers: Headers, init?: RequestInit) => {
  const key = `${CACHE}${method} ${url} ${headers.get('accept') ?? ''} ${headers.get('prefer') ?? ''}`;
  let entry: Cached;
  try {
    const res = await send(url, init, undefined);
    publish(true);
    entry = {
      status: res.status,
      headers: Object.fromEntries(['content-type', 'content-range'].flatMap((h) => (res.headers.get(h) ? [[h, res.headers.get(h)!]] : []))),
      body: method === 'HEAD' ? '' : await res.text(),
    };
    if (res.ok) putCache(key, entry);
  } catch (e) {
    if (!isNetworkError(e, init)) throw e;
    publish(false);
    const cached = read<Cached | null>(key, null);
    if (cached) entry = cached;
    else {
      // This exact read never ran online (a new day's habits): answer it from the rows other reads
      // of the table returned, plus offline changes. Columns a row was read without don't count.
      const table = tableOf(u);
      const seen = knownRows(table, false);
      const hasChanges = outbox.some((w) => tableOf(new URL(w.url)) === table);
      if (method !== 'GET' || headers.get('accept')?.includes('vnd.pgrst.object') || (!seen && !hasChanges)) throw e;
      const rows = (seen ?? []).filter((r) => matches(r, filtersOf(u).filter(([c]) => c in r)));
      entry = { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(rows) };
    }
  }
  let body = entry.body;
  if (outbox.length && entry.status < 300 && body) body = overlay(body, u);
  return new Response(method === 'HEAD' || entry.status === 204 ? null : body, { status: entry.status, headers: entry.headers });
};

const queue = (w: PendingWrite, u: URL, headers: Headers) => {
  const wantsRows = headers.get('prefer')?.includes('return=representation');
  let rows: Row[] = [];
  if (wantsRows && w.method === 'POST') rows = toRows(w.body).map(withDefaults);
  if (wantsRows && w.method === 'PATCH') {
    const patch = JSON.parse(w.body ?? '{}');
    rows = (knownRows(tableOf(u)) ?? [])
      .filter((r) => matches(r, filtersOf(u)))
      .map((r) => ({ ...r, ...patch }));
    // Can't show the edited row without having seen it, so let the screen report the failure.
    if (!rows.length) throw new TypeError('Failed to fetch');
  }
  outbox.push(w);
  if (!write(OUTBOX, outbox)) {
    outbox.pop();
    throw new TypeError('Failed to fetch');
  }
  publish();
  if (!wantsRows) return reply(w.method === 'POST' ? 201 : 204);
  const one = headers.get('accept')?.includes('vnd.pgrst.object');
  return reply(w.method === 'POST' ? 201 : 200, one ? rows[0] : rows);
};

let getToken: () => Promise<string | undefined> = async () => undefined;
let flushing: Promise<void> | null = null;

/** Sends waiting writes in order; stops at the first one that can't go yet. */
export const flush = (): Promise<void> =>
  (flushing ??= (async () => {
    try {
      while (outbox.length) {
        const w = outbox[0];
        const token = await getToken();
        let res: Response;
        try {
          res = await fetch(w.url, {
            method: w.method,
            headers: token ? { ...w.headers, authorization: `Bearer ${token}` } : w.headers,
            body: w.body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch {
          publish(false);
          return;
        }
        if (!res.ok) {
          if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) return; // try again later
          const detail = await res.text();
          // 23505: the row is already there (an earlier send got through), so it's done.
          if (!detail.includes('23505')) {
            console.error('Dropped an offline change', w, detail);
            toast({ title: 'Error', description: 'A change made offline could not be saved.', variant: 'destructive' });
          }
        }
        outbox.shift();
        write(OUTBOX, outbox);
        publish(true);
      }
    } finally {
      flushing = null;
    }
  })());

/** The Supabase client's fetch. */
export const offlineFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/rest/v1/')) return fetch(input, init);
  const u = new URL(url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (method === 'GET' || method === 'HEAD') return cachedRead(url, u, method, headers, init);

  // New rows get their id here, so a row logged offline can be edited or undone before it syncs.
  let body = typeof init?.body === 'string' ? init.body : null;
  if (method === 'POST' && body && !u.searchParams.has('on_conflict') && !NO_ID.has(tableOf(u))) {
    const rows = toRows(body).map((r) => ({ id: crypto.randomUUID(), ...r }));
    body = JSON.stringify(body.trimStart().startsWith('[') ? rows : rows[0]);
    // Bulk inserts list their columns in the URL; make sure id is among them.
    const cols = u.searchParams.get('columns');
    if (cols && !cols.split(',').includes('"id"') && !cols.split(',').includes('id')) u.searchParams.set('columns', `${cols},"id"`);
  }

  if (!outbox.length) {
    try {
      const res = await send(u.href, init, body);
      publish(true);
      return res;
    } catch (e) {
      if (!isNetworkError(e, init)) throw e;
      publish(false);
    }
  }
  return queue({ url: u.href, method, headers: Object.fromEntries(headers), body }, u, headers);
};

/**
 * Session storage for the Supabase client. Offline, an expired session would make Supabase retry
 * its token refresh for ~30 s before every table call, so while offline the saved session reads
 * as still valid; reads then come straight from the cache. Back online it reads as saved and
 * Supabase refreshes it as usual.
 * ponytail: goes by whether the phone has a network, so on Wi-Fi with no internet the 30 s wait
 * still happens.
 */
export const offlineAuthStorage = {
  getItem: async (key: string) => {
    const saved = localStorage.getItem(key);
    if (!saved || (await Network.getStatus()).connected) return saved;
    try {
      const session = JSON.parse(saved);
      if (typeof session?.expires_at !== 'number') return saved;
      return JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    } catch {
      return saved;
    }
  },
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

/** Wires the outbox to the signed-in session; called once by the Supabase client. */
export const attachOffline = (client: SupabaseClient) => {
  getToken = async () => (await client.auth.getSession()).data.session?.access_token;
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') clearOfflineData();
  });
  void Network.getStatus().then((s) => publish(s.connected));
  void Network.addListener('networkStatusChange', (s) => publish(s.connected));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && outbox.length) void flush();
  });
  if (outbox.length) void flush();
};
