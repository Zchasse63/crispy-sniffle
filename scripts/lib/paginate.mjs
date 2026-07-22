/**
 * PostgREST silently caps a single response at 1000 rows. Loader scripts that
 * read unbounded tables must page via `.range()` with a stable `.order(...)`.
 * Mirror of src/lib/supabase/paginate.ts for Node ESM loaders.
 *
 * `makeQuery(from, to)` must return a thenable resolving to `{ data, error }`
 * — typically a PostgREST builder already filtered + ordered, then `.range()`.
 */
const PAGE = 1000;

export async function paginateAll(makeQuery) {
  const out = [];
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
