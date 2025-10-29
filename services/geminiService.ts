

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
          { text: "Transcribe and translate the attached audio." },
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
      systemInstruction: `You are an expert audio transcription and translation AI. Your task is to process user-provided audio.
- The audio will be in one of two languages: '${langA}' or '${langB}'.
- Step 1: Identify which language was spoken.
- Step 2: Transcribe the audio into text of the identified language.
- Step 3: Translate the transcription into the other language.
  - If the spoken language is '${langA}', you MUST translate the transcription to '${langB}'.
  - If the spoken language is '${langB}', you MUST translate the transcription to '${langA}'.
- Your final output MUST be a single, valid JSON object containing three keys: "sourceLanguage", "transcription", and "translation".
- For the "sourceLanguage" key, use the exact string for the identified language, which will be either '${langA}' or '${langB}'.
- If the audio is unintelligible, return empty strings for "transcription" and "translation". Do not invent text or use placeholders like 'undefined'.`,
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