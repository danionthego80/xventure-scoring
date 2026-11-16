'use client';

// Browser-side stand-in for the Supabase client, used by the admin pages only.
// It records the query (e.g. .from('mg_games').update({...}).eq('id', x)) and
// sends it to /api/admin/db, which runs it on the server after checking the
// admin is signed in. Same calling style as supabase-js, so pages barely change.

type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

class AdminQuery implements PromiseLike<Result> {
  private ops: any[][] = [];
  constructor(private table: string) {}

  private add(method: string, args: any[]) {
    this.ops.push([method, ...args]);
    return this;
  }

  select(...a: any[]) { return this.add('select', a); }
  insert(...a: any[]) { return this.add('insert', a); }
  update(...a: any[]) { return this.add('update', a); }
  upsert(...a: any[]) { return this.add('upsert', a); }
  delete(...a: any[]) { return this.add('delete', a); }
  eq(...a: any[]) { return this.add('eq', a); }
  neq(...a: any[]) { return this.add('neq', a); }
  in(...a: any[]) { return this.add('in', a); }
  is(...a: any[]) { return this.add('is', a); }
  order(...a: any[]) { return this.add('order', a); }
  limit(...a: any[]) { return this.add('limit', a); }
  single() { return this.add('single', []); }
  maybeSingle() { return this.add('maybeSingle', []); }

  private async run(): Promise<Result> {
    const isWrite = this.ops.some(op => WRITE_METHODS.has(op[0]));
    let result: Result;
    try {
      const res = await fetch('/api/admin/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ table: this.table, ops: this.ops }),
      });
      if (res.status === 401) {
        window.alert('Your admin session has expired. Please sign in again.');
        window.location.href = '/admin';
        return { data: null, error: { message: 'Not signed in' } };
      }
      result = await res.json();
    } catch (e: any) {
      result = { data: null, error: { message: e?.message || 'Network error' } };
    }
    // Never fail silently: tell the admin if a change did not save.
    if (result.error && isWrite) {
      window.alert('That change did not save: ' + result.error.message);
    }
    return result;
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export const adminDb = {
  from(table: string) {
    return new AdminQuery(table);
  },
};
