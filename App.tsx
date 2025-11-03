import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { ConversationBubble } from './components/ConversationBubble';
import { BottomControls } from './components/BottomControls';
import { Language, AppState, ConversationMessage, LanguagePair, MessageDirection, SystemMessage, ConversationBubbleMessage, GeminiAsrResponse } from './types';
import { transcribeAndTranslateStream, generateSpeech } from './services/geminiService';
import { playPcmAudio } from './utils/audioUtils';

// --- SVG Icons ---
const BackIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
  </svg>
);
const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>;
const CloseIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const listeningPrompts: Record<string, string> = {
    [Language.German]: "Übersetze...",
    [Language.English]: "Translate...",
    [Language.Spanish]: "Traducir...",
    [Language.French]: "Traduire...",
    [Language.Polish]: "Tłumacz...",
    [Language.Turkish]: "Çevir...",
    [Language.Romanian]: "Traduceți...",
    [Language.Arabic]: "ترجم...",
    [Language.Hindi]: "अनुवाद...",
    [Language.Indonesian]: "Menerjemahkan...",
    [Language.Italian]: "Traduci...",
    [Language.Japanese]: "翻訳...",
    [Language.Korean]: "번역...",
    [Language.Portuguese]: "Traduzir...",
    [Language.Russian]: "Перевести...",
    [Language.Dutch]: "Vertalen...",
    [Language.Thai]: "แปล...",
    [Language.Vietnamese]: "Dịch...",
    [Language.Ukrainian]: "Перекласти...",
    [Language.Bengali]: "অনুবাদ...",
    [Language.Tamil]: "மொழிபெயர்...",
    [Language.Telugu]: "అనువదించు...",
    [Language.Marathi]: "भाषांतर...",
}

const instructionalPrompts: Record<string, string> = {
    [Language.German]: "Sprachen auswählen & zum Übersetzen sprechen",
    [Language.English]: "Select languages & speak to translate",
    [Language.Spanish]: "Selecciona idiomas y habla para traducir",
    [Language.French]: "Sélectionnez les langues & parlez",
    [Language.Polish]: "Wybierz języki i mów, aby tłumaczyć",
    [Language.Turkish]: "Dilleri seçin ve çevirmek için konuşun",
    [Language.Romanian]: "Selectați limbile și vorbiți pentru a traduce",
    [Language.Arabic]: "اختر اللغات وتحدث للترجمة",
    [Language.Hindi]: "भाषाएँ चुनें और अनुवाद करने के लिए बोलें",
    [Language.Indonesian]: "Pilih bahasa & bicaralah untuk menerjemahkan",
    [Language.Italian]: "Seleziona le lingue e parla per tradurre",
    [Language.Japanese]: "言語を選択して話すと翻訳します",
    [Language.Korean]: "언어를 선택하고 번역하려면 말하세요",
    [Language.Portuguese]: "Selecione os idiomas e fale para traduzir",
    [Language.Russian]: "Выберите языки и говорите для перевода",
    [Language.Dutch]: "Selecteer talen & spreek om te vertalen",
    [Language.Thai]: "เลือกภาษาและพูดเพื่อแปล",
    [Language.Vietnamese]: "Chọn ngôn ngữ và nói để dịch",
    [Language.Ukrainian]: "Виберіть мови та говоріть для перекладу",
    [Language.Bengali]: "ভাষা নির্বাচন করুন এবং অনুবাদ করতে কথা বলুন",
    [Language.Tamil]: "மொழிகளைத் தேர்ந்தெடுத்து மொழிபெயர்க்கப் பேசுங்கள்",
    [Language.Telugu]: "భాషలను ఎంచుకుని, అనువదించడానికి మాట్లాడండి",
    [Language.Marathi]: "भाषा निवडा आणि भाषांतर करण्यासाठी बोला",
};


const germanLanguageMap: Record<string, string> = {
    [Language.English]: "Englisch",
    [Language.German]: "Deutsch",
    [Language.Spanish]: "Spanisch",
    [Language.French]: "Französisch",
    [Language.Polish]: "Polnisch",
    [Language.Turkish]: "Türkisch",
    [Language.Romanian]: "Rumänisch",
    [Language.Arabic]: "Arabisch",
    [Language.Hindi]: "Hindi",
    [Language.Indonesian]: "Indonesisch",
    [Language.Italian]: "Italienisch",
    [Language.Japanese]: "Japanisch",
    [Language.Korean]: "Koreanisch",
    [Language.Portuguese]: "Portugiesisch",
    [Language.Russian]: "Russisch",
    [Language.Dutch]: "Niederländisch",
    [Language.Thai]: "Thailändisch",
    [Language.Vietnamese]: "Vietnamesisch",
    [Language.Ukrainian]: "Ukrainisch",
    [Language.Bengali]: "Bengalisch",
    [Language.Tamil]: "Tamil",
    [Language.Telugu]: "Telugu",
    [Language.Marathi]: "Marathi",
};

const getLocalizedDisplayName = (lang: Language): string => {
    const germanName = germanLanguageMap[lang];
    const nativeName = lang.match(/\(([^)]+)\)/)?.[0] || '';
    return `${germanName} ${nativeName}`.trim();
};

const cleanText = (text: string | undefined): string => {
    if (!text) return "";

    let cleanedText = text
        .replace(/\bundefined\b/gi, '') // More precise "undefined" removal
        .replace(/\s+/g, ' ')
        .trim();

    // Loop to remove all consecutive duplicates, e.g., "go go go" becomes "go".
    const duplicateWordRegex = /\b(\w+)\s+\1\b/gi;
    while (duplicateWordRegex.test(cleanedText)) {
        cleanedText = cleanedText.replace(duplicateWordRegex, '$1');
    }
    
    return cleanedText;
};

const AnimatedInstructionalHeader: React.FC<{ langA: Language, langB: Language }> = ({ langA, langB }) => {
    const [visibleLang, setVisibleLang] = useState<'A' | 'B'>('A');

    useEffect(() => {
        setVisibleLang('A');
        const intervalId = setInterval(() => {
            setVisibleLang(prev => (prev === 'A' ? 'B' : 'A'));
        }, 4000); // Cycle every 4 seconds

        return () => clearInterval(intervalId);
    }, [langA, langB]);

    const textA = instructionalPrompts[langA] || "Select languages & speak to translate";
    const textB = instructionalPrompts[langB] || instructionalPrompts[Language.English];

    return (
        <div className="relative h-6 w-64 text-center"> {/* Container for positioning */}
            <div 
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out" 
                style={{ opacity: visibleLang === 'A' ? 1 : 0 }}
                aria-hidden={visibleLang !== 'A'}
            >
                <span>{textA}</span>
            </div>
            <div 
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out" 
                style={{ opacity: visibleLang === 'B' ? 1 : 0 }}
                aria-hidden={visibleLang !== 'B'}
            >
                <span>{textB}</span>
            </div>
        </div>
    );
};

const AppHeader: React.FC<{
  appState: AppState;
  languages: LanguagePair;
}> = ({ appState, languages }) => {
    const lang = languages.langA; // Use primary for non-idle states

    switch (appState) {
        case AppState.LISTENING:
            return <div className="relative h-6 flex items-center justify-center"><span>{lang === Language.German ? "Höre zu..." : "Listening..."}</span></div>;
        case AppState.PROCESSING:
            return <div className="relative h-6 flex items-center justify-center"><span>{lang === Language.German ? "Wird übersetzt..." : "Translating..."}</span></div>;
        case AppState.IDLE:
        default:
            return <AnimatedInstructionalHeader langA={languages.langA} langB={languages.langB} />;
    }
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [languages, setLanguages] = useState<LanguagePair>({ langA: Language.German, langB: Language.English });
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [autoPlayback, setAutoPlayback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [langToChange, setLangToChange] = useState<'langA' | 'langB' | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const prevLangB = useRef(languages.langB);
  
  useEffect(() => {
    if (prevLangB.current !== languages.langB) {
      setConversation(prev => {
        if (prev.length > 0) {
          const newMessage: SystemMessage = {
            id: Date.now(),
            type: 'SYSTEM',
            text: `Translation language switched to ${getLocalizedDisplayName(languages.langB)}`,
          };
          console.log(`[SYSTEM] Language switched to: ${languages.langB}`);
          return [...prev, newMessage];
        }
        return prev;
      });
    }
    prevLangB.current = languages.langB;
  }, [languages.langB]);

  useEffect(() => {
     console.log(`[STATE] App state changed to: %c${appState}`, 'font-weight: bold;');
  }, [appState]);

  
  useEffect(() => {
    if (process.env.API_KEY) {
        aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.info("[INIT] GoogleGenAI initialized successfully.");
    } else {
        console.error("[INIT] API_KEY environment variable not set.");
    }
  }, []);
  
 const handleFinishedRecording = useCallback(async (audioBlob: Blob, duration: number) => {
    setAppState(AppState.PROCESSING);
    setError(null);
    if (!aiRef.current) {
        const errorMsg = "Gemini AI not initialized. Please set API_KEY.";
        setError(errorMsg);
        console.error(`[PROCESS] ${errorMsg}`);
        setAppState(AppState.IDLE);
        return;
    }

    const messageId = Date.now();
    
    // Create an initial processing bubble (centered) for immediate feedback.
    const initialBubble: ConversationBubbleMessage = {
        id: messageId,
        type: 'CONVERSATION',
        direction: MessageDirection.RIGHT, // Will be updated by stream
        sourceLang: '',
        targetLang: '',
        transcription: '',
        translation: '',
        audioDuration: duration,
    };

    setConversation(prev => [...prev, initialBubble]);
    setStreamingMessageId(messageId);

    try {
        let finalResult: Partial<GeminiAsrResponse> = {};

        await transcribeAndTranslateStream(
            aiRef.current, 
            audioBlob, 
            languages.langA, 
            languages.langB,
            (chunk) => {
                console.log("[STREAM] Received chunk:", chunk);
                finalResult = { ...finalResult, ...chunk };

                const sourceLanguage = finalResult.sourceLanguage || languages.langA;
                const direction = sourceLanguage === languages.langB ? MessageDirection.LEFT : MessageDirection.RIGHT;
                const targetLang = sourceLanguage === languages.langA ? languages.langB : languages.langA;
                
                setConversation(prev => prev.map(msg => 
                    msg.id === messageId && msg.type === 'CONVERSATION' 
                    ? { 
                        ...msg, 
                        direction,
                        sourceLang: sourceLanguage,
                        targetLang,
                        transcription: finalResult.transcription || '',
                        translation: finalResult.translation || ''
                        } 
                    : msg
                ));
            }
        );
        
        console.log("[PROCESS] Streaming finished. Final result:", finalResult);
        setStreamingMessageId(null);
        
        // Clean up the final text just in case the model includes duplicates despite the prompt.
        const cleanedTranscription = cleanText(finalResult.transcription);
        const cleanedTranslation = cleanText(finalResult.translation);

        setConversation(prev => prev.map(msg =>
            msg.id === messageId && msg.type === 'CONVERSATION'
                ? { ...msg, transcription: cleanedTranscription, translation: cleanedTranslation }
                : msg
        ));

        if (autoPlayback && cleanedTranslation) {
            const finalSourceLang = finalResult.sourceLanguage || languages.langA;
            const finalTargetLang = finalSourceLang === languages.langA ? languages.langB : languages.langA;

            console.info("[PROCESS] Auto-playback enabled. Generating speech...");
            generateSpeech(aiRef.current, cleanedTranslation, finalTargetLang)
            .then(audioData => {
                console.log("[PROCESS] Speech generated. Updating message with audio data.");
                setConversation(prev => prev.map(msg => 
                msg.id === messageId && msg.type === 'CONVERSATION' ? { ...msg, base64Audio: audioData } : msg
                ));
                playPcmAudio(audioData);
            })
            .catch(e => {
                console.error("[PROCESS] Failed to generate or play speech.", e);
                setError("Die Übersetzung konnte nicht wiedergegeben werden.");
            });
        }

    } catch (e) {
        console.error("[PROCESS] Error during stream processing:", e);
        setError("Entschuldigung, das habe ich nicht verstanden. Bitte erneut versuchen.");
        setConversation(prev => prev.filter(msg => msg.id !== messageId));
        setStreamingMessageId(null);
    } finally {
        setAppState(AppState.IDLE);
    }
}, [autoPlayback, languages]);


  const { isRecording, amplitude, startRecording, stopRecording } = useAudioRecorder(handleFinishedRecording);
  
  const handleMicToggle = () => {
    if (appState === AppState.LISTENING) {
      console.log("[CONTROL] Mic toggled: Stopping recording.");
      stopRecording();
    } else if (appState === AppState.IDLE) {
      if (!process.env.API_KEY) {
        setError("API_KEY environment variable not set.");
        return;
      }
      console.log("[CONTROL] Mic toggled: Starting recording.");
      setError(null);
      startRecording();
      setAppState(AppState.LISTENING);
    }
  };
  
  const handleOpenModal = (langKey: 'langA' | 'langB') => {
    setLangToChange(langKey);
    setIsModalOpen(true);
  };

  const handleLanguageChange = (lang: Language, keyToChange: 'langA' | 'langB') => {
    setLanguages(prev => {
        const otherKey = keyToChange === 'langA' ? 'langB' : 'langA';
        const otherLang = prev[otherKey];

        if (otherLang === lang) {
            // Swap if the selected language is the same as the other language
            return {
                ...prev,
                [keyToChange]: lang,
                [otherKey]: prev[keyToChange]
            };
        } else {
            // Otherwise, just update the selected language
            return { ...prev, [keyToChange]: lang };
        }
    });
  };

  const handleSelectLanguageFromModal = (lang: Language) => {
    if (langToChange) {
        handleLanguageChange(lang, langToChange);
    }
    setIsModalOpen(false);
    setLangToChange(null);
  };

  const handleQuickSelect = (lang: Language) => {
      const keyToChange = 'langB';
      handleLanguageChange(lang, keyToChange);
  };

  const handleClearConversation = () => {
    console.warn("[CONTROL] Clearing conversation history.");
    setConversation([]);
    stopRecording();
    setAppState(AppState.IDLE);
  };

  const handleReplayAudio = async (message: ConversationBubbleMessage) => {
    if (!aiRef.current || !message.targetLang) return;
    console.groupCollapsed(`[CONTROL] Replaying audio for message ID: ${message.id}`);
    
    if (message.base64Audio) {
      console.log("Playing existing audio data.");
      await playPcmAudio(message.base64Audio);
    } else {
      try {
        console.log("No existing audio. Generating new speech...");
        const audioData = await generateSpeech(aiRef.current, message.translation, message.targetLang);
        console.log("Speech generated. Updating message and playing audio.");
        setConversation(conv => conv.map(m => m.id === message.id && m.type === 'CONVERSATION' ? {...m, base64Audio: audioData} : m));
        await playPcmAudio(audioData);
      } catch (e) {
        console.error("Failed to generate speech for replay", e);
        setError("Audio konnte nicht abgespielt werden.");
      }
    }
    console.groupEnd();
  };

  const QuickSelectButton: React.FC<{ lang: Language, onClick: (lang: Language) => void }> = ({ lang, onClick }) => (
    <button 
      onClick={() => onClick(lang)} 
      className="flex items-center space-x-4 text-left bg-white text-[#464646] px-4 py-3 rounded-2xl w-full shadow-sm hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label={`Quick select ${getLocalizedDisplayName(lang)}`}
    >
        <HistoryIcon />
        <span className="font-medium">{getLocalizedDisplayName(lang)}</span>
    </button>
  );

  const quickSelectLanguages = [Language.Polish, Language.Turkish, Language.Romanian];

  return (
    <>
      <div className="flex flex-col h-full font-sans bg-[#FDFBF6] text-[#464646]">
        <header className="flex items-center justify-between p-2 md:px-4 shrink-0">
           <button 
             onClick={handleClearConversation} 
             className={`p-2 rounded-full hover:bg-gray-200 hover:scale-110 active:scale-95 transition-all duration-200 ${conversation.length > 0 ? 'visible' : 'invisible'}`}
             aria-label="Clear conversation"
           >
            <BackIcon />
           </button>
           <h1 className="text-sm font-medium tracking-wide text-center">
             <AppHeader 
                appState={appState}
                languages={languages}
             />
           </h1>
          <div className="flex items-center w-10">
              {/* Placeholder for alignment */}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
          {conversation.length === 0 && appState === AppState.IDLE && (
             <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="animate-fade-in-up" style={{ animationDuration: '0.5s' }}>
                  <h2 className="text-4xl font-normal text-[#464646]">{listeningPrompts[languages.langA] || "Translate..."}</h2>
                  <p className="text-4xl font-normal text-gray-400">{listeningPrompts[languages.langB] || "Translate..."}</p>
                </div>
                  <div className="w-full max-w-xs mt-12 space-y-3">
                    {quickSelectLanguages.map((lang, index) => (
                      <div key={lang} className="animate-fade-in-up" style={{ animationDelay: `${150 + index * 100}ms`, animationFillMode: 'backwards' }}>
                        <QuickSelectButton lang={lang} onClick={handleQuickSelect} />
                      </div>
                    ))}
                  </div>
             </div>
          )}
          {conversation.map((msg) => {
            if (msg.type === 'SYSTEM') {
              return <SystemMessageBubble key={msg.id} message={msg} />;
            }
            return <ConversationBubble key={msg.id} message={msg} onReplay={handleReplayAudio} isStreaming={streamingMessageId === msg.id} languages={languages} />;
          })}
          <div className="h-4" />
          {error && <div className="fixed bottom-28 left-1/2 -translate-x-1/2 text-center text-white p-3 bg-[#c3002d] rounded-xl shadow-lg animate-fade-in-up">{error}</div>}
        </main>

        <BottomControls 
          appState={appState}
          amplitude={amplitude}
          languages={languages}
          autoPlayback={autoPlayback}
          onMicToggle={handleMicToggle}
          onLanguageChange={handleOpenModal}
          onAutoPlaybackToggle={() => setAutoPlayback(p => !p)}
        />
      </div>
      <LanguageSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handleSelectLanguageFromModal}
      />
    </>
  );
};

const LanguageSelectionModal: React.FC<{isOpen: boolean, onClose: () => void, onSelect: (lang: Language) => void}> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-modal-bg-fade-in" onClick={onClose}>
            <div className="bg-white rounded-3xl p-4 w-full max-w-sm m-4 flex flex-col relative animate-modal-content-pop-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-xl font-medium text-[#464646]">Sprache auswählen</h3>
                    <button 
                      onClick={onClose} 
                      className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-200"
                      aria-label="Close modal"
                    >
                        <CloseIcon />
                    </button>
                </div>
                <div className="max-h-80 overflow-y-auto hide-scrollbar scroll-fader pr-2">
                    {Object.values(Language).map(lang => (
                        <button
                            key={lang}
                            onClick={() => onSelect(lang)}
                            className="w-full p-3 text-left rounded-lg text-[#464646] hover:bg-sky-100 hover:scale-102 active:scale-98 transition-all duration-150"
                            aria-label={`Select ${getLocalizedDisplayName(lang)}`}
                        >
                            {getLocalizedDisplayName(lang)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SystemMessageBubble: React.FC<{ message: SystemMessage }> = ({ message }) => (
    <div className="flex justify-center my-2 animate-fade-in-up">
        <div className="text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1">
            {message.text}
        </div>
    </div>
);

export default App;