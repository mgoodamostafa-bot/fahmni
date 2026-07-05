import { PDFDocument, rgb, degrees } from 'pdf-lib';

export interface StampData {
  studentName: string;
  studentPhone: string;
  studentEmail?: string;
  studentId: string;
  ipAddress?: string;
}

function sanitizeToAscii(str: string): string {
  if (!str) return '';
  return str.split('').filter(char => {
    const code = char.charCodeAt(0);
    return code >= 32 && code <= 126;
  }).join('').trim();
}

/**
 * 🛡️ Stamped PDF Generator (Visible & Forensic Steganographic Watermarks)
 * Stamped completely in-memory to prevent leaks of raw un-watermarked PDFs.
 */
export async function stampPDFWithForensics(
  pdfBuffer: ArrayBuffer,
  data: StampData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  const cleanName = sanitizeToAscii(data.studentName);
  const cleanPhone = sanitizeToAscii(data.studentPhone);
  const cleanId = sanitizeToAscii(data.studentId);
  const cleanEmail = data.studentEmail ? sanitizeToAscii(data.studentEmail) : cleanPhone;
  const cleanIp = data.ipAddress ? sanitizeToAscii(data.ipAddress) : '';
  const dateText = new Date().toLocaleDateString('en-US');

  const ipPart = cleanIp ? ` | IP: ${cleanIp}` : '';
  const namePart = cleanName ? `${cleanName} | ` : '';
  const visibleText = `ID: ${cleanId} | ${namePart}${cleanEmail}${ipPart} | Date: ${dateText}`;

  // 1. Inject Forensic Document Metadata
  pdfDoc.setTitle(`Forensic Copy - ID: ${cleanId}`);
  pdfDoc.setAuthor('Fahmni Education Security');
  pdfDoc.setSubject(`Licensed to: ${cleanEmail} (Tel: ${cleanPhone})`);
  pdfDoc.setKeywords([`id:${cleanId}`, `email:${cleanEmail}`, `phone:${cleanPhone}`, `ip:${cleanIp}`]);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // 2. Draw Visible Watermark (diagonally across page)
    const fontColor = rgb(0.65, 0.65, 0.65); // Slightly darker gray (clearer)
    const opacity = 0.18; // Increased opacity (clearer sika)

    const stepsX = 2;
    const stepsY = 3;
    for (let x = 1; x <= stepsX; x++) {
      for (let y = 1; y <= stepsY; y++) {
        const posX = (width / (stepsX + 1)) * x - 100;
        const posY = (height / (stepsY + 1)) * y;

        page.drawText(visibleText, {
          x: posX,
          y: posY,
          size: 11, // Increased text size
          color: fontColor,
          opacity: opacity,
          rotate: degrees(30),
        });
      }
    }

    // 3. Draw Invisible Forensic Text Watermark (Bottom Center)
    const hiddenText = `ID: ${cleanId} | ${cleanEmail}`;
    page.drawText(hiddenText, {
      x: width / 2 - 100,
      y: 35,
      size: 13,
      color: rgb(1.0, 1.0, 0.92), // Completely invisible to human eye on white background
    });
  }

  return await pdfDoc.save();
}
