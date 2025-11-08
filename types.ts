
export enum AppState {
    UPLOAD = 'UPLOAD',
    PROCESSING = 'PROCESSING',
    ANALYSIS = 'ANALYSIS',
    // Fix: Add missing AppState members for BottomControls component.
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
}

export interface UploadedImage {
    id: number;
    file: File;
    base64: string;
    previewUrl: string;
    fileNameApi?: string; // e.g. 'files/abcdef123'
    fileUri?: string;     // e.g. 'https://generativelanguage.googleapis.com/...'
}

export interface AnalysisReport {
    markdownContent: string;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    modelUsed?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
}

export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
    sources?: {
        uri: string;
        title: string;
    }[];
}

// Fix: Add missing types for ConversationBubble, BottomControls, and RegionSelector components.
export enum Language {
    German = "German (Deutsch)",
    English = "English (US)",
    Spanish = "Spanish (Español)",
    French = "French (Français)",
    Polish = "Polish (Polski)",
    Turkish = "Turkish (Türkçe)",
    Romanian = "Romanian (Română)",
    Arabic = "Arabic (العربية)",
    Hindi = "Hindi (हिन्दी)",
    Indonesian = "Indonesian (Bahasa Indonesia)",
    Italian = "Italian (Italiano)",
    Japanese = "Japanese (日本語)",
    Korean = "Korean (한국어)",
    Portuguese = "Portuguese (Português)",
    Russian = "Russian (Русский)",
    Dutch = "Dutch (Nederlands)",
    Thai = "Thai (ภาษาไทย)",
    Vietnamese = "Vietnamese (Tiếng Việt)",
    Ukrainian = "Ukrainian (Українська)",
    Bengali = "Bengali (বাংলা)",
    Tamil = "Tamil (தமிழ்)",
    Telugu = "Telugu (తెలుగు)",
    Marathi = "Marathi (मराठी)",
}

export interface LanguagePair {
    langA: Language;
    langB: Language;
}

export enum MessageDirection {
    LEFT = 'left',
    RIGHT = 'right',
}

export interface ConversationBubbleMessage {
    id: string;
    direction: MessageDirection;
    sourceLang?: Language;
    targetLang?: Language;
    transcription?: string;
    translation?: string;
    isGeneratingAudio?: boolean;
}

export type VertexRegion = 'europe-west4' | 'europe-west1' | 'us-west1';
