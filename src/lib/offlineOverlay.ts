// Lays writes that haven't reached the server yet over rows read from it (or from the offline
// cache), so screens show offline changes straight away. Understands the PostgREST URL filters
// the app uses (eq, neq, gt/gte/lt/lte, in, is, like/ilike); a filter it can't read never
// matches, so an offline insert stays out of a query it can't place rather than showing wrongly.

export type Row = Record<string, unknown>;
export interface PendingWrite {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

export const tableOf = (u: URL) => u.pathname.split('/rest/v1/')[1] ?? '';
export const filtersOf = (u: URL) => [...u.searchParams].filter(([k]) => !NOT_FILTERS.has(k));

const cmp = (a: unknown, b: string) => {
  const x = Number(a);
  const y = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  const s = String(a);
  return s < b ? -1 : s > b ? 1 : 0;
};

const test = (row: Row, col: string, expr: string) => {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const val = expr.slice(dot + 1);
  const v = row[col];
  switch (op) {
    case 'eq': return v != null && String(v) === val;
    case 'neq': return v != null && String(v) !== val;
    case 'gt': return v != null && cmp(v, val) > 0;
    case 'gte': return v != null && cmp(v, val) >= 0;
    case 'lt': return v != null && cmp(v, val) < 0;
    case 'lte': return v != null && cmp(v, val) <= 0;
    case 'in': return val.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
    case 'is': return val === 'null' ? v == null : String(v) === val;
    case 'like':
    case 'ilike': {
      const re = val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*');
      return v != null && new RegExp(`^${re}$`, op === 'ilike' ? 'i' : '').test(String(v));
    }
    default: return false;
  }
};

export const matches = (row: Row, filters: [string, string][]) => filters.every(([c, e]) => test(row, c, e));

export const toRows = (body: string | null): Row[] => {
  if (!body) return [];
  const parsed = JSON.parse(body);
  return Array.isArray(parsed) ? parsed : [parsed];
};

// Columns the database would fill in; only used for display until the real row comes back.
export const withDefaults = (row: Row): Row => {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now, logged_at: now, ...row };
};

/** `rows` from a read of `readUrl`, with every pending write on the same table applied in order. */
export const applyPending = (rows: Row[], readUrl: URL, pending: PendingWrite[]): Row[] => {
  const table = tableOf(readUrl);
  const filters = filtersOf(readUrl);
  // A read may select only some columns (water reads just `glasses`); the ones it pins with eq
  // are known for every row it returns, so fill them in before matching writes against rows.
  const pins = Object.fromEntries(filters.filter(([, e]) => e.startsWith('eq.')).map(([c, e]) => [c, e.slice(3)]));
  const full = (r: Row) => ({ ...pins, ...r });
  let out = rows;
  let changed = false;
  for (const w of pending) {
    const u = new URL(w.url);
    if (tableOf(u) !== table) continue;
    changed = true;
    const f = filtersOf(u);
    if (w.method === 'DELETE') out = out.filter((r) => !matches(full(r), f));
    else if (w.method === 'PATCH') {
      const patch = JSON.parse(w.body ?? '{}');
      out = out.map((r) => (matches(full(r), f) ? { ...r, ...patch } : r));
    } else if (w.method === 'POST') {
      const keys = u.searchParams.get('on_conflict')?.split(',');
      out = [...out];
      for (const rec of toRows(w.body)) {
        const i = keys ? out.findIndex((r) => keys.every((k) => String(full(r)[k]) === String(rec[k]))) : -1;
        if (i >= 0) out[i] = { ...out[i], ...rec };
        else if (matches(rec, filters)) out.push(withDefaults(rec));
      }
    }
  }
  if (!changed) return rows;

  // Keep the read's order (first key only) and limit, so a new row lands where the server would put it.
  const order = readUrl.searchParams.get('order');
  if (order) {
    const [col, dir] = order.split(',')[0].split('.');
    const sign = dir === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => sign * cmp(a[col] ?? '', String(b[col] ?? '')));
  }
  const limit = Number(readUrl.searchParams.get('limit'));
  return limit > 0 ? out.slice(0, limit) : out;
};
