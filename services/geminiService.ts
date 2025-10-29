
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { GeminiAsrResponse } from '../types';

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the data URL prefix, which we need to remove.
        // e.g., "data:audio/webm;codecs=opus;base64,..." -> "..."
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read blob as base64 string."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAndTranslate(
  ai: GoogleGenAI,
  audioBlob: Blob,
  langA: string,
  langB: string
): Promise<GeminiAsrResponse> {
  const base64Audio = await blobToBase64(audioBlob);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: "Process the attached audio according to your strict rules." },
          {
            inlineData: {
              mimeType: audioBlob.type,
              data: base64Audio
            }
          }
        ]
      }
    ],
    config: {
      systemInstruction: `You are a highly skilled AI translation service. Your task is to process user audio and return a specific JSON object.

YOU MUST FOLLOW THESE RULES:
1. The user will speak in one of two languages: '${langA}' or '${langB}'. Your first job is to correctly identify which language was spoken.
2. After identifying the spoken language, you must provide a perfect, verbatim transcription.
3. You must then translate the transcription into the OTHER language.
   - If '${langA}' is spoken, translate to '${langB}'.
   - If '${langB}' is spoken, translate to '${langA}'.
4. Your ONLY output MUST be a single, valid JSON object that strictly follows the provided schema. Do not output any other text, markdown, or explanations.
5. CRITICAL RULE: NEVER use placeholders. The words 'undefined', 'unintelligible', or '...' are strictly forbidden in your JSON output. If any part of the audio is unclear, transcribe and translate only the clear parts. If the entire audio is unusable, return empty strings for the 'transcription' and 'translation' fields. A partial, accurate response is required. An inaccurate or placeholder-filled response is a failure.
6. The 'sourceLanguage' field in your JSON response must contain the full name of the language you identified, exactly as it appears in this prompt (e.g., '${langA}').`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sourceLanguage: { type: Type.STRING, enum: [langA, langB] },
          transcription: { type: Type.STRING },
          translation: { type: Type.STRING }
        },
        required: ["sourceLanguage", "transcription", "translation"]
      }
    }
  });

  const jsonText = response.text.trim();
  return JSON.parse(jsonText) as GeminiAsrResponse;
}


const voiceMap: { [key in string]: string } = {
    'English (US)': 'Kore',
    'Spanish (Español)': 'Puck',
    'German (Deutsch)': 'Charon',
    'French (Français)': 'Zephyr',
    'Polish (Polski)': 'Fenrir',
    'Turkish (Türkçe)': 'Fenrir',
    'Romanian (Română)': 'Fenrir',
    'Arabic (العربية)': 'Kore',
    'Hindi (हिन्दी)': 'Kore',
    'Indonesian (Bahasa Indonesia)': 'Kore',
    'Italian (Italiano)': 'Puck',
    'Japanese (日本語)': 'Kore',
    'Korean (한국어)': 'Kore',
    'Portuguese (Português)': 'Puck',
    'Russian (Русский)': 'Fenrir',
    'Dutch (Nederlands)': 'Charon',
    'Thai (ไทย)': 'Kore',
    'Vietnamese (Tiếng Việt)': 'Kore',
    'Ukrainian (Українська)': 'Fenrir',
    'Bengali (বাংলা)': 'Kore',
    'Tamil (தமிழ்)': 'Kore',
    'Telugu (తెలుగు)': 'Kore',
    'Marathi (మరాठी)': 'Kore',
}

export async function generateSpeech(
    ai: GoogleGenAI,
    text: string,
    language: string
): Promise<string> {
    const voiceName = voiceMap[language] || 'Kore'; // Default to Kore

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{
            parts: [{ text: `Say in a clear, friendly, and conversational tone: ${text}` }]
        }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
        throw new Error("TTS API did not return audio data.");
    }
    return data;
}
