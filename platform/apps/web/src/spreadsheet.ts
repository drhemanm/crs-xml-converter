export type SpreadsheetRow = Record<string, string>;

export interface ParsedSheet {
  name: string;
  rows: SpreadsheetRow[];
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function rowsFromMatrix(matrix: readonly (readonly unknown[])[], name: string): ParsedSheet {
  const nonEmpty = matrix.filter((row) => row.some((cell) => cellToString(cell) !== ""));
  if (nonEmpty.length === 0) return { name, rows: [] };

  const headers = nonEmpty[0]!.map((cell) => cellToString(cell));
  if (headers.some((h) => !h)) {
    throw new Error(`Sheet "${name}" contains a blank column heading.`);
  }
  const duplicates = headers.filter((h, i) => headers.indexOf(h) !== i);
  if (duplicates.length) {
    throw new Error(`Sheet "${name}" contains duplicate headings: ${[...new Set(duplicates)].join(", ")}.`);
  }

  const rows = nonEmpty.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, i) => [header, cellToString(cells[i])])) as SpreadsheetRow,
  );
  return { name, rows };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than the 20 MB upload limit.`);
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const { parse } = await import("csv-parse/browser/esm/sync");
    const rows = parse(await file.text(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as SpreadsheetRow[];
    return [{ name: file.name, rows }];
  }

  if (lower.endsWith(".xlsx")) {
    const { default: readWorkbook } = await import("read-excel-file/browser");
    const sheets = await readWorkbook(file);
    return sheets.map((sheet) => rowsFromMatrix(sheet.data, sheet.sheet));
  }

  if (lower.endsWith(".xls")) {
    throw new Error("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV and try again.");
  }

  throw new Error("Unsupported file type. Upload CSV or XLSX.");
}

export function firstUsableSheet(sheets: readonly ParsedSheet[]): ParsedSheet {
  const sheet = sheets.find((s) => s.rows.length > 0);
  if (!sheet) throw new Error("The workbook contains no data rows.");
  return sheet;
}
