/**
 * CSV Export Utility
 * Generates and downloads CSV files from data arrays
 */

export interface CsvColumn<T> {
  header: string;
  accessor: keyof T | ((item: T) => string | number);
  formatter?: (value: unknown) => string;
}

/**
 * Convert data to CSV string
 */
export function toCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  if (data.length === 0) return '';

  // BOM for Arabic support in Excel
  const BOM = '\uFEFF';

  // Escape CSV field
  const escapeField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  // Header row
  const headers = columns.map((col) => escapeField(col.header)).join(',');

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const value = typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor];

        const formatted = col.formatter ? col.formatter(value) : String(value ?? '');
        return escapeField(formatted);
      })
      .join(',');
  });

  return BOM + headers + '\n' + rows.join('\n');
}

/**
 * Download CSV file
 */
export function downloadCsv<T>(data: T[], columns: CsvColumn<T>[], filename: string): void {
  const csv = toCsv(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Format date for CSV export
 */
export function formatDateForCsv(date: Date | { seconds: number } | string | null | undefined): string {
  if (!date) return '';
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = new Date(date.seconds * 1000);
  }
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format number for CSV export
 */
export function formatNumberForCsv(value: number | undefined): string {
  return value != null ? String(value) : '';
}
