import { RawAIQuestion } from '../lib/gemini';

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const pdfjsLib = await import('pdfjs-dist').catch(() => {
      throw new Error('مكتبة قراءة الـ PDF غير مثبتة. يرجى تشغيل npm install.');
    });

    const pdfWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');

      fullText += pageText + '\n\n';
    }

    return fullText;
  } catch (error: any) {
    console.error('PDF Extraction Error:', error);
    throw new Error(error.message || 'فشل استخراج النص من ملف PDF.');
  }
};

/**
 * 🔍 Super High Efficiency MCQ Parser (No AI Required)
 * Uses advanced pattern recognition to extract questions from Arabic PDFs.
 */
export const parseMcqWithRegex = (text: string): RawAIQuestion[] => {
  const questions: RawAIQuestion[] = [];

  // Clean text from extra spaces but keep structure
  const cleanText = text.replace(/\s+/g, ' ');

  // Look for patterns like: 1- السؤال؟ (أ) خيار ا (ب) خيار 2...
  // Or: السؤال؟ أ- خيار 1 ب- خيار 2...
  // 🔍 Improved pattern for symbol-based MCQs (o, ✓) as seen in ENG1_QUIZ1
  const questionBlocks = cleanText.split(/(?=\b\d+\s*[\.\-\)])/);

  for (const block of questionBlocks) {
    if (block.length < 10) continue;

    // Detect options using 'o' or '✓' or letters
    const optionsMatch = block.match(
      /([أبجد]|[A-Da-d]|o|✓)[\.\-\s]\s*(.*?)(?=([أبجد]|[A-Da-d]|o|✓)[\.\-\s]|$)/g
    );

    if (optionsMatch && optionsMatch.length >= 2) {
      const qText = block
        .split(/([أبجد]|[A-Da-d]|o|✓)[\.\-\s]/)[0]
        .replace(/^\d+[\.\-\s]\s*/, '')
        .trim();
      const extractedOptions = optionsMatch.map((opt) =>
        opt.replace(/^([أبجد]|[A-Da-d]|o|✓)[\.\-\s]\s*/, '').trim()
      );

      // Find the index of the correct answer (marked with ✓)
      const correctIndex = optionsMatch.findIndex((opt) => opt.startsWith('✓'));

      while (extractedOptions.length < 4) extractedOptions.push('');

      questions.push({
        question: qText || 'سؤال مستخرج',
        options: extractedOptions.slice(0, 4) as string[],
        correctAnswer: (correctIndex !== -1 ? correctIndex : 0).toString(),
        difficulty: 'medium',
      });
    }
  }

  return questions;
};
