import { describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, paginateAll } from "./paginate";

describe("paginateAll", () => {
  it("returns all rows across 3 pages for 2,500 rows", async () => {
    const total = 2500;
    const ranges: Array<[number, number]> = [];
    const rows = await paginateAll<{ id: number }>((from, to) => {
      ranges.push([from, to]);
      const page: { id: number }[] = [];
      for (let i = from; i <= to && i < total; i++) page.push({ id: i });
      return Promise.resolve({ data: page, error: null });
    });
    expect(rows).toHaveLength(total);
    expect(rows[0].id).toBe(0);
    expect(rows[total - 1].id).toBe(total - 1);
    // 1000 + 1000 + 500 → three range calls
    expect(ranges).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, 2 * PAGE_SIZE - 1],
      [2 * PAGE_SIZE, 3 * PAGE_SIZE - 1],
    ]);
  });

  it("terminates on a short page without a trailing empty fetch", async () => {
    const calls: Array<[number, number]> = [];
    const rows = await paginateAll<string>((from, to) => {
      calls.push([from, to]);
      // First page full, second short → stop (no third call)
      if (from === 0) {
        return Promise.resolve({
          data: Array.from({ length: PAGE_SIZE }, (_, i) => `r${i}`),
          error: null,
        });
      }
      return Promise.resolve({ data: ["tail-a", "tail-b"], error: null });
    });
    expect(rows).toHaveLength(PAGE_SIZE + 2);
    expect(calls).toHaveLength(2);
  });

  it("propagates query errors", async () => {
    const boom = { message: "postgrest down", code: "PGRST000" };
    await expect(
      paginateAll(() => Promise.resolve({ data: null, error: boom })),
    ).rejects.toEqual(boom);
  });

  it("returns [] when the first page is empty", async () => {
    const rows = await paginateAll(() =>
      Promise.resolve({ data: [], error: null }),
    );
    expect(rows).toEqual([]);
  });
});
