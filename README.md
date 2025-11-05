# Geminus Translator

[https://github.com/marlonka/Geminus-Translator](https://github.com/marlonka/Geminus-Translator)

Geminus Translator is a real-time, voice-driven bilingual conversation app powered by the Google Gemini API. It allows two people speaking different languages to communicate seamlessly. Simply select your languages, press start, and speak into your microphone. The app provides instant transcription and audio translation, displaying the conversation in a clean, chat-like interface.

---

## ✨ Features

*   **Real-Time Streaming Translation**: Get instant voice-to-text transcription and text-to-text translation that appear progressively as you speak, powered by Gemini's streaming capabilities.
*   **Dual API Support (Gemini & Vertex AI)**: Easily switch between the standard Gemini API and the enterprise-grade Vertex AI API with a sleek toggle. This allows for flexible testing and deployment on Google Cloud.
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

1.  **API Selection**: The user can choose between the Gemini Developer API or the Vertex AI API via a toggle in the UI. The application dynamically initializes the `@google/genai` client with the appropriate configuration for the selected service.
2.  **Audio Capture**: The app uses the `MediaRecorder` Web API to capture audio from the user's microphone in `webm/opus` format. A custom React hook, `useAudioRecorder`, manages the recording state and implements Voice Activity Detection (VAD) to automatically stop recording when the user finishes speaking.
3.  **Streaming Transcription & Translation**: The captured audio `Blob` is converted to a Base64 string and sent to the **`gemini-2.5-flash`** model using its streaming (`generateContentStream`) capability. A carefully crafted system instruction prompts the model to perform three tasks:
    *   Identify which of the two selected languages was spoken.
    *   Transcribe the spoken audio into text.
    *   Translate the transcription into the other selected language.
    *   Instead of waiting for the full response, the model streams the result in a custom tagged format (e.g., `[LANG]...[/LANG][TRANSCRIPTION]...[/TRANSLATION]`). The frontend parses this stream as it arrives, updating the UI in real-time for a responsive feel.
4.  **Speech Synthesis (TTS)**: The final translated text is sent to the **`gemini-2.5-flash-preview-tts`** model to generate high-quality, natural-sounding speech.
5.  **Audio Playback**: The TTS model returns the audio as raw PCM data encoded in Base64. A utility function decodes this data into an `AudioBuffer` and plays it back using the Web Audio API for low-latency playback.
6.  **Frontend Rendering**: The entire user interface is built with **React**. The application state (e.g., `IDLE`, `LISTENING`, `PROCESSING`) is managed using React hooks (`useState`, `useCallback`), and the conversation is rendered dynamically, with transcription and translation text appearing progressively as the stream from Gemini is processed.

---

## 🛠️ Tech Stack

*   **AI Models**:
    *   **Google Gemini 2.5 Flash**: For combined, streaming audio transcription, language detection, and translation.
    *   **Google Gemini 2.5 Flash TTS**: For text-to-speech synthesis.
*   **SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai) (for both Gemini and Vertex AI)
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
│   ├── ApiToggle.tsx            # UI for the Gemini/Vertex AI toggle switch
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

This project is designed to run in a web environment where the Gemini API key and Google Cloud configuration are securely managed as environment variables.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/marlonka/Geminus-Translator
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    The app can run in two modes. You need to provide the appropriate environment variables for the mode(s) you wish to use.
    *   **For Gemini API Mode**: Create a `.env.local` file and add your Gemini API key.
        ```
        # Required for Gemini API mode
        API_KEY=YOUR_GEMINI_API_KEY
        ```
    *   **For Vertex AI Mode**: Set your Google Cloud Project ID as an environment variable. This is **required** for Vertex AI mode to function, especially when deploying to a service like Google Cloud Run.
        ```
        # Required for Vertex AI mode
        GOOGLE_CLOUD_PROJECT=your-gcp-project-id
        ```
    *Note: The current code uses `process.env`. Your build tool (like Vite or Create React App) must be configured to expose these variables to the client.*

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open your browser to the URL provided by your development server.

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.