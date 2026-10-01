import PDFDocument from 'pdfkit';
import { toBuffer as qrToBuffer } from 'qrcode';

export interface CertificateDetails {
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  lessonCount: number;
  /** Total video length in seconds. */
  durationSeconds: number;
  verifyUrl: string;
  signerName: string;
  signerTitle: string;
}

const NAVY = '#0B1F4D';
const BLUE = '#1D4ED8';
const GOLD = '#B8892B';
const GOLD_LIGHT = '#E9D29A';
const INK = '#1F2937';
const MUTED = '#6B7280';
const PAPER = '#FFFDF7';

/** "12.5 hours" / "45 minutes" of video, or '' when unknown. */
export function formatCourseLength(seconds: number): string {
  const minutes = Math.round((Number(seconds) || 0) / 60);
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function formatIssueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/**
 * Draws the completion certificate as a one-page A4 landscape PDF: double
 * border, title, student name, course, length, issue date, a seal, the
 * signature line and a QR code that opens the public verification page.
 * Uses the PDF standard fonts, so nothing has to be shipped with the API.
 */
export async function renderCertificatePdf(details: CertificateDetails): Promise<Buffer> {
  const qr = await qrToBuffer(details.verifyUrl, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: 'M',
    color: { dark: NAVY, light: '#FFFFFF' },
  });

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: {
      Title: `Certificate of Completion – ${details.courseTitle}`,
      Author: 'Technyks Academy',
      Subject: `Certificate ${details.certificateNumber}`,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const W = doc.page.width; // 841.89
  const H = doc.page.height; // 595.28
  const centerX = W / 2;

  // Paper and borders.
  doc.rect(0, 0, W, H).fill(PAPER);
  doc.lineWidth(14).strokeColor(NAVY).rect(18, 18, W - 36, H - 36).stroke();
  doc.lineWidth(1.5).strokeColor(GOLD).rect(34, 34, W - 68, H - 68).stroke();
  doc.lineWidth(0.6).strokeColor(GOLD_LIGHT).rect(40, 40, W - 80, H - 80).stroke();
  for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) {
    drawDiamond(doc, x, y, 9, GOLD);
  }

  // Brand mark and name.
  const markSize = 30;
  const brand = 'TECHNYKS ACADEMY';
  doc.font('Helvetica-Bold').fontSize(13);
  const brandWidth = doc.widthOfString(brand, { characterSpacing: 4 });
  const groupWidth = markSize + 12 + brandWidth;
  const markX = centerX - groupWidth / 2;
  const markY = 66;
  doc.roundedRect(markX, markY, markSize, markSize, 7).fill(BLUE);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
    .text('T', markX, markY + 6.5, { width: markSize, align: 'center', lineBreak: false });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
    .text(brand, markX + markSize + 12, markY + 9, { characterSpacing: 4, lineBreak: false });

  // Title.
  doc.fillColor(NAVY).font('Times-Bold').fontSize(40)
    .text('CERTIFICATE', 0, 118, { width: W, align: 'center', characterSpacing: 6 });
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(13)
    .text('OF COMPLETION', 0, 164, { width: W, align: 'center', characterSpacing: 7 });
  ornamentRule(doc, centerX, 192, 110);

  // Recipient.
  doc.fillColor(MUTED).font('Helvetica').fontSize(12)
    .text('This is to certify that', 0, 212, { width: W, align: 'center' });
  const nameSize = fitFontSize(doc, 'Times-BoldItalic', details.studentName, 520, 40, 22);
  doc.fillColor(INK).font('Times-BoldItalic').fontSize(nameSize)
    .text(details.studentName, 60, 252 - nameSize / 2 + 8, { width: W - 120, align: 'center', lineBreak: false });
  doc.lineWidth(0.8).strokeColor(GOLD)
    .moveTo(centerX - 210, 290).lineTo(centerX + 210, 290).stroke();

  // Course.
  doc.fillColor(MUTED).font('Helvetica').fontSize(12)
    .text('has successfully completed the online course', 0, 304, { width: W, align: 'center' });
  const titleSize = fitFontSize(doc, 'Times-Bold', details.courseTitle, 600, 24, 14);
  const titleTop = 326;
  doc.fillColor(NAVY).font('Times-Bold').fontSize(titleSize)
    .text(details.courseTitle, 110, titleTop, { width: W - 220, align: 'center' });
  const titleBottom = Math.max(doc.y, titleTop + titleSize + 4);

  const facts = [
    details.lessonCount > 0 ? `${details.lessonCount} lessons` : '',
    formatCourseLength(details.durationSeconds)
      ? `${formatCourseLength(details.durationSeconds)} of video`
      : '',
  ].filter(Boolean).join('  •  ');
  if (facts) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(10.5)
      .text(facts, 0, titleBottom + 6, { width: W, align: 'center' });
  }

  // Footer: date (left), seal (center), signature (right).
  const footerLineY = 462;
  const colWidth = 190;
  const leftX = 108;
  const rightX = W - 108 - colWidth;

  doc.fillColor(INK).font('Times-Bold').fontSize(14)
    .text(formatIssueDate(details.issuedAt), leftX, footerLineY - 22, { width: colWidth, align: 'center' });
  footerLine(doc, leftX, footerLineY, colWidth);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text('DATE OF COMPLETION', leftX, footerLineY + 7, { width: colWidth, align: 'center', characterSpacing: 1.5 });

  doc.fillColor(INK).font('Times-Italic').fontSize(20)
    .text(details.signerName, rightX, footerLineY - 27, { width: colWidth, align: 'center', lineBreak: false });
  footerLine(doc, rightX, footerLineY, colWidth);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text(details.signerTitle.toUpperCase(), rightX, footerLineY + 7, { width: colWidth, align: 'center', characterSpacing: 1.5 });

  drawSeal(doc, centerX, 446);

  // Verification block, bottom right inside the border.
  const qrSize = 50;
  const qrX = W - 54 - qrSize;
  const qrY = H - 54 - qrSize;
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
    .text(`Certificate ID: ${details.certificateNumber}`, 52, H - 72, { width: qrX - 62, align: 'right', lineBreak: false })
    .text(`Verify at ${details.verifyUrl.replace(/^https?:\/\//, '')}`, 52, H - 61, { width: qrX - 62, align: 'right', lineBreak: false });

  doc.end();
  return finished;
}

/** Largest font size (down to min) at which text fits in maxWidth. */
function fitFontSize(doc: PDFKit.PDFDocument, font: string, text: string, maxWidth: number, max: number, min: number) {
  doc.font(font);
  for (let size = max; size > min; size -= 1) {
    doc.fontSize(size);
    if (doc.widthOfString(text) <= maxWidth) return size;
  }
  return min;
}

function footerLine(doc: PDFKit.PDFDocument, x: number, y: number, width: number) {
  doc.lineWidth(0.8).strokeColor(INK).moveTo(x, y).lineTo(x + width, y).stroke();
}

function drawDiamond(doc: PDFKit.PDFDocument, x: number, y: number, r: number, color: string) {
  doc.save().polygon([x, y - r], [x + r, y], [x, y + r], [x - r, y]).fill(color).restore();
}

function ornamentRule(doc: PDFKit.PDFDocument, cx: number, y: number, half: number) {
  doc.lineWidth(1).strokeColor(GOLD)
    .moveTo(cx - half, y).lineTo(cx - 10, y).stroke()
    .moveTo(cx + 10, y).lineTo(cx + half, y).stroke();
  drawDiamond(doc, cx, y, 4.5, GOLD);
}

/** Gold rosette seal with a star and "VERIFIED". */
function drawSeal(doc: PDFKit.PDFDocument, cx: number, cy: number) {
  const points: number[][] = [];
  const spikes = 24;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 44 : 39;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc.save();
  doc.polygon(...(points as [number, number][])).fill(GOLD);
  doc.circle(cx, cy, 34).fill('#C99A3A');
  doc.lineWidth(1).strokeColor(GOLD_LIGHT).circle(cx, cy, 30).stroke();
  const star: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 11 : 4.6;
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    star.push([cx + radius * Math.cos(angle), cy - 6 + radius * Math.sin(angle)]);
  }
  doc.polygon(...(star as [number, number][])).fill('#FFFFFF');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5)
    .text('VERIFIED', cx - 30, cy + 9, { width: 60, align: 'center', characterSpacing: 1.2, lineBreak: false });
  doc.restore();
}
