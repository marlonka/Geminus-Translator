# Geminus Translator

[https://github.com/marlonka/Geminus-Translator](https://github.com/marlonka/Geminus-Translator)

Geminus Translator is a real-time, voice-driven bilingual conversation app powered by the Google Gemini API. It allows two people speaking different languages to communicate seamlessly. Simply select your languages, press start, and speak into your microphone. The app provides instant transcription and audio translation, displaying the conversation in a clean, chat-like interface.

---

## ✨ Features

*   **Real-Time Streaming Translation**: Get instant voice-to-text transcription and text-to-text translation that appear progressively as you speak, powered by Gemini's streaming capabilities.
*   **Voice-to-Voice Conversation**: The translated text is automatically converted back to speech and played aloud for a natural conversational flow.
*   **Automatic Language Detection**: The app intelligently detects which of the two selected languages is being spoken and translates accordingly.
*   **Voice Activity Detection (VAD)**: The microphone automatically stops recording after a pause in speech, streamlining the user experience.
*   **Multi-Language Support**: Supports 23 languages for broad usability.
*   **Interactive UI**: A modern, responsive interface built with React and Tailwind CSS, featuring smooth animations and clear visual feedback for different app states (listening, processing, idle).
*   **Audio Controls**: Easily toggle auto-playback of translated audio.
*   **Conversation History**: View the full conversation history and replay audio for any message.

---

## 🚀 How It Works

The application leverages the power of Gemini and modern web APIs to create a seamless translation experience:

1.  **Audio Capture**: The app uses the `MediaRecorder` Web API to capture audio from the user's microphone in `webm/opus` format. A custom React hook, `useAudioRecorder`, manages the recording state and implements Voice Activity Detection (VAD) to automatically stop recording when the user finishes speaking.
2.  **Streaming Transcription & Translation**: The captured audio `Blob` is converted to a Base64 string and sent to the **`gemini-2.5-flash`** model using its streaming (`generateContentStream`) capability. A carefully crafted system instruction prompts the model to perform three tasks:
    *   Identify which of the two selected languages was spoken.
    *   Transcribe the spoken audio into text.
    *   Translate the transcription into the other selected language.
    *   Instead of waiting for the full response, the model streams the result in a custom tagged format (e.g., `[LANG]...[/LANG][TRANSCRIPTION]...[/TRANSLATION]`). The frontend parses this stream as it arrives, updating the UI in real-time for a responsive feel.
3.  **Speech Synthesis (TTS)**: The final translated text is sent to the **`gemini-2.5-flash-preview-tts`** model to generate high-quality, natural-sounding speech.
4.  **Audio Playback**: The TTS model returns the audio as raw PCM data encoded in Base64. A utility function decodes this data into an `AudioBuffer` and plays it back using the Web Audio API for low-latency playback.
5.  **Frontend Rendering**: The entire user interface is built with **React**. The application state (e.g., `IDLE`, `LISTENING`, `PROCESSING`) is managed using React hooks (`useState`, `useCallback`), and the conversation is rendered dynamically, with transcription and translation text appearing progressively as the stream from Gemini is processed.

---

## 🛠️ Tech Stack

*   **AI Models**:
    *   **Google Gemini 2.5 Flash**: For combined, streaming audio transcription, language detection, and translation.
    *   **Google Gemini 2.5 Flash TTS**: For text-to-speech synthesis.
*   **Frontend Framework**: [React](https://reactjs.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Core Web APIs**:
    *   `navigator.mediaDevices.getUserMedia`
    *   `MediaRecorder` API
    *   Web Audio API (`AudioContext`)

---

## 📂 Project Structure

```
.
├── components/
│   ├── BottomControls.tsx       # UI for the language selectors and mic button
│   └── ConversationBubble.tsx   # UI for a single message in the chat
├── hooks/
│   └── useAudioRecorder.ts      # Custom hook for managing audio recording and VAD
├── services/
│   └── geminiService.ts         # Logic for all API calls to Gemini (ASR, Translate, TTS)
├── utils/
│   └── audioUtils.ts            # Helper functions for decoding and playing PCM audio
├── App.tsx                      # Main application component, state management
├── index.html                   # HTML entry point
├── index.tsx                    # React root renderer
├── metadata.json                # App metadata and permissions
└── types.ts                     # TypeScript type definitions
```

---

## ⚙️ Getting Started

This project is designed to run in a web environment where the Gemini API key is securely managed.

To run locally, you would typically follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/marlonka/Geminus-Translator
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up API Key:**
    You need a Google Gemini API key. Create a `.env.local` file in the project root and add your key:
    ```
    VITE_API_KEY=YOUR_GEMINI_API_KEY
    ```
    *Note: The current code uses `process.env.API_KEY`. You may need to adjust the code or your build setup (like Vite) to expose the environment variable correctly.*

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open your browser to the URL provided by your development server.

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.