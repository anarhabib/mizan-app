import { parseTablePageSize, tablePageSizes } from "@mizan/contracts";
import { describe, expect, it } from "vitest";
import { moveCursor } from "./useCursorPagination";

describe("table pagination", () => {
  it("defaults to 10 and recognizes the four supported page sizes", () => {
    expect(tablePageSizes[0]).toBe(10);
    expect(
      tablePageSizes.map((size) => parseTablePageSize(String(size))),
    ).toEqual([10, 25, 50, 100]);
    expect(parseTablePageSize("11")).toBeUndefined();
    expect(parseTablePageSize(["10", "25"])).toBeUndefined();
  });

  it("reuses the preceding cursor and ignores duplicate cursors", () => {
    const first = moveCursor([], "opaque+/?=");
    const second = moveCursor(first, "next");
    expect(moveCursor(second)).toEqual(first);
    expect(moveCursor(second, "opaque+/?=")).toBe(second);
    expect(moveCursor(moveCursor(second))).toEqual([]);
  });
});
