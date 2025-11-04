export enum AppState {
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    PROCESSING = 'PROCESSING',
}

export enum Language {
    English = 'English (US)',
    German = 'German (Deutsch)',
    Spanish = 'Spanish (Español)',
    French = 'French (Français)',
    Polish = 'Polish (Polski)',
    Turkish = 'Turkish (Türkçe)',
    Romanian = 'Romanian (Română)',
    Arabic = 'Arabic (العربية)',
    Hindi = 'Hindi (हिन्दी)',
    Indonesian = 'Indonesian (Bahasa Indonesia)',
    Italian = 'Italian (Italiano)',
    Japanese = 'Japanese (日本語)',
    Korean = 'Korean (한국어)',
    Portuguese = 'Portuguese (Português)',
    Russian = 'Russian (Русский)',
    Dutch = 'Dutch (Nederlands)',
    Thai = 'Thai (ไทย)',
    Vietnamese = 'Vietnamese (Tiếng Việt)',
    Ukrainian = 'Ukrainian (Українська)',
    Bengali = 'Bengali (বাংলা)',
    Tamil = 'Tamil (தமிழ்)',
    Telugu = 'Telugu (తెలుగు)',
    Marathi = 'Marathi (మరాठी)',
}

export enum MessageDirection {
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
}

export interface LanguagePair {
    langA: Language;
    langB: Language;
}

export interface BaseMessage {
  id: number;
  type: 'CONVERSATION' | 'SYSTEM';
}

export interface ConversationBubbleMessage extends BaseMessage {
  type: 'CONVERSATION';
  direction?: MessageDirection;
  sourceLang?: string;
  targetLang?: string;
  transcription?: string;
  translation?: string;
  audioDuration?: number;
  base64Audio?: string;
  isGeneratingAudio?: boolean;
}

export interface SystemMessage extends BaseMessage {
    type: 'SYSTEM';
    text: string;
}

export type ConversationMessage = ConversationBubbleMessage | SystemMessage;


export interface GeminiAsrResponse {
    sourceLanguage: string;
    transcription: string;
    translation: string;
}