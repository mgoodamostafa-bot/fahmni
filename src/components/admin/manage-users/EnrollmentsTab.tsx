import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Enrollment } from './types';

export const EnrollmentsTab: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Enrollments'), async (snap) => {
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let userEmail = 'غير معروف';
          let courseTitle = 'كورس محذوف';
          try {
            const uDoc = await getDoc(doc(db, 'users', data.userId));
            if (uDoc.exists()) userEmail = uDoc.data().email || uDoc.data().displayName;

            let cDoc = await getDoc(doc(db, 'Courses', data.courseId));
            if (!cDoc.exists()) {
              cDoc = await getDoc(doc(db, 'courses', data.courseId));
            }
            if (cDoc.exists()) courseTitle = cDoc.data().title;
          } catch {
            // User or course not found
          }
          return { id: d.id, ...data, userEmail, courseTitle } as Enrollment;
        })
      );
      setEnrollments(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full text-right">
        <thead>
          <tr className="bg-white/5 border-b border-white/8 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <th className="px-5 py-4">المستخدم</th>
            <th className="px-5 py-4">الكورس</th>
            <th className="px-5 py-4">الحالة</th>
            <th className="px-5 py-4">التاريخ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {loading ? (
            <tr>
              <td colSpan={4} className="px-5 py-20 text-center">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </td>
            </tr>
          ) : (
            enrollments.map((en) => (
              <tr key={en.id} className="hover:bg-white/3 transition-colors">
                <td className="px-5 py-4 text-white text-sm">{en.userEmail}</td>
                <td className="px-5 py-4 text-blue-400 text-sm">{en.courseTitle}</td>
                <td className="px-5 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-black ${en.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}
                  >
                    {en.status === 'active' ? 'نشط' : 'معلق'}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-500 text-xs">
                  {en.createdAt?.seconds
                    ? new Date(en.createdAt.seconds * 1000).toLocaleDateString('ar-EG')
                    : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
