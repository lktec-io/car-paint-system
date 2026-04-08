import ExcelJS from 'exceljs';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export a simple table to Excel (.xlsx).
 * @param {object}   opts
 * @param {string}   opts.sheetName  - Worksheet name
 * @param {string[]} opts.headers    - Column header labels
 * @param {Array[]}  opts.rows       - Array of row arrays
 * @param {string}  [opts.filename]  - Output filename (without extension)
 * @param {string}  [opts.title]     - Optional title row at the top
 */
export async function exportTableExcel({ sheetName, headers, rows, filename = 'export', title }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Paint Accounting';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName);

  let rowOffset = 0;

  if (title) {
    ws.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
    const titleRow = ws.getRow(1);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'left' };
    titleRow.height = 24;
    rowOffset = 1;
  }

  // Header row
  const headerRow = ws.getRow(rowOffset + 1);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF0F1923' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2ECC71' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF27AE60' } },
    };
  });
  headerRow.height = 18;

  // Data rows
  rows.forEach((row, ri) => {
    const wsRow = ws.getRow(rowOffset + 2 + ri);
    row.forEach((val, ci) => {
      wsRow.getCell(ci + 1).value = val;
      if (ri % 2 === 1) {
        wsRow.getCell(ci + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
      }
    });
    wsRow.height = 16;
  });

  // Auto-fit columns (rough approximation)
  headers.forEach((h, i) => {
    const colVals = [h, ...rows.map(r => String(r[i] ?? ''))];
    const maxLen = Math.max(...colVals.map(v => v.length));
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveBlob(blob, `${filename}.xlsx`);
}

/**
 * Export a multi-section financial report to Excel.
 */
export async function exportReportExcel({ title, sections, filename = 'report' }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  // Title
  ws.mergeCells('A1:B1');
  ws.getRow(1).getCell(1).value = title;
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };
  ws.getRow(1).height = 28;

  let rowIdx = 3;

  for (const section of sections) {
    // Section heading
    ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
    const hdr = ws.getRow(rowIdx);
    hdr.getCell(1).value = section.title;
    hdr.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
    hdr.height = 18;
    rowIdx++;

    // Col headers
    const colHdr = ws.getRow(rowIdx);
    ['Account', 'Amount'].forEach((h, i) => {
      colHdr.getCell(i + 1).value = h;
      colHdr.getCell(i + 1).font = { bold: true };
      colHdr.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F1' } };
    });
    rowIdx++;

    for (const [label, val] of section.rows) {
      const r = ws.getRow(rowIdx);
      r.getCell(1).value = label;
      r.getCell(2).value = val;
      r.getCell(2).alignment = { horizontal: 'right' };
      rowIdx++;
    }

    rowIdx += 2; // blank lines between sections
  }

  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveBlob(blob, `${filename}.xlsx`);
}
