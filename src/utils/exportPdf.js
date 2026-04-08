import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export a table to PDF.
 * @param {object} opts
 * @param {string}   opts.title       - Document title
 * @param {string[]} opts.headers     - Column header labels
 * @param {Array[]}  opts.rows        - Array of row arrays (already formatted strings)
 * @param {string}  [opts.filename]   - Output filename (without extension)
 * @param {string}  [opts.subtitle]   - Optional subtitle / date range text
 */
export function exportTablePdf({ title, headers, rows, filename = 'export', subtitle }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 18);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(subtitle, 14, 25);
    doc.setTextColor(0);
  }

  const startY = subtitle ? 30 : 24;

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [46, 204, 113], textColor: [15, 25, 35], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Export a financial report (two-column: label + amount) to PDF.
 */
export function exportReportPdf({ title, sections, filename = 'report', subtitle }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(subtitle, 14, 28);
    doc.setTextColor(0);
  }

  let y = subtitle ? 36 : 28;

  for (const section of sections) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, 14, y);
    y += 4;

    autoTable(doc, {
      head: [['Account', 'Amount']],
      body: section.rows,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [52, 73, 94], textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  doc.save(`${filename}.pdf`);
}
