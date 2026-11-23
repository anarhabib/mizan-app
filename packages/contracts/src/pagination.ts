export const tablePageSizes = [10, 25, 50, 100] as const;
export type TablePageSize = (typeof tablePageSizes)[number];

export function parseTablePageSize(value: unknown): TablePageSize | undefined {
  return tablePageSizes.find((size) => String(size) === value);
}
