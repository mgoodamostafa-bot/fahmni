export interface PaymentReceiptData {
  studentName: string;
  studentId: string;
  paymentId: string;
  title: string;
  amount: number;
  date: string;
  typeLabel: string;
  remarks?: string;
  platformName: string;
}

export const paymentReceiptService = {
  printReceipt(data: PaymentReceiptData) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بفتح النوافذ المنبثقة لطباعة الإيصال');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>إيصال استلام نقدية - ${data.studentName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 40px;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
          }
          .receipt-container {
            border: 2px dashed #cbd5e1;
            padding: 30px;
            max-width: 600px;
            margin: 0 auto;
            border-radius: 12px;
            position: relative;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            font-size: 20px;
            font-weight: 900;
            margin: 0 0 5px 0;
            color: #0f172a;
          }
          .header p {
            font-size: 12px;
            color: #64748b;
            margin: 0;
          }
          .title-badge {
            display: inline-block;
            background-color: #f1f5f9;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            margin-top: 10px;
          }
          .receipt-details {
            margin-bottom: 25px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
          }
          .detail-row span:first-child {
            color: #64748b;
            font-weight: bold;
          }
          .detail-row span:last-child {
            color: #0f172a;
            font-weight: 700;
          }
          .amount-section {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            margin-top: 20px;
          }
          .amount-section span {
            font-size: 14px;
            color: #64748b;
            font-weight: bold;
          }
          .amount-section h2 {
            font-size: 28px;
            color: #10b981;
            margin: 5px 0 0 0;
            font-weight: 900;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px dashed #e2e8f0;
            padding-top: 15px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            font-size: 12px;
            font-weight: bold;
          }
          .signature-box {
            text-align: center;
            width: 150px;
          }
          .signature-line {
            border-top: 1px solid #cbd5e1;
            margin-top: 35px;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt-container {
              border: 1px solid #000000;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <h1>${data.platformName}</h1>
            <p>إيصال استلام نقدية الكتروني</p>
            <div class="title-badge">رقم الإيصال: ${data.paymentId}</div>
          </div>

          <div class="receipt-details">
            <div class="detail-row">
              <span>اسم الطالب:</span>
              <span>${data.studentName}</span>
            </div>
            <div class="detail-row">
              <span>كود الطالب:</span>
              <span>${data.studentId}</span>
            </div>
            <div class="detail-row">
              <span>بند الدفع:</span>
              <span>${data.title}</span>
            </div>
            <div class="detail-row">
              <span>نوع الدفع:</span>
              <span>${data.typeLabel}</span>
            </div>
            <div class="detail-row">
              <span>التاريخ:</span>
              <span>${data.date}</span>
            </div>
            ${
              data.remarks
                ? `<div class="detail-row">
                    <span>ملاحظات:</span>
                    <span>${data.remarks}</span>
                   </div>`
                : ''
            }
          </div>

          <div class="amount-section">
            <span>المبلغ المستلم:</span>
            <h2>${data.amount} ج.م</h2>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <span>توقيع المستلم</span>
              <div class="signature-line"></div>
            </div>
            <div class="signature-box">
              <span>الختم الرسمي</span>
              <div class="signature-line"></div>
            </div>
          </div>

          <div class="footer">
            <p>شكراً لتعاملكم معنا. يرجى الاحتفاظ بهذا الإيصال لضمان حقوقك.</p>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            // Optional: close window after print dialog closes
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  },
};
