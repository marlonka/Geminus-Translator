import { GoogleGenAI, Modality } from "@google/genai";
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

/**
 * Parses the accumulated text from the stream to extract language, transcription, and translation.
 * This parser is robust and can handle malformed closing tags from the API.
 */
function parseStreamedResponse(text: string): Partial<GeminiAsrResponse> {
    const result: Partial<GeminiAsrResponse> = {};

    const langMatch = text.match(/\[LANG\](.*?)\[\/LANG\]/s);
    if (langMatch) {
        result.sourceLanguage = langMatch[1];
    }

    // Handles correct [/TRANSCRIPTION] or the start of the next tag [TRANSLATION] or the end of string as a delimiter.
    // This makes it robust against a missing slash in the closing tag.
    const transMatch = text.match(/\[TRANSCRIPTION\](.*?)(\[\/TRANSCRIPTION\]|\[TRANSLATION\]|$)/s);
    if (transMatch) {
        result.transcription = transMatch[1];
    }
    
    // Handles correct [/TRANSLATION] or the end of the string as the delimiter.
    const translaMatch = text.match(/\[TRANSLATION\](.*?)(\[\/TRANSLATION\]|$)/s);
    if (translaMatch) {
        result.translation = translaMatch[1];
    }

    return result;
}


export async function transcribeAndTranslateStream(
  ai: GoogleGenAI,
  audioBlob: Blob,
  langA: string,
  langB: string,
  onChunk: (chunk: Partial<GeminiAsrResponse>) => void
): Promise<void> {
  console.groupCollapsed(`[API] Calling Gemini for STREAMING transcription & translation`);
  const base64Audio = await blobToBase64(audioBlob);

  const systemInstruction = `You are an expert audio transcription and translation AI. Your task is to process user-provided audio and stream the results in a specific tagged format.
- The audio will be in one of two languages: '${langA}' or '${langB}'.
- First, identify the spoken language. Output it immediately within [LANG] and [/LANG] tags. Example: [LANG]${langA}[/LANG]
- Second, transcribe the audio into text of the identified language. Stream the transcription as it's generated within [TRANSCRIPTION] and [/TRANSCRIPTION] tags.
- Third, translate the transcription into the other language. Stream the translation as it's generated within [TRANSLATION] and [/TRANSLATION] tags.
- The closing tags MUST include a forward slash, like [/TAG]. For example, [/TRANSCRIPTION].

CRITICAL RULES:
- Start streaming your response as soon as possible.
- Output the [LANG] tag block first and only once. It must be closed with [/LANG].
- Then, stream the content for [TRANSCRIPTION] and [TRANSLATION] tags as the text becomes available.
- Ensure all tags are properly closed with a forward slash (e.g., [/TRANSCRIPTION]).
- NEVER repeat words. The transcription and translation must be natural.
- NEVER use the word "undefined". If audio is unclear, output empty tags like [TRANSCRIPTION][/TRANSCRIPTION].`;

  console.log("Languages:", { from: langA, to: langB });
  console.log("System Instruction:", systemInstruction);
  console.log(`Audio Data (Base64 length): ${base64Audio.length}`);
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: "Transcribe and translate the attached audio, streaming the response using the specified tag format." },
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
        systemInstruction: systemInstruction,
      }
    });

    let accumulatedText = '';
    let lastState: Partial<GeminiAsrResponse> = {};

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        console.log(`[API] Stream chunk received, accumulated text is now: "${accumulatedText}"`);

        const currentState = parseStreamedResponse(accumulatedText);
        
        const hasChanged = 
            (currentState.sourceLanguage && currentState.sourceLanguage !== lastState.sourceLanguage) ||
            (currentState.transcription && currentState.transcription !== lastState.transcription) ||
            (currentState.translation && currentState.translation !== lastState.translation);
        
        if (hasChanged) {
            const updateChunk: Partial<GeminiAsrResponse> = {
                ...lastState,
                ...currentState,
            };
            onChunk(updateChunk);
            lastState = updateChunk;
        }
      }
    }
  } catch (error) {
    console.error("[API] Error during streaming transcription/translation:", error);
    throw error;
  } finally {
    console.groupEnd();
  }
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
    console.groupCollapsed(`[API] Calling Gemini for TTS`);
    const voiceName = voiceMap[language] || 'Kore'; // Default to Kore

    console.log(`Text: "${text}"`);
    console.log(`Language: ${language}`);
    console.log(`Voice: ${voiceName}`);

    try {
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
        console.log(`Received audio data (Base64 length): ${data.length}`);
        return data;
    } catch(error) {
        console.error("[API] Error during TTS generation:", error);
        throw error;
    } finally {
        console.groupEnd();
    }
}