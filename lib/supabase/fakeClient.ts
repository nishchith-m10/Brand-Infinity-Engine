// Minimal in-memory fake supabase client used for tests when real env vars are not available.

const globalAny: any = globalThis as any;
if (!globalAny.__FAKE_SUPABASE_DB__) globalAny.__FAKE_SUPABASE_DB__ = new Map();
const sharedDb: Map<string, any[]> = globalAny.__FAKE_SUPABASE_DB__;

class QueryBuilder {
  table: string;
  db: Map<string, any[]>;
  action: 'select' | 'insert' | 'delete' | 'update' | null = null;
  payload: any = null;
  filters: Array<{ type: 'eq' | 'like'; field: string; value: any }> = [];
  orderBy: { field: string; ascending?: boolean } | null = null;

  constructor(table: string, db: Map<string, any[]>) {
    this.table = table;
    this.db = db;
  }

  select() {
    this.action = 'select';
    return this;
  }

  insert(payload: any) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  update(payload: any) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  like(field: string, pattern: string) {
    this.filters.push({ type: 'like', field, value: pattern });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ type: 'in', field, value: values });
    return this;
  }

  order(field: string, opts: { ascending?: boolean }) {
    this.orderBy = { field, ascending: opts?.ascending };
    return this;
  }

  single() {
    this.action = this.action ?? 'select';
    return this.thenable(true);
  }

  thenable(single = false) {
    const self = this;
    const exec = async () => {
      const tableArr = self.db.get(self.table) ?? [];
      let rows = tableArr.slice();

      for (const f of self.filters) {
        if (f.type === 'eq') {
          rows = rows.filter(r => r[f.field] === f.value);
        } else if (f.type === 'like') {
          const pat = String(f.value).replace(/%/g, '.*');
          const re = new RegExp(pat);
          rows = rows.filter(r => re.test(String(r[f.field] ?? '')));
        } else if (f.type === 'in') {
          rows = rows.filter(r => (f.value as any[]).includes(r[f.field]));
        }
      }

      if (self.action === 'select') {
        if (self.orderBy) {
          rows.sort((a, b) => (a[self.orderBy!.field] > b[self.orderBy!.field] ? 1 : -1));
          if (!self.orderBy!.ascending) rows.reverse();
        }
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      }

      if (self.action === 'insert') {
        const payloads = Array.isArray(self.payload) ? self.payload : [self.payload];
        const inserted = payloads.map(p => {
          const row = { ...p };
          if (!row.id) row.id = `${self.table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          tableArr.push(row);
          return row;
        });
        self.db.set(self.table, tableArr);
        return { data: inserted, error: null };
      }

      if (self.action === 'delete') {
        const toDelete = rows.slice();
        const remaining = tableArr.filter(r => !toDelete.includes(r));
        self.db.set(self.table, remaining);
        return { data: toDelete, error: null };
      }

      if (self.action === 'update') {
        const updated: any[] = [];
        for (const row of tableArr) {
          const match = self.filters.every(f => (f.type === 'eq' ? row[f.field] === f.value : false));
          if (match) {
            Object.assign(row, self.payload);
            updated.push(row);
          }
        }
        self.db.set(self.table, tableArr);
        return { data: updated, error: null };
      }

      return { data: null, error: null };
    };

    // Return a thenable
    return {
      then: (resolve: any, reject: any) => {
        exec().then(resolve).catch(reject);
      },
    } as any;
  }

  // allow awaiting directly
  then(resolve: any, reject: any) {
    return this.thenable().then(resolve, reject);
  }
}

export function createFakeSupabaseClient() {
  return {
    from(table: string) {
      if (!sharedDb.has(table)) sharedDb.set(table, []);
      return new QueryBuilder(table, sharedDb) as any;
    },
  } as any;
}

export function clearFakeDb() {
  sharedDb.clear();
}
