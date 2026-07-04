import { PDFDocument, rgb, degrees } from 'pdf-lib';

export interface StampData {
  studentName: string;
  studentPhone: string;
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
  const cleanIp = data.ipAddress ? sanitizeToAscii(data.ipAddress) : '';
  const dateText = new Date().toLocaleDateString('en-US');

  const ipPart = cleanIp ? ` | IP: ${cleanIp}` : '';
  const namePart = cleanName ? `User: ${cleanName} | ` : '';
  const visibleText = `${namePart}ID: ${cleanId} | Tel: ${cleanPhone}${ipPart} | Date: ${dateText}`;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // 1. Draw Visible Watermark (diagonally across page)
    const fontColor = rgb(0.7, 0.7, 0.7); // Light gray
    const opacity = 0.12; // High transparency

    const stepsX = 2;
    const stepsY = 3;
    for (let x = 1; x <= stepsX; x++) {
      for (let y = 1; y <= stepsY; y++) {
        const posX = (width / (stepsX + 1)) * x - 100;
        const posY = (height / (stepsY + 1)) * y;

        page.drawText(visibleText, {
          x: posX,
          y: posY,
          size: 10,
          color: fontColor,
          opacity: opacity,
          rotate: degrees(30),
        });
      }
    }

    // 2. Draw Invisible Forensic Yellow Dot Grid (Bottom Center)
    const gridX = width / 2 - 50;
    const gridY = 40;
    const rowSpacing = 8;
    const colSpacing = 8;
    
    // Light faint yellow dots (invisible to naked eye, dark on Blue Channel filter)
    const yellowColor = rgb(0.99, 0.99, 0.75); 
    const dotSize = 1.5; 

    // Draw reference anchors using rectangles
    // Anchor A: Start point (top-left of grid)
    page.drawRectangle({ x: gridX - colSpacing, y: gridY, width: dotSize, height: dotSize, color: yellowColor });
    // Anchor B: Row end (top-right of grid)
    page.drawRectangle({ x: gridX + 10 * colSpacing, y: gridY, width: dotSize, height: dotSize, color: yellowColor });
    // Anchor C: Column end (bottom-left of grid)
    page.drawRectangle({ x: gridX - colSpacing, y: gridY + 7 * rowSpacing, width: dotSize, height: dotSize, color: yellowColor });

    // Encode Student ID (8 digits, zero-padded)
    const paddedId = data.studentId.padStart(8, '0').slice(-8); 
    
    for (let r = 0; r < 8; r++) {
      const digit = parseInt(paddedId[r]) || 0; 
      
      const x = gridX + digit * colSpacing;
      const y = gridY + r * rowSpacing;

      page.drawRectangle({ x, y, width: dotSize, height: dotSize, color: yellowColor });
    }
  }

  return await pdfDoc.save();
}
