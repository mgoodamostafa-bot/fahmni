export interface ExamResult {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  createdAt: any;
  type: 'online' | 'offline';
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'excused';
  timestamp: any;
}

export interface EvaluationRecord {
  id: string;
  date: string;
  quizGrade: number;
  quizTotal: number;
  homeworkStatus: 'submitted' | 'incomplete' | 'not_submitted';
  behaviorRating: number;
  teacherRemarks: string;
  createdAt: any;
}

export interface HomeworkSubmission {
  id: string;
  lessonTitle: string;
  status: 'pending' | 'approved' | 'rejected';
  grade: number;
  feedback: string;
  createdAt: any;
}

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'غير محدد';
  let date: Date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getHTMLHeader = (platformName: string, title: string, studentName: string, studentId: string, grade: string) => {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title} - ${studentName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #ffffff;
          color: #1e293b;
          font-size: 14px;
          line-height: 1.6;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header-logo {
          font-size: 28px;
          font-weight: 900;
          color: #0f172a;
        }
        .header-logo span {
          color: #059669;
        }
        .report-title {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          padding: 8px 16px;
          border-radius: 8px;
        }
        .student-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .info-item {
          display: flex;
          gap: 10px;
        }
        .info-label {
          font-weight: 700;
          color: #64748b;
        }
        .info-value {
          font-weight: 600;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          border: 1px solid #e2e8f0;
          padding: 12px 15px;
          text-align: right;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 700;
          color: #334155;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .badge-success { background-color: #d1fae5; color: #065f46; }
        .badge-danger { background-color: #fee2e2; color: #991b1b; }
        .badge-warning { background-color: #fef3c7; color: #92400e; }
        .badge-info { background-color: #e0f2fe; color: #0369a1; }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
        }
        .page-break {
          page-break-before: always;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-logo">${platformName}<span>.me</span></div>
        <div class="report-title">${title}</div>
      </div>
      
      <div class="student-card">
        <div class="info-item">
          <span class="info-label">اسم الطالب:</span>
          <span class="info-value">${studentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">كود الطالب:</span>
          <span class="info-value">${studentId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">الصف الدراسي:</span>
          <span class="info-value">${grade}</span>
        </div>
        <div class="info-item">
          <span class="info-label">تاريخ الإصدار:</span>
          <span class="info-value">${new Date().toLocaleDateString('ar-EG')}</span>
        </div>
      </div>
  `;
};

const getHTMLFooter = () => {
  return `
      <div class="footer">
        هذا التقرير تم إنشاؤه إلكترونياً من خلال منصة فهمني التعليمية وموثق بالكامل من الإدارة.
      </div>
    </body>
    </html>
  `;
};

export const pdfReportService = {
  // 1. Full student report
  printStudentReport(data: {
    studentName: string;
    studentId: string;
    grade: string;
    platformName: string;
    results: ExamResult[];
    attendance: AttendanceRecord[];
    evaluations: EvaluationRecord[];
    submissions: HomeworkSubmission[];
  }) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = getHTMLHeader(
      data.platformName,
      'التقرير الأكاديمي الشامل لولي الأمر',
      data.studentName,
      data.studentId,
      data.grade
    );

    // Section 1: Exams
    html += `
      <h3>📊 تقرير نتائج الامتحانات والاختبارات</h3>
      <table>
        <thead>
          <tr>
            <th>عنوان الاختبار</th>
            <th>نوع الاختبار</th>
            <th>الدرجة والتحصيل</th>
            <th>النسبة المئوية</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (data.results.length > 0) {
      data.results.forEach((res) => {
        const pct = Math.round((res.score / res.totalQuestions) * 100);
        html += `
          <tr>
            <td>${res.title}</td>
            <td>${res.type === 'online' ? 'إلكتروني' : 'ورقي بالسنتر'}</td>
            <td>${res.score} / ${res.totalQuestions}</td>
            <td><span class="badge ${pct >= 70 ? 'badge-success' : 'badge-danger'}">${pct}%</span></td>
          </tr>
        `;
      });
    } else {
      html += `<tr><td colspan="4" style="text-align: center;">لا توجد امتحانات مسجلة للطالب بعد.</td></tr>`;
    }
    html += `</tbody></table>`;

    // Section 2: Attendance
    html += `
      <div class="page-break"></div>
      <h3>📅 تقرير حضور الحصص والمجموعات</h3>
      <table>
        <thead>
          <tr>
            <th>التاريخ واليوم</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (data.attendance.length > 0) {
      data.attendance.forEach((att) => {
        const statusMap = {
          present: { text: 'حاضر', badge: 'badge-success' },
          absent: { text: 'غائب', badge: 'badge-danger' },
          excused: { text: 'مستأذن', badge: 'badge-warning' },
        };
        const config = statusMap[att.status] || { text: att.status, badge: 'badge-info' };
        html += `
          <tr>
            <td>${att.date}</td>
            <td><span class="badge ${config.badge}">${config.text}</span></td>
          </tr>
        `;
      });
    } else {
      html += `<tr><td colspan="2" style="text-align: center;">لا توجد سجلات حضور مسجلة للطالب بعد.</td></tr>`;
    }
    html += `</tbody></table>`;

    // Section 3: Daily evaluations
    if (data.evaluations.length > 0) {
      html += `
        <h3>📝 تقرير التقييم والملاحظات اليومية من المعلم</h3>
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>درجة التسميع/الامتحان</th>
              <th>حالة الواجب</th>
              <th>تقييم السلوك</th>
              <th>ملاحظات وتوجيهات المعلم</th>
            </tr>
          </thead>
          <tbody>
      `;
      data.evaluations.forEach((evalItem) => {
        const hwMap = {
          submitted: 'مسلم بالكامل',
          incomplete: 'غير مكتمل',
          not_submitted: 'لم يسلم الواجب',
        };
        html += `
          <tr>
            <td>${evalItem.date}</td>
            <td>${evalItem.quizGrade} / ${evalItem.quizTotal}</td>
            <td>${hwMap[evalItem.homeworkStatus] || evalItem.homeworkStatus}</td>
            <td>${'⭐'.repeat(evalItem.behaviorRating)}</td>
            <td>${evalItem.teacherRemarks || 'لا توجد ملاحظات'}</td>
          </tr>
        `;
      });
      html += `</tbody></table>`;
    }

    html += getHTMLFooter();

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  },

  // 2. Exam report only
  printExamReport(data: {
    studentName: string;
    studentId: string;
    grade: string;
    platformName: string;
    results: ExamResult[];
  }) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = getHTMLHeader(
      data.platformName,
      'بيان بدرجات نتائج الاختبارات والامتحانات',
      data.studentName,
      data.studentId,
      data.grade
    );

    html += `
      <h3>📊 سجل درجات الامتحانات الورقية والإلكترونية</h3>
      <table>
        <thead>
          <tr>
            <th>عنوان الاختبار</th>
            <th>نوع الاختبار</th>
            <th>الدرجة والتحصيل</th>
            <th>النسبة المئوية</th>
          </tr>
        </thead>
        <tbody>
    `;
    data.results.forEach((res) => {
      const pct = Math.round((res.score / res.totalQuestions) * 100);
      html += `
        <tr>
          <td>${res.title}</td>
          <td>${res.type === 'online' ? 'إلكتروني' : 'ورقي بالسنتر'}</td>
          <td>${res.score} / ${res.totalQuestions}</td>
          <td><span class="badge ${pct >= 70 ? 'badge-success' : 'badge-danger'}">${pct}%</span></td>
        </tr>
      `;
    });
    html += `</tbody></table>` + getHTMLFooter();

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  },

  // 3. Attendance report only
  printAttendanceReport(data: {
    studentName: string;
    studentId: string;
    grade: string;
    platformName: string;
    attendance: AttendanceRecord[];
  }) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = getHTMLHeader(
      data.platformName,
      'بيان بحضور وغياب الطالب بالسنتر',
      data.studentName,
      data.studentId,
      data.grade
    );

    html += `
      <h3>📅 سجل الحضور والغياب اليومي للدروس</h3>
      <table>
        <thead>
          <tr>
            <th>التاريخ واليوم</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
    `;
    data.attendance.forEach((att) => {
      const statusMap = {
        present: { text: 'حاضر', badge: 'badge-success' },
        absent: { text: 'غائب', badge: 'badge-danger' },
        excused: { text: 'مستأذن', badge: 'badge-warning' },
      };
      const config = statusMap[att.status] || { text: att.status, badge: 'badge-info' };
      html += `
        <tr>
          <td>${att.date}</td>
          <td><span class="badge ${config.badge}">${config.text}</span></td>
        </tr>
      `;
    });
    html += `</tbody></table>` + getHTMLFooter();

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
};
