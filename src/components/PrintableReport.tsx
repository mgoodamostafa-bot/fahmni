import React, { useState, useRef, useEffect } from 'react';
import { pdfReportService } from '../services/pdfReportService';
import { Printer, ChevronDown, FileText, CalendarCheck2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrintableReportProps {
  studentName: string;
  studentId: string;
  grade: string;
  platformName: string;
  results: any[];
  attendance: any[];
  evaluations: any[];
  submissions: any[];
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  studentName,
  studentId,
  grade,
  platformName,
  results,
  attendance,
  evaluations,
  submissions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrintFull = () => {
    pdfReportService.printStudentReport({
      studentName,
      studentId,
      grade,
      platformName,
      results,
      attendance,
      evaluations,
      submissions,
    });
    setIsOpen(false);
  };

  const handlePrintExams = () => {
    pdfReportService.printExamReport({
      studentName,
      studentId,
      grade,
      platformName,
      results,
    });
    setIsOpen(false);
  };

  const handlePrintAttendance = () => {
    pdfReportService.printAttendanceReport({
      studentName,
      studentId,
      grade,
      platformName,
      attendance,
    });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-right" ref={dropdownRef} dir="rtl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-blue hover:bg-blue-600 text-white font-bold transition-all shadow-xl shadow-brand-blue/20 text-xs md:text-sm cursor-pointer"
      >
        <Printer size={18} />
        <span>طباعة التقارير</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-3 w-56 rounded-2xl bg-[#0d0d16] border border-white/5 shadow-2xl p-2 z-50 overflow-hidden"
          >
            <button
              onClick={handlePrintFull}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-right text-xs font-bold text-gray-200 transition-colors"
            >
              <FileText size={16} className="text-emerald-500" />
              <span>التقرير الشامل اليومي</span>
            </button>
            <button
              onClick={handlePrintExams}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-right text-xs font-bold text-gray-200 transition-colors"
            >
              <Award size={16} className="text-brand-blue" />
              <span>بيان درجات الاختبارات</span>
            </button>
            <button
              onClick={handlePrintAttendance}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-right text-xs font-bold text-gray-200 transition-colors"
            >
              <CalendarCheck2 size={16} className="text-pink-500" />
              <span>بيان حضور وغياب الطالب</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
