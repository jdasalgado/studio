import * as XLSX from "xlsx";
import { saveFileUniversal } from "./save-file-native";

export interface ExcelSheetData {
  name: string;
  data: (string | number | boolean | null | undefined)[][];
  colWidths?: number[];
}

/**
 * Capitalizes the first letter of each word in a string,
 * while preserving acronyms (ID, QR, URL, TV, etc.), emails, and code identifiers.
 */
export function capitalizeWords(input: string): string {
  if (!input) return "";
  const str = input.trim();
  if (!str) return "";

  // Preserve email addresses and URLs
  if (str.includes("@") && str.includes(".")) return str;
  if (/^https?:\/\//i.test(str)) return str;

  // Preserve already uppercase short codes or IDs (e.g. WORKER-001, EQP-8124, BORROW-2026-...)
  if (/^[A-Z0-9_\-]+$/.test(str) && /[A-Z]/.test(str) && str.length > 2) {
    return str;
  }

  // Preserve dates (YYYY-MM-DD, etc.) and times (10:30 AM)
  if (/^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{1,2}:\d{2}/.test(str)) {
    return str;
  }

  // Convert kebab-case or snake_case statuses like "timed-in", "time-out", "not-yet", "in-progress"
  let formatted = str;
  if (/^[a-z]+(-[a-z]+)+$/i.test(formatted)) {
    formatted = formatted.replace(/-/g, " ");
  }

  // Capitalize first letter of every word
  return formatted.replace(/(^|[\s/([{\-_])([a-z])/g, (_, boundary, letter) => {
    return boundary + letter.toUpperCase();
  });
}

/**
 * Cleanly format an individual cell for Excel export:
 * - Null/undefined becomes "—"
 * - Strings have their first letters cleanly capitalized (e.g. "present" -> "Present", "timed-in" -> "Timed In")
 * - Numbers and booleans are preserved as native Excel values
 */
export function formatExcelCell(val: string | number | boolean | null | undefined): string | number | boolean {
  if (val == null) return "—";
  if (typeof val === "number" || typeof val === "boolean") return val;
  const str = String(val).trim();
  if (str === "" || str === "—" || str === "--" || str === "-") return "—";

  return capitalizeWords(str);
}

/**
 * Exports data to a formatted multi-sheet Excel file (.xlsx) with clean capitalization and column widths.
 */
export function exportToExcel(
  filename: string,
  sheets: ExcelSheetData[]
) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    // Automatically sanitize and capitalize all string cells across the sheet
    const cleanData = sheet.data.map((row) =>
      row.map((cell) => formatExcelCell(cell))
    );

    const ws = XLSX.utils.aoa_to_sheet(cleanData);

    if (sheet.colWidths && sheet.colWidths.length > 0) {
      ws["!cols"] = sheet.colWidths.map((wch) => ({ wch: Math.max(wch, 12) }));
    } else {
      // Auto-calculate column widths from data
      const maxColCounts = Math.max(...cleanData.map((r) => r.length), 0);
      const colWidths: { wch: number }[] = [];

      for (let c = 0; c < maxColCounts; c++) {
        let maxLen = 12;
        for (const row of cleanData) {
          const val = row[c];
          if (val != null) {
            const str = String(val);
            if (str.length > maxLen) {
              maxLen = Math.min(str.length, 50);
            }
          }
        }
        colWidths.push({ wch: maxLen + 3 });
      }
      ws["!cols"] = colWidths;
    }

    // Sheet name in Excel must be <= 31 chars and cannot contain certain chars
    const safeSheetName = (sheet.name || "Sheet1")
      .replace(/[\\/*?:[\]]/g, "_")
      .slice(0, 31);

    XLSX.utils.book_append_sheet(workbook, ws, safeSheetName);
  });

  const finalName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveFileUniversal(
    blob,
    finalName,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
