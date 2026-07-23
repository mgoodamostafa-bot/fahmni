export interface CardStudent {
  displayName: string;
  studentId: string;
  grade?: string;
  level?: string;
  groupName?: string;
  centerName?: string;
}

export const studentCardService = {
  printStudentCards(students: CardStudent[], title: string = 'كروت الطلاب', platformName: string = 'المنصة التعليمية'): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة لطباعة الكروت');
      return;
    }

    const cardsHtml = students.map(student => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(student.studentId)}`;
      
      return `
        <div class="card">
          <div class="card-header">
            <span class="platform-title">${platformName}</span>
            <span class="card-type">بطاقة طالب ذكية</span>
          </div>
          <div class="card-body">
            <div class="student-info">
              <div class="info-row">
                <span class="info-label">الاسم:</span>
                <span class="info-value name-value">${student.displayName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">الكود:</span>
                <span class="info-value code-value font-mono">${student.studentId}</span>
              </div>
              ${student.grade ? `
              <div class="info-row">
                <span class="info-label">الصف:</span>
                <span class="info-value">${student.grade}</span>
              </div>
              ` : ''}
              ${student.groupName ? `
              <div class="info-row">
                <span class="info-label">المجموعة:</span>
                <span class="info-value">${student.groupName}</span>
              </div>
              ` : ''}
              ${student.centerName ? `
              <div class="info-row font-xs">
                <span class="info-label">السنتر:</span>
                <span class="info-value">${student.centerName}</span>
              </div>
              ` : ''}
            </div>
            <div class="qr-container">
              <img src="${qrUrl}" alt="QR Code" class="qr-code" />
              <span class="qr-tip font-mono">SCAN TO CHECK IN</span>
            </div>
          </div>
          <div class="card-footer">
            <span>نظام حضور السنتر الذكي - Center OS</span>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة كروت الطلاب - ${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            font-family: 'Cairo', sans-serif;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: #f0f2f5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 10px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            justify-content: center;
          }
          
          /* ID Card Layout styling (85mm x 55mm approx ratio) */
          .card {
            width: 90mm;
            height: 56mm;
            background: #ffffff;
            border: 2px solid #e1e8ed;
            border-radius: 12px;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            overflow: hidden;
            page-break-inside: avoid;
          }
          
          /* Card Top Header border line */
          .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          }
          
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-b: 1px solid #f0f2f5;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }
          .platform-title {
            font-size: 8px;
            font-weight: 900;
            color: #1e293b;
          }
          .card-type {
            font-size: 8px;
            font-weight: 700;
            color: #3b82f6;
            background: #eff6ff;
            padding: 1px 6px;
            border-radius: 4px;
          }
          
          .card-body {
            display: flex;
            flex-1: 1;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          
          .student-info {
            flex-1: 1;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          
          .info-row {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
          }
          .info-label {
            color: #64748b;
            font-weight: 700;
            min-width: 48px;
          }
          .info-value {
            color: #0f172a;
            font-weight: 700;
          }
          .name-value {
            font-size: 11px;
            color: #1e1b4b;
            font-weight: 900;
          }
          .code-value {
            color: #3b82f6;
            letter-spacing: 0.5px;
          }
          
          .qr-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-right: 1px solid #f0f2f5;
            padding-right: 8px;
          }
          .qr-code {
            width: 75px;
            height: 75px;
            object-fit: contain;
          }
          .qr-tip {
            font-size: 6px;
            color: #94a3b8;
            margin-top: 2px;
            font-weight: 900;
          }
          
          .card-footer {
            border-top: 1px solid #f0f2f5;
            padding-top: 4px;
            text-align: center;
            font-size: 7px;
            color: #94a3b8;
            font-weight: 700;
          }
          
          .font-mono {
            font-family: monospace;
          }
          .font-xs {
            font-size: 8px;
          }
          
          /* Print Styling */
          @media print {
            body {
              background-color: #ffffff;
            }
            .container {
              padding: 0;
              margin: 0;
            }
            .card {
              box-shadow: none;
              border: 1px solid #ccc;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${cardsHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 800);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};
