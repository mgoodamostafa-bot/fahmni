import React, { useState } from 'react';
import { Award } from 'lucide-react';

interface CertificateProps {
  studentName: string;
  courseTitle: string;
  date: string;
  certificateId: string;
  teacherName?: string;
  grade?: string;
  platformName?: string;
  platformLogo?: string;
}

function buildCertificateHtml(p: {
  studentName: string;
  courseTitle: string;
  date: string;
  certificateId: string;
  teacherName: string;
  grade?: string;
  platformName: string;
  platformLogo?: string;
}) {
  const logoHtml = p.platformLogo
    ? `<img src="${p.platformLogo}" alt="" style="width:80px;height:80px;object-fit:contain;" crossorigin="anonymous" />`
    : `<div style="width:80px;height:80px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(245,158,11,0.35);font-size:40px;color:#fff;">&#9733;</div>`;

  const gradeHtml = p.grade
    ? `<div style="display:flex;align-items:center;gap:8px;background:#fffbeb;padding:6px 16px;border-radius:8px;border:1px solid #fde68a;font-size:13px;">
         <span style="color:#6b7280;font-weight:700;">التقدير:</span>
         <span style="color:#b45309;font-weight:900;">${p.grade}</span>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>شهادة - ${p.studentName}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Kufi Arabic',sans-serif; background:#111827; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:30px; }
  .cert { width:900px; background:#fff; position:relative; overflow:hidden; aspect-ratio:1.414/1; }
  .b1 { position:absolute; inset:0; border:3px solid rgba(245,158,11,0.8); }
  .b2 { position:absolute; inset:8px; border:1px solid rgba(245,158,11,0.35); }
  .c { position:absolute; width:80px; height:80px; }
  .c-tl { top:0; left:0; }
  .c-tr { top:0; right:0; }
  .c-bl { bottom:0; left:0; }
  .c-br { bottom:0; right:0; }
  .ch { position:absolute; height:3px; }
  .cv { position:absolute; width:3px; }
  .c-tl .ch { top:0; left:0; width:100%; background:linear-gradient(to right,#f59e0b,transparent); }
  .c-tl .cv { top:0; left:0; height:100%; background:linear-gradient(to bottom,#f59e0b,transparent); }
  .c-tr .ch { top:0; right:0; width:100%; background:linear-gradient(to left,#f59e0b,transparent); }
  .c-tr .cv { top:0; right:0; height:100%; background:linear-gradient(to bottom,#f59e0b,transparent); }
  .c-bl .ch { bottom:0; left:0; width:100%; background:linear-gradient(to right,#f59e0b,transparent); }
  .c-bl .cv { bottom:0; left:0; height:100%; background:linear-gradient(to top,#f59e0b,transparent); }
  .c-br .ch { bottom:0; right:0; width:100%; background:linear-gradient(to left,#f59e0b,transparent); }
  .c-br .cv { bottom:0; right:0; height:100%; background:linear-gradient(to top,#f59e0b,transparent); }
  .ci { position:absolute; width:40px; height:40px; }
  .c-tl .ci { top:12px; left:12px; border-top:2px solid rgba(245,158,11,0.5); border-left:2px solid rgba(245,158,11,0.5); }
  .c-tr .ci { top:12px; right:12px; border-top:2px solid rgba(245,158,11,0.5); border-right:2px solid rgba(245,158,11,0.5); }
  .c-bl .ci { bottom:12px; left:12px; border-bottom:2px solid rgba(245,158,11,0.5); border-left:2px solid rgba(245,158,11,0.5); }
  .c-br .ci { bottom:12px; right:12px; border-bottom:2px solid rgba(245,158,11,0.5); border-right:2px solid rgba(245,158,11,0.5); }
  .inner { position:relative; z-index:10; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:40px 50px; }
  .wm { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:300px; color:rgba(245,158,11,0.03); z-index:1; pointer-events:none; }
  .logo-sec { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .pname { font-size:26px; font-weight:900; color:#d97706; }
  .psub { font-size:10px; color:#9ca3af; font-weight:700; letter-spacing:3px; }
  .title { text-align:center; }
  .title h1 { font-size:34px; font-weight:900; color:#111827; }
  .sep { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:8px; }
  .sep .sl { height:1px; width:50px; }
  .sep .sr { background:linear-gradient(to right,transparent,#f59e0b); }
  .sep .sll { background:linear-gradient(to left,transparent,#f59e0b); }
  .sep svg { color:#f59e0b; }
  .sub { font-size:12px; color:#6b7280; font-weight:700; }
  .sname { text-align:center; }
  .sname .lbl { font-size:10px; color:#9ca3af; font-weight:700; margin-bottom:4px; }
  .sname .nm { font-size:28px; font-weight:900; color:#d97706; border-bottom:2px solid #fde68a; padding:4px 30px 8px; }
  .desc { font-size:10px; color:#4b5563; font-weight:700; text-align:center; max-width:500px; line-height:1.8; }
  .cbadge { background:linear-gradient(to right,#fffbeb,#fff7ed); padding:10px 30px; border-radius:12px; border:1px solid #fde68a; }
  .cbadge h3 { font-size:18px; font-weight:900; color:#b45309; }
  .ft { width:100%; display:flex; justify-content:space-between; align-items:flex-end; padding:0 16px; }
  .fi { text-align:center; }
  .fi .fn { font-size:11px; font-weight:700; color:#1f2937; }
  .fi .fl { width:80px; height:1px; background:#d1d5db; margin:6px auto 0; }
  .fi .fr { font-size:8px; color:#9ca3af; margin-top:2px; }
  .seal { width:60px; height:60px; background:linear-gradient(135deg,#f59e0b,#ea580c); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; color:#fff; box-shadow:0 6px 20px rgba(245,158,11,0.4); }
  .bot { width:100%; display:flex; justify-content:space-between; align-items:center; padding:10px 16px 0; border-top:1px solid #e5e7eb; }
  .bot .info { text-align:right; }
  .bot .info p { font-size:9px; color:#6b7280; font-weight:700; }
  .bot .info span { color:#d97706; font-family:monospace; }
  .bot .qr { display:flex; align-items:center; gap:6px; }
  .bot .qr-box { width:44px; height:44px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; }
  .bot .qr-box svg { width:36px; height:36px; }
  .bot .qr-lbl { font-size:8px; color:#d97706; font-weight:700; }
  @media print {
    body { background:#fff; padding:0; }
    .cert { width:100%; box-shadow:none; }
    .no-print { display:none!important; }
  }
</style>
</head>
<body>
<div class="cert">
  <div class="b1"></div>
  <div class="b2"></div>
  <div class="c c-tl"><div class="ch"></div><div class="cv"></div><div class="ci"></div></div>
  <div class="c c-tr"><div class="ch"></div><div class="cv"></div><div class="ci"></div></div>
  <div class="c c-bl"><div class="ch"></div><div class="cv"></div><div class="ci"></div></div>
  <div class="c c-br"><div class="ch"></div><div class="cv"></div><div class="ci"></div></div>
  <div class="wm">&#9733;</div>
  <div class="inner">
    <div class="logo-sec">
      ${logoHtml}
      <div class="pname">${p.platformName}</div>
      <div class="psub">&#x627;&#x644;&#x645;&#x646;&#x635;&#x629; &#x627;&#x644;&#x62A;&#x639;&#x644;&#x64A;&#x645;&#x64A;&#x629;</div>
    </div>
    <div class="title">
      <h1>&#x634;&#x647;&#x627;&#x62F;&#x629; &#x62A;&#x642;&#x62F;&#x64A;&#x631; &#x648;&#x625;&#x62A;&#x645;&#x627;&#x645;</h1>
      <div class="sep">
        <span class="sl sr"></span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span class="sl sll"></span>
      </div>
    </div>
    <div class="sub">&#x62A;&#x650;&#x645;&#x646;&#x62D; &#x647;&#x630;&#x647; &#x627;&#x644;&#x634;&#x647;&#x627;&#x62F;&#x629; &#x641;&#x62E;&#x631;&#x627;&#x64B; &#x648;&#x627;&#x639;&#x62A;&#x632;&#x627;&#x632;&#x627;&#x64B; &#x644;&#x644;&#x637;&#x627;&#x644;&#x628; &#x627;&#x644;&#x645;&#x62A;&#x645;&#x64A;&#x632;</div>
    <div class="sname">
      <div class="lbl">&#x627;&#x644;&#x637;&#x627;&#x644;&#x628;</div>
      <div class="nm">${p.studentName}</div>
    </div>
    <div class="desc">&#x648;&#x644;&#x627;&#x62C;&#x62A;&#x64A;&#x627;&#x632;&#x647; &#x628;&#x646;&#x62C;&#x627;&#x62D; &#x648;&#x628;&#x62A;&#x642;&#x62F;&#x64A;&#x631; &#x645;&#x646;&#x637;&#x648;&#x631; &#x643;&#x627;&#x641;&#x629; &#x627;&#x644;&#x645;&#x62A;&#x637;&#x644;&#x628;&#x627;&#x62A; &#x648;&#x627;&#x644;&#x627;&#x62E;&#x62A;&#x628;&#x627;&#x631;&#x627;&#x62A; &#x627;&#x644;&#x644;&#x627;&#x632;&#x645;&#x629; &#x644;&#x625;&#x62A;&#x645;&#x627;&#x645; &#x627;&#x644;&#x62F;&#x648;&#x631;&#x629; &#x627;&#x644;&#x62A;&#x62F;&#x631;&#x64A;&#x628;&#x64A;&#x629; &#x628;&#x639;&#x646;&#x648;&#x627;&#x646;</div>
    <div class="cbadge"><h3>${p.courseTitle}</h3></div>
    ${gradeHtml}
    <div class="ft">
      <div class="fi">
        <div class="fn">${p.teacherName}</div>
        <div class="fl"></div>
        <div class="fr">&#x62A;&#x648;&#x642;&#x64A;&#x639; &#x627;&#x644;&#x645;&#x62F;&#x631;&#x633;</div>
      </div>
      <div class="seal">&#9733;</div>
      <div class="fi">
        <div class="fn">&#x625;&#x62F;&#x627;&#x631;&#x629; ${p.platformName}</div>
        <div class="fl"></div>
        <div class="fr">&#x627;&#x644;&#x62A;&#x648;&#x642;&#x64A;&#x639; &#x627;&#x644;&#x631;&#x633;&#x645;&#x64A;</div>
      </div>
    </div>
    <div class="bot">
      <div class="info">
        <p>&#x631;&#x642;&#x645; &#x627;&#x644;&#x634;&#x647;&#x627;&#x62F;&#x629;: <span>${p.certificateId}</span></p>
        <p>&#x62A;&#x627;&#x631;&#x64A;&#x62E; &#x627;&#x644;&#x625;&#x635;&#x62F;&#x627;&#x631;: <span>${p.date}</span></p>
      </div>
      <div class="qr">
        <div class="qr-box">
          <svg viewBox="0 0 29 29" xmlns="http://www.w3.org/2000/svg">
            <rect width="29" height="29" fill="#fff"/>
            <rect x="2" y="2" width="7" height="7" fill="#000"/>
            <rect x="4" y="4" width="3" height="3" fill="#fff"/>
            <rect x="20" y="2" width="7" height="7" fill="#000"/>
            <rect x="22" y="4" width="3" height="3" fill="#fff"/>
            <rect x="2" y="20" width="7" height="7" fill="#000"/>
            <rect x="4" y="22" width="3" height="3" fill="#fff"/>
            <rect x="11" y="2" width="2" height="2" fill="#000"/>
            <rect x="15" y="2" width="2" height="2" fill="#000"/>
            <rect x="11" y="6" width="2" height="2" fill="#000"/>
            <rect x="2" y="11" width="2" height="2" fill="#000"/>
            <rect x="6" y="11" width="2" height="2" fill="#000"/>
            <rect x="11" y="11" width="2" height="2" fill="#000"/>
            <rect x="15" y="11" width="2" height="2" fill="#000"/>
            <rect x="20" y="11" width="2" height="2" fill="#000"/>
            <rect x="25" y="11" width="2" height="2" fill="#000"/>
            <rect x="11" y="15" width="2" height="2" fill="#000"/>
            <rect x="2" y="15" width="2" height="2" fill="#000"/>
            <rect x="6" y="15" width="2" height="2" fill="#000"/>
            <rect x="20" y="15" width="2" height="2" fill="#000"/>
            <rect x="25" y="15" width="2" height="2" fill="#000"/>
            <rect x="20" y="20" width="2" height="2" fill="#000"/>
            <rect x="25" y="20" width="2" height="2" fill="#000"/>
            <rect x="20" y="25" width="2" height="2" fill="#000"/>
            <rect x="11" y="20" width="2" height="2" fill="#000"/>
            <rect x="15" y="20" width="2" height="2" fill="#000"/>
            <rect x="11" y="25" width="2" height="2" fill="#000"/>
            <rect x="15" y="25" width="2" height="2" fill="#000"/>
          </svg>
        </div>
        <div class="qr-lbl">fahmni.me/verify</div>
      </div>
    </div>
  </div>
</div>
<div class="no-print" style="margin-top:24px;display:flex;gap:12px;">
  <button onclick="window.print()" style="padding:14px 36px;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;border:none;border-radius:14px;font-size:17px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(245,158,11,0.3);">&#x637;&#x628;&#x627;&#x639;&#x629; / &#x62D;&#x641;&#x638; &#x643;&#x628;&#x627;&#x626;</button>
</div>
</body>
</html>`;
}

export const CertificateGenerator: React.FC<CertificateProps> = ({
  studentName,
  courseTitle,
  date,
  certificateId,
  teacherName = 'إدارة المنصة',
  grade,
  platformName = 'المنصة التعليمية',
  platformLogo,
}) => {
  const [loading, setLoading] = useState(false);

  const openDownloadTab = () => {
    setLoading(true);
    try {
      const html = buildCertificateHtml({
        studentName,
        courseTitle,
        date,
        certificateId,
        teacherName,
        grade,
        platformName,
        platformLogo,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) {
        alert('يرجى السماح بفتح النوافذ المنبثقة');
      }
    } finally {
      setLoading(false);
    }
  };

  const LogoIcon = () => {
    if (platformLogo) {
      return <img src={platformLogo} alt={platformName} className="w-14 h-14 object-contain" />;
    }
    return (
      <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
        <Award size={28} className="text-white" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Certificate Preview */}
      <div
        className="relative w-full bg-white overflow-hidden"
        dir="rtl"
        style={{ aspectRatio: '1.414/1' }}
      >
        <div className="absolute inset-0 border-[3px] border-amber-500/80 pointer-events-none" />
        <div className="absolute inset-[8px] border border-amber-400/40 pointer-events-none" />

        <div className="absolute top-0 left-0 w-20 h-20">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-amber-500 to-transparent" />
          <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 border-amber-400/60" />
        </div>
        <div className="absolute top-0 right-0 w-20 h-20">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-amber-500 to-transparent" />
          <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-amber-500 to-transparent" />
          <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-amber-400/60" />
        </div>
        <div className="absolute bottom-0 left-0 w-20 h-20">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-transparent" />
          <div className="absolute bottom-0 left-0 h-full w-1 bg-gradient-to-t from-amber-500 to-transparent" />
          <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 border-amber-400/60" />
        </div>
        <div className="absolute bottom-0 right-0 w-20 h-20">
          <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l from-amber-500 to-transparent" />
          <div className="absolute bottom-0 right-0 h-full w-1 bg-gradient-to-t from-amber-500 to-transparent" />
          <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 border-amber-400/60" />
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none">
          <Award size={300} className="text-amber-600" />
        </div>

        <div className="relative z-10 w-full h-full flex flex-col items-center justify-between p-6 sm:p-10">
          <div className="flex flex-col items-center gap-1">
            <LogoIcon />
            <h2 className="text-xl sm:text-2xl font-black text-amber-600">{platformName}</h2>
            <p className="text-[8px] sm:text-[10px] text-gray-400 font-bold tracking-widest">المنصة التعليمية</p>
          </div>

          <div className="text-center">
            <h1 className="text-xl sm:text-3xl font-black text-gray-900">شهادة تقدير وإتمام</h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500" />
              <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500" />
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 font-bold">
            تُمنح هذه الشهادة فخراً واعتزازاً للطالب المتميز
          </p>

          <div className="text-center">
            <p className="text-[8px] sm:text-[10px] text-gray-400 font-bold mb-1">الطالب</p>
            <h2 className="text-xl sm:text-2xl font-black text-amber-600 border-b-2 border-amber-200 pb-2 inline-block px-6">
              {studentName}
            </h2>
          </div>

          <p className="text-[8px] sm:text-[10px] text-gray-600 font-bold text-center max-w-md">
            وذلك لاجتيازه بنجاح وبتقدير ممتاز كافة المتطلبات والاختبارات اللازمة لإتمام الدورة التدريبية بعنوان:
          </p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-2 rounded-xl border border-amber-200">
            <h3 className="text-sm sm:text-lg font-black text-amber-700">{courseTitle}</h3>
          </div>

          {grade && (
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold">التقدير:</span>
              <span className="text-[10px] sm:text-xs font-black text-amber-700">{grade}</span>
            </div>
          )}

          <div className="w-full flex justify-between items-end px-4">
            <div className="text-center">
              <p className="text-[8px] sm:text-[10px] font-bold text-gray-800">{teacherName}</p>
              <div className="w-20 h-px bg-gray-300 mt-1" />
              <p className="text-[6px] sm:text-[8px] text-gray-400">توقيع المدرس</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                <Award size={20} className="text-white sm:hidden" />
                <Award size={28} className="text-white hidden sm:block" />
              </div>
              <p className="text-[6px] sm:text-[8px] text-gray-400 mt-1">ختم رسمي</p>
            </div>

            <div className="text-center">
              <p className="text-[8px] sm:text-[10px] font-bold text-gray-800">إدارة {platformName}</p>
              <div className="w-20 h-px bg-gray-300 mt-1" />
              <p className="text-[6px] sm:text-[8px] text-gray-400">التوقيع الرسمي</p>
            </div>
          </div>

          <div className="w-full flex justify-between items-center px-4 pt-2 border-t border-gray-200">
            <div className="text-right">
              <p className="text-[7px] sm:text-[9px] text-gray-500 font-bold">
                رقم الشهادة: <span className="text-amber-600 font-mono">{certificateId}</span>
              </p>
              <p className="text-[7px] sm:text-[9px] text-gray-500 font-bold">
                تاريخ الإصدار: <span>{date}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[6px] sm:text-[8px] text-amber-600 font-bold">fahmni.me/verify</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={openDownloadTab}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20 text-base"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          تحميل الشهادة
        </button>
      </div>
    </div>
  );
};
