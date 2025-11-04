
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
  onChunk: (chunk: Partial<GeminiAsrResponse>) => void,
  maxRetries: number = 2
): Promise<void> {
  console.groupCollapsed(`[API] Calling Gemini for STREAMING transcription & translation`);
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const base64Audio = await blobToBase64(audioBlob);
      
      // Validate audio blob
      if (audioBlob.size === 0) {
        throw new Error("Audio blob is empty");
      }
      
      if (audioBlob.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error("Audio file too large (max 10MB)");
      }

      const systemInstruction = `You are an expert audio transcription and translation AI. Your task is to process user-provided audio and stream the results in a specific tagged format.

LANGUAGE CONFIGURATION:
- Language A: '${langA}'
- Language B: '${langB}'
- The audio will be spoken in EITHER '${langA}' OR '${langB}'.

YOUR TASK:
1. IDENTIFY the spoken language. Output it immediately within [LANG] and [/LANG] tags.
   Example: [LANG]${langA}[/LANG]

2. TRANSCRIBE the audio into text of the identified language within [TRANSCRIPTION] and [/TRANSCRIPTION] tags.

3. TRANSLATE the transcription using these EXACT rules:
   - IF you identified the language as '${langA}', you MUST translate into '${langB}' (NOT any other language)
   - IF you identified the language as '${langB}', you MUST translate into '${langA}' (NOT any other language)
   - Output the translation within [TRANSLATION] and [/TRANSLATION] tags.

CRITICAL RULES:
- Start streaming your response as soon as possible.
- Output the [LANG] tag block first and only once. It must be closed with [/LANG].
- Then stream [TRANSCRIPTION] and [TRANSLATION] tags as content becomes available.
- All closing tags MUST include a forward slash: [/TRANSCRIPTION], [/TRANSLATION].
- The translation MUST be in the target language specified above. DO NOT translate into any third language like English if it's not one of the two configured languages.
- NEVER repeat words. The transcription and translation must be natural.
- NEVER use the word "undefined". If audio is unclear, output empty tags or state "Audio unclear".

EXAMPLE:
If configured with '${langA}' and '${langB}':
- Audio in '${langA}' → [LANG]${langA}[/LANG] → Translate to '${langB}'
- Audio in '${langB}' → [LANG]${langB}[/LANG] → Translate to '${langA}'`;

      console.log("Languages:", { from: langA, to: langB });
      console.log(`Audio Data (Base64 length): ${base64Audio.length}`);
      console.log(`Attempt: ${attempt + 1}/${maxRetries + 1}`);
      
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
      let hasReceivedAnyData = false;

      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        if (chunkText) {
          hasReceivedAnyData = true;
          accumulatedText += chunkText;
          console.log(`[API] Stream chunk received, accumulated: "${accumulatedText.substring(0, 100)}..."`);

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
      
      // Validate we received complete data
      if (!hasReceivedAnyData) {
        throw new Error("No data received from API");
      }
      
      if (!lastState.sourceLanguage || !lastState.transcription) {
        throw new Error("Incomplete response from API");
      }
      
      console.groupEnd();
      return; // Success!
      
    } catch (error) {
      lastError = error as Error;
      console.error(`[API] Error on attempt ${attempt + 1}:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.groupEnd();
  // All retries failed
  throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
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
    language: string,
    maxRetries: number = 2
): Promise<string> {
    console.groupCollapsed(`[API] Calling Gemini for TTS`);
    const voiceName = voiceMap[language] || 'Kore';

    console.log(`Text: "${text.substring(0, 50)}..."`);
    console.log(`Language: ${language}`);
    console.log(`Voice: ${voiceName}`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
          if (!text || text.trim().length === 0) {
            throw new Error("Empty text provided for TTS");
          }
          
          if (text.length > 5000) {
            throw new Error("Text too long for TTS (max 5000 characters)");
          }

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
          console.groupEnd();
          return data;
          
      } catch(error) {
          lastError = error as Error;
          console.error(`[API] TTS error on attempt ${attempt + 1}:`, error);
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
            console.log(`[API] Retrying TTS in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
      }
    }
    
    console.groupEnd();
    throw new Error(`TTS failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}