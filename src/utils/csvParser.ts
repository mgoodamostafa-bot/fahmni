/**
 * CSV Parser & Download Utilities
 * Handles CSV parsing, generation (with BOM for Arabic), and file downloads.
 */

/**
 * Parse a single CSV line respecting quoted fields.
 * Handles commas inside double-quoted strings correctly.
 */
export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

/**
 * Parse full CSV text into headers and rows.
 * Splits by newline, uses the first row as headers, and parses remaining rows.
 */
export const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCSVLine(line));

  return { headers, rows };
};

/**
 * Generate a CSV string from headers and rows.
 * Prepends a UTF-8 BOM (\uFEFF) so Arabic text renders correctly in Excel.
 * Values containing commas, quotes, or newlines are wrapped in double quotes.
 */
export const generateCSV = (
  headers: string[],
  rows: (string | number)[][],
): string => {
  const escapeField = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map((row) => row.map(escapeField).join(','));

  // BOM + header + data
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
};

/**
 * Trigger a CSV file download in the browser.
 */
export const downloadCSV = (
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void => {
  const csv = generateCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Trigger a JSON file download in the browser.
 */
export const downloadJSON = (data: unknown, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
