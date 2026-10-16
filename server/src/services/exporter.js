const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { fmtRange, fmtDate } = require('../lib/time');

const COLUMNS = ['Group No.', 'Title', 'Mentor', 'Panel/Room', 'Time', 'Date'];

// One section per panel, rows in presentation order. Both exports are built
// from this so the PDF and the spreadsheet can never disagree.
function panelSections(groups, settings) {
  return settings.panels.map((panel) => ({
    panel,
    rows: groups
      .filter((g) => g.slot && String(g.slot.panelId) === String(panel._id))
      .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.start - b.slot.start)
      .map((g) => [
        g.groupNo,
        g.title,
        g.mentor.name,
        `${panel.name} / ${panel.room}`,
        fmtRange(g.slot.start, settings.slotMinutes),
        fmtDate(g.slot.date),
      ]),
  }));
}

async function toExcel(groups, settings) {
  const book = new ExcelJS.Workbook();
  const thin = { style: 'thin' };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  for (const { panel, rows } of panelSections(groups, settings)) {
    // Excel rejects these characters in sheet names and caps them at 31.
    const sheet = book.addWorksheet(panel.name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31));
    sheet.columns = [{ width: 11 }, { width: 48 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 20 }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const banner = [settings.institution, settings.eventName, `${panel.name} (Room ${panel.room})`]
      .filter(Boolean);
    banner.forEach((text, i) => {
      const row = sheet.addRow([text]);
      sheet.mergeCells(row.number, 1, row.number, COLUMNS.length);
      row.getCell(1).font = { bold: true, size: i === 0 ? 14 : 12 };
      row.getCell(1).alignment = { horizontal: 'center' };
    });
    sheet.addRow([]);

    const head = sheet.addRow(COLUMNS);
    head.eachCell((c) => {
      c.font = { bold: true };
      c.border = border;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    });
    for (const values of rows) {
      sheet.addRow(values).eachCell((c, col) => {
        c.border = border;
        c.alignment = { vertical: 'middle', wrapText: true, horizontal: col === 2 || col === 3 ? 'left' : 'center' };
      });
    }
  }
  if (!book.worksheets.length) book.addWorksheet('Schedule');
  return book.xlsx.writeBuffer();
}

function toPdf(groups, settings, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 30, autoFirstPage: false });
  doc.pipe(stream);
  const widths = [50, 175, 100, 75, 75, 60]; // sums to the 535pt printable width
  const pad = 4;

  const rowHeight = (cells, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    return Math.max(...cells.map((c, i) => doc.heightOfString(String(c), { width: widths[i] - pad * 2 }))) + pad * 2;
  };
  const drawRow = (cells, y, bold) => {
    const h = rowHeight(cells, bold);
    let x = doc.page.margins.left;
    cells.forEach((c, i) => {
      if (bold) doc.rect(x, y, widths[i], h).fillAndStroke('#d9d9d9', '#000');
      else doc.rect(x, y, widths[i], h).stroke('#000');
      doc.fillColor('#000').text(String(c), x + pad, y + pad, { width: widths[i] - pad * 2 });
      x += widths[i];
    });
    return y + h;
  };

  const sections = panelSections(groups, settings);
  for (const { panel, rows } of sections) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13);
    if (settings.institution) doc.text(settings.institution, { align: 'center' });
    doc.fontSize(11).text(settings.eventName, { align: 'center' });
    doc.text(`${panel.name} (Room ${panel.room})`, { align: 'center' });

    let y = drawRow(COLUMNS, doc.y + 10, true);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(9).text('No groups scheduled for this panel.', doc.page.margins.left, y + 8);
    }
    for (const cells of rows) {
      if (y + rowHeight(cells) > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = drawRow(COLUMNS, doc.page.margins.top, true);
      }
      y = drawRow(cells, y);
    }
  }
  if (!sections.length) {
    doc.addPage();
    doc.fontSize(11).text('No panels configured.');
  }
  doc.end();
}

module.exports = { panelSections, toExcel, toPdf, COLUMNS };
