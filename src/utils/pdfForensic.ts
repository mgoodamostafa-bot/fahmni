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

    // 3. Draw Invisible Forensic Barcode Watermark (Bottom Center)
    const barcodeHeight = 22;
    const barcodeY = 35; // 35 units from the bottom
    
    // Extremely faint yellow color (completely invisible to human eye, but contrasty under blue-channel filter)
    const barcodeColor = rgb(1.0, 1.0, 0.92);
    // Generate bit array
    const paddedId = data.studentId.padStart(8, '0').slice(-8);
    const bits: number[] = [1, 0, 1]; // Start pattern
    
    for (let i = 0; i < 8; i++) {
      const digit = parseInt(paddedId[i]) || 0;
      // Convert digit to 4-bit binary array (e.g. 5 -> [0, 1, 0, 1])
      const digitBits = [
        (digit >> 3) & 1,
        (digit >> 2) & 1,
        (digit >> 1) & 1,
        digit & 1
      ];
      bits.push(...digitBits);
    }
    bits.push(1, 0, 1); // Stop pattern

    // Calculate total width of barcode to center it
    // 1 bit: wide = 6 units, narrow = 2 units.
    // Plus spacing of 3 units between bits.
    let totalBarcodeWidth = 0;
    for (const bit of bits) {
      totalBarcodeWidth += (bit === 1 ? 6 : 2) + 3;
    }
    totalBarcodeWidth -= 3; // Remove last spacing

    const startX = (width - totalBarcodeWidth) / 2;
    let currentX = startX;

    for (const bit of bits) {
      const thickness = bit === 1 ? 6 : 2;
      
      page.drawLine({
        start: { x: currentX + thickness / 2, y: barcodeY },
        end: { x: currentX + thickness / 2, y: barcodeY + barcodeHeight },
        thickness,
        color: barcodeColor,
      });

      currentX += thickness + 3; // Move to next position
    }
  }

  return await pdfDoc.save();
}
