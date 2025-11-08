# Tierwildanalyse

Tierwildanalyse is a powerful web application designed for foresters and wildlife managers in Germany. It leverages the multimodal capabilities of the Google Gemini API to analyze large batches of images from wildlife cameras, providing a comprehensive and structured overview of the animal population in a given area.

---

## ✨ Features

*   **Bulk Image Upload**: An intuitive drag-and-drop interface allows for the quick upload of multiple images at once.
*   **AI-Powered Wildlife Analysis**: Utilizes `gemini-2.5-flash` to perform several tasks in a single request:
    *   **Species Identification**: Accurately identifies various animal species common in German forests.
    *   **Population Count**: Counts the number of individuals for each species across all images.
    *   **Detailed Observations**: Provides insights into group dynamics, presence of offspring, and notable animal behavior.
    *   **Highlights Unusual Events**: A dedicated section for special observations, such as rare species sightings or animals showing signs of distress.
*   **Structured Reporting**: Generates a clean, easy-to-read report in Markdown, logically structured by species, which is then rendered as a professional-looking dashboard.
*   **Conversational Q&A**: After the initial analysis, the user can ask follow-up questions via voice. The app transcribes the speech, sends the query to a Gemini-powered chat that maintains the context of the report, and speaks the answer back to the user.
*   **Modern, Professional UI**: A completely redesigned interface built with React and Tailwind CSS, focused on clarity, efficiency, and a professional aesthetic suitable for data analysis.

---

## 🚀 How It Works

1.  **Image Upload**: The user uploads multiple image files through a web interface. The frontend reads each file, converts it into a Base64 string, and creates a preview URL.
2.  **Multimodal Analysis Prompt**: All image data is sent to the **`gemini-2.5-flash`** model in a single `generateContent` call. This call includes a detailed system instruction that guides the model to act as a wildlife biologist. The prompt explicitly defines the required tasks (identification, counting, observation) and the exact Markdown structure for the output.
3.  **Report Generation & Display**: The model processes the images and text instructions, returning a single, comprehensive Markdown string. The frontend parses this Markdown into HTML and displays it in a clean, dashboard-style view, along with a gallery of the uploaded images.
4.  **Voice-driven Chat for Insights**:
    *   A **Gemini Chat** session is initialized, with the full analysis report provided as the initial context.
    *   The user can ask a voice question. The `useAudioRecorder` hook captures the audio.
    *   The audio is sent to the Gemini model for transcription.
    *   The transcribed text is then sent as a message to the ongoing chat session.
    *   Gemini generates a text response based on the question and the report context.
    *   This text response is sent to the **`gemini-2.5-flash-preview-tts`** model to generate speech.
    *   The audio is played back to the user, creating a seamless, conversational experience for deeper data exploration.

---

## 🛠️ Tech Stack

*   **AI Models**:
    *   **Google Gemini 2.5 Flash**: For multimodal (image + text) analysis and reporting, and for speech-to-text.
    *   **Google Gemini 2.5 Flash TTS**: For text-to-speech synthesis.
*   **SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)
*   **Frontend Framework**: [React](https://reactjs.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Core Web APIs**:
    *   `FileReader` API (for Base64 conversion)
    *   `navigator.mediaDevices.getUserMedia`
    *   `MediaRecorder` API
    *   Web Audio API (`AudioContext`)

---

## 📂 Project Structure (Conceptual)

```
.
├── hooks/
│   └── useAudioRecorder.ts      # Custom hook for managing audio recording
├── services/
│   └── geminiService.ts         # Logic for all API calls to Gemini (Analysis, TTS)
├── utils/
│   └── audioUtils.ts            # Helper functions for decoding and playing PCM audio
├── App.tsx                      # Main application component, state management, and all UI views
├── index.html                   # HTML entry point
├── index.tsx                    # React root renderer
├── metadata.json                # App metadata and permissions
└── types.ts                     # TypeScript type definitions for the new application
```

---

## ⚙️ Getting Started

This project is designed to run in a web environment where the Gemini API key is securely managed as an environment variable.

1.  **Set up Environment Variables:**
    *   Ensure your environment has access to a `API_KEY` for the Gemini API.

2.  **Run the application:**
    *   The application will start on the upload screen. Drag and drop or select image files to begin the analysis.
