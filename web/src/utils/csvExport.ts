/**
 * Generate and download a CSV file from data rows.
 * Adds UTF-8 BOM for Excel compatibility.
 */
export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF';
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
