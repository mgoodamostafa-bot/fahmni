/**
 * Arabic Text Utilities
 * Helpers for Arabic numeral conversion, phone cleaning, and grade labelling.
 */

/**
 * Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Western Arabic (0123456789).
 */
export const arabicToEnglishNumbers = (str: string): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  return str.replace(/[٠-٩]/g, (char) => {
    const index = arabicNumerals.indexOf(char);
    return index !== -1 ? String(index) : char;
  });
};

/**
 * Clean a phone number by removing spaces, dashes, plus signs, and leading zeros.
 */
export const cleanPhone = (phone: unknown): string => {
  if (!phone) return '';
  return String(phone)
    .replace(/[\s\-+]/g, '')
    .replace(/^0+/, '');
};

/**
 * Map a grade code to its Arabic label.
 * Returns the original code if no mapping is found.
 */
export const getGradeLabel = (grade: string): string => {
  const map: Record<string, string> = {
    'primary-4': 'الصف الرابع الابتدائي',
    'primary-5': 'الصف الخامس الابتدائي',
    'primary-6': 'الصف السادس الابتدائي',
    'prep-1': 'الصف الأول الإعدادي',
    'prep-2': 'الصف الثاني الإعدادي',
    'prep-3': 'الصف الثالث الإعدادي',
    'sec-1': 'الصف الأول الثانوي',
    'sec-2': 'الصف الثاني الثانوي',
    'sec-3': 'الصف الثالث الثانوي',
    '1': 'الصف الأول الثانوي',
    '2': 'الصف الثاني الثانوي',
    '3': 'الصف الثالث الثانوي',
  };

  return map[grade] || grade;
};
