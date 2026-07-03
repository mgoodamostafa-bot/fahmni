// 🔐 Radical AI Engine: Direct Fetch (v1beta Stable Fallback)
export interface RawAIQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}

const API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

export const generateQuestionsFromAI = async (textContents: string): Promise<RawAIQuestion[]> => {
  try {
    const prompt = `
      أنت خبير في المناهج التعليمية وتصميم أسئلة الامتحانات (MCQ). 
      قم بتحليل النص التالي واستخراج الأسئلة منه بدقة.
      
      المتطلبات الدقيقة:
      1. استخراج الأسئلة والخيارات (يجب أن يكون لكل سؤال 4 اختيارات).
      2. المخرجات يجب أن تكون بصيغة JSON حصراً في مصفوفة [{}].
      3. الحقول المطلوبة: "question", "options", "correctAnswer" (رقم من 0 لـ 3).
      4. ملاحظة هامة: قد يحتوي الملف على رمز (o) كعلامة للاختيارات، ورمز (✓) للإجابة الصحيحة؛ يرجى اعتبارها كمؤشرات أساسية.
      
      النص:
      ${textContents.slice(0, 15000)}
    `;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
      const fallbackRes = await fetch(flashUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!fallbackRes.ok) throw new Error('فشل الاتصال بكافة نماذج الذكاء الاصطناعي.');
      const data = await fallbackRes.json();
      return parseResult(data);
    }

    const data = await response.json();
    return parseResult(data);
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new Error(error.message || 'عذراً، حدث خطأ في معالجة البيانات.');
  }
};

const parseResult = (data: any): RawAIQuestion[] => {
  const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = textResult.match(/\[\s*\{.*\}\s*\]/s) || textResult.match(/\{.*\}/s);
  if (!jsonMatch) throw new Error('تنسيق البيانات غير صحيح.');
  return JSON.parse(jsonMatch[0]);
};
