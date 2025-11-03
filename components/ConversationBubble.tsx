
import React, { useState } from 'react';
import { ConversationBubbleMessage, MessageDirection } from '../types';

const SpeakerIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);
const TextSnippetIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
);
const CheckIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
    </svg>
);
const LeftRightArrowsIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
);


export const ConversationBubble: React.FC<{ message: ConversationBubbleMessage; onReplay: (message: ConversationBubbleMessage) => void; isStreaming: boolean; }> = ({ message, onReplay, isStreaming }) => {
    const isUser = message.direction === MessageDirection.RIGHT;
    const [isCopied, setIsCopied] = useState(false);

    const bubbleClasses = isUser
        ? 'bg-sky-100'
        : 'bg-white shadow-sm'; 

    const transcriptionColor = isUser ? 'text-slate-600' : 'text-slate-500';
    const translationColor = 'text-[#464646]';
    const headerTextColor = isUser ? 'text-sky-800' : 'text-slate-500';

    const streamingClasses = isStreaming ? 'streaming-border' : '';

    const handleCopy = () => {
        const textToCopy = `${message.sourceLang}: ${message.transcription}\n${message.targetLang}: ${message.translation}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div className={`p-4 rounded-2xl max-w-md w-auto relative ${bubbleClasses} ${streamingClasses}`}>
                <div className={`flex justify-between items-center mb-2 ${headerTextColor}`}>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span>{message.sourceLang}</span>
                      <LeftRightArrowsIcon />
                      <span>{message.targetLang}</span>
                    </p>
                    <div className="flex items-center space-x-1">
                        <button onClick={() => onReplay(message)} className={`p-1 rounded-full hover:bg-black/10 opacity-70 hover:opacity-100`}>
                            <SpeakerIcon />
                        </button>
                        <button onClick={handleCopy} className={`p-1 rounded-full hover:bg-black/10 opacity-70 hover:opacity-100`}>
                            {isCopied ? <CheckIcon /> : <TextSnippetIcon />}
                        </button>
                    </div>
                </div>
                
                <p className={`text-base min-h-[1.5rem] ${transcriptionColor}`}>
                    {message.transcription}
                </p>
                <p className={`text-base mt-1 font-medium min-h-[1.5rem] ${translationColor}`}>
                    {message.translation}
                </p>
            </div>
        </div>
    );
};