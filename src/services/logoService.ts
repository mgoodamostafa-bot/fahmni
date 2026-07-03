import { GoogleGenAI } from '@google/genai';

export async function generateLogo() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'Design a clean modern minimalist logo for an educational platform named "فاهمني" (Fahmni). The icon should be a simple light bulb symbolizing understanding, with a small graduation cap on top. The bulb has a subtle smile inside. Flat design, no 3D. Primary color: Blue (#2563EB), Secondary color: Yellow (#FACC15). Include the text "فاهمني" in bold Arabic font and the tagline "تعلم ببساطة". High resolution, white background.',
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: '1:1',
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
