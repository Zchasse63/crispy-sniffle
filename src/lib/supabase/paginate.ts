/**
 * PostgREST silently caps a single response at 1000 rows. Callers that need
 * the full set must page via `.range()` with a stable `.order(...)` so pages
 * never skip or overlap. This helper is the one implementation of that loop.
 *
 * `makeQuery(from, to)` must return a thenable that resolves to
 * `{ data, error }` — typically a PostgREST builder already chained with
 * filters + a stable order, then `.range(from, to)`.
 */
const PAGE = 1000;

export type PageResult<T> = {
  data: T[] | null;
  error: unknown;
};

export async function paginateAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export const PAGE_SIZE = PAGE;
