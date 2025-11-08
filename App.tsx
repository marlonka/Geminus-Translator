



import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { AppState, UploadedImage, AnalysisReport, ChatMessage, MessageRole } from './types';
import { analyzeImages, generateSpeech } from './services/geminiService';
import { playPcmAudio } from './utils/audioUtils';

// FIX: Defined AIStudio interface to resolve subsequent property declaration error.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
}

// --- Helper Functions & Constants ---
const USD_TO_EUR_RATE = 0.86; // As per user request: 1 USD = 0.86 EUR

const PRICING_DATA = {
    'gemini-2.5-flash': {
        input: 0.30, // per 1M tokens
        output: 2.50, // per 1M tokens
    },
    'gemini-2.5-pro': {
        lowTier: { // <= 200k prompt tokens
            input: 1.25,
            output: 10.00,
        },
        highTier: { // > 200k prompt tokens
            input: 2.50,
            output: 15.00,
        }
    }
};

const calculateCost = (model: 'gemini-2.5-flash' | 'gemini-2.5-pro', promptTokens: number, candidatesTokens: number): number | null => {
    if (!model || promptTokens === undefined || candidatesTokens === undefined) return null;

    const M = 1_000_000;
    let costInUsd: number | null = null;
    
    if (model === 'gemini-2.5-flash') {
        const price = PRICING_DATA[model];
        costInUsd = (promptTokens / M) * price.input + (candidatesTokens / M) * price.output;
    } else if (model === 'gemini-2.5-pro') {
        const tier = promptTokens <= 200_000 ? 'lowTier' : 'highTier';
        const price = PRICING_DATA[model][tier];
        costInUsd = (promptTokens / M) * price.input + (candidatesTokens / M) * price.output;
    }
    
    if (costInUsd === null) return null;
    
    return costInUsd * USD_TO_EUR_RATE;
}


const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result !== 'string') {
                return reject(new Error('Failed to read blob as base64 string.'));
            }
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const parseMarkdownForDisplay = (markdown: string): string => {
    const calculatorIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-emerald-700 shrink-0"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`;
    const scanEyeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-emerald-700 shrink-0 mt-1"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/></svg>`;
    
    return markdown
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-3 text-emerald-800">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-4 mb-2 text-emerald-700 border-b-2 border-emerald-200 pb-2">$1</h2>')
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-3 mb-2 text-emerald-800">$1</h3>')
        .replace(/^\s*(?:-)?\s*\**((?:Gesamtzahl der Tiere|Anzahl der Arten).*?)\**:\s*\**\s*(.*?)\s*\**$/gim, `<div class="flex items-center gap-3 text-base mt-4">${calculatorIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong> <span class="text-gray-600">$2</span></div></div>`)
        .replace(/^\s*-\s*\*\*(Anzahl):\*\*\s*\**\s*(.*?)\s*\**$/gim, `<div class="flex items-center gap-3 text-base mt-2">${calculatorIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong> <span class="text-gray-600">$2</span></div></div>`)
        .replace(/^\s*-\s*\*\*(Beobachtungen|Wichtigste Erkenntnisse):\*\*/gim, `<div class="flex items-start gap-3 text-base mt-4">${scanEyeIconSVG}<div><strong class="font-semibold text-gray-700">$1:</strong></div></div>`)
        .replace(/^\s*\*\s+(.*$)/gim, '<li class="list-disc ml-12 text-gray-600">$1</li>')
        .replace(/^\s*-\s+(?!.*\*\*Anzahl|.*\*\*Beobachtungen|.*\*\*Wichtigste)(.*$)/gim, '<p class="text-gray-600 mt-1 ml-9">$1</p>')
        .replace(/^\s*-\s+(?!.*\*\*Anzahl|.*\*\*Beobachtungen)(.*$)/gim, '<li class="list-disc ml-6 text-gray-600">$1</li>')
        .replace(/\(\*(.*?)\*\)/g, '(<em>$1</em>)') // Italic for (*scientific names*)
        .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong class="font-semibold text-gray-700">$1</strong>')
        .replace(/\n/g, '<br />')
        .replace(/<br \/>(\s*<li|<div|<p)/g, '$1')
        .replace(/(<\/li>|<\/div>|<\/p>)<br \/>/g, '$1');
};


interface ParsedSection {
    id: string;
    htmlContent: string;
    images: UploadedImage[];
}

const parseReportToSections = (markdown: string, allImages: UploadedImage[]): ParsedSection[] => {
    if (!markdown) return [];
    
    const sectionsRaw = markdown.split(/^(?=# |## |### )/m).filter(s => s.trim() !== '' && s.trim() !== '---');

    // Remove redundant main title if it exists as the first section
    if (sectionsRaw.length > 0 && sectionsRaw[0].trim().startsWith('# Wildtieranalyse-Bericht')) {
        sectionsRaw.shift();
    }
    
    return sectionsRaw.map((sectionMd, index) => {
        const imageNumbers = new Set<number>();
        const matches = sectionMd.matchAll(/\(Bild\s*([\d,\s]+)\)/g);
        for (const match of matches) {
            const numbersStr = match[1];
            numbersStr.split(',').forEach(numStr => {
                const num = parseInt(numStr.trim(), 10);
                if (!isNaN(num)) imageNumbers.add(num);
            });
        }
        
        const sectionImages = Array.from(imageNumbers)
          .map(num => allImages[num - 1])
          .filter((img): img is UploadedImage => !!img);
        
        const cleanSectionMd = sectionMd.replace(/\s*\n?\(Bild\s*[\d,\s]+\)/g, '');
        const htmlContent = parseMarkdownForDisplay(cleanSectionMd);
        
        return { id: `section-${index}`, htmlContent, images: sectionImages };
    });
};

const parseChatMarkdown = (text: string): string => {
    // The replace function for this was moved to a separate function `cleanToolResponse`
    // to specifically handle tool/thought output before it gets to markdown parsing.
    if (!text) return '';
    let html = text
        // Bold and Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^\s*[\-\*]\s+(.*)$/gm, '<li>$1</li>');
    
    // Wrap consecutive <li>s in <ul>
    html = html.replace(/(<li>(?:.|\n)*?<\/li>)/g, (match) => {
        if (match.includes('<ul>')) return match; // Avoid double wrapping
        return `<ul>${match.replace(/<\/li>\n<li>/g, '</li><li>')}</ul>`;
    });
     html = html.replace(/<\/ul>\n<ul>/g, ''); // Join adjacent lists
    
    // Newlines to <br>
    html = html.replace(/\n/g, '<br />');
    
    // Cleanup extra breaks
    html = html.replace(/<br \/>\s*<ul>/g, '<ul>')
               .replace(/<\/ul>\s*<br \/>/g, '</ul>')
               .replace(/<\/li><br \/>/g, '</li>');

    return html;
};

/**
 * Cleans the raw text response from the model, removing tool code and thought processes.
 * @param text The raw text from the model.
 * @returns The cleaned, user-facing text.
 */
const cleanToolResponse = (text: string | undefined): string => {
    if (!text) return "";

    // Define a list of common German phrases the model might start its actual answer with.
    const answerStarters = [
        "Das ist eine wichtige Präzisierung.",
        "Exotische Arten",
        "Heimische Arten:",
        "Für die heimischen Arten gibt es",
        "Zusammenfassend lässt sich sagen",
    ];

    let bestStartIndex = -1;

    // Find the earliest occurrence of any known starting phrase.
    for (const starter of answerStarters) {
        const index = text.indexOf(starter);
        if (index !== -1) {
            if (bestStartIndex === -1 || index < bestStartIndex) {
                bestStartIndex = index;
            }
        }
    }

    // If a known starter phrase is found, return the text from that point onwards.
    if (bestStartIndex !== -1) {
        return text.substring(bestStartIndex);
    }
    
    // Fallback: If no starter phrase is found but tool/thought markers are present,
    // it indicates an unexpected response format. Return a helpful message.
    if (text.includes('tool_code') || text.includes('thought')) {
        return "Ich habe eine Websuche durchgeführt, konnte die Antwort aber nicht richtig formatieren. Bitte versuchen Sie, die Frage anders zu formulieren.";
    }

    // If no tool output is detected, return the original text.
    return text;
};



// --- SVG Icons ---
const Icons = {
    Microscope: ({ className = "w-8 h-8" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg>
    ),
    ImageUp: ({ className = "w-16 h-16" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/></svg>
    ),
    Brain: ({ className = "w-8 h-8" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>
    ),
    Mic: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    ),
    Reset: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    Speaker: ({ className = "w-5 h-5" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20"/><path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603"/><path d="M17 15a3.5 3.5 0 0 0-.025-4.975"/>
        </svg>
    ),
    AudioLines: ({ className = "w-5 h-5" }) => (
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>
    ),
    Download: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
    ),
    ZoomIn: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
    ),
    CircleX: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
    ),
    Loader: ({ className = "w-5 h-5" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
    ),
    Send: ({ className = "w-6 h-6" }) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg>
    ),
    Globe: ({ className = "w-6 h-6" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
    ),
    GlobeLock: ({ className = "w-6 h-6" }) => (
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15.686 15A14.5 14.5 0 0 1 12 22a14.5 14.5 0 0 1 0-20 10 10 0 1 0 9.542 13"/><path d="M2 12h8.5"/><path d="M20 6V4a2 2 0 1 0-4 0v2"/><rect width="8" height="5" x="14" y="6" rx="1"/></svg>
    ),
    Hash: ({ className = "w-4 h-4" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
    ),
    Wallet: ({ className = "w-4 h-4" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
    ),
    Info: ({ className = "w-4 h-4" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
    ),
    RotateCcw: ({ className = "w-5 h-5" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    ),
};


// --- App Components ---

const ApiKeySelector: React.FC<{ onKeySelected: () => void }> = ({ onKeySelected }) => {
    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            try {
                await window.aistudio.openSelectKey();
                onKeySelected();
            } catch (e) {
                console.error("Error opening key selector:", e);
            }
        }
    };

    return (
        <div className="h-full w-full flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-10 rounded-3xl shadow-lg animate-fade-in-up border border-gray-200 text-center max-w-lg">
                <Icons.GlobeLock className="w-14 h-14 text-emerald-700 mx-auto" />
                <h2 className="text-2xl sm:text-3xl font-bold text-emerald-800 mt-4">API-Schlüssel erforderlich</h2>
                <p className="text-gray-600 mt-4 text-sm sm:text-base">
                    Für den Datei-Upload und die Analyse ist ein API-Schlüssel mit aktivierter Abrechnung erforderlich. Bitte wählen Sie einen Schlüssel aus, um fortzufahren. Die Nutzung der Files API kann Kosten verursachen.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="mt-8 w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-emerald-700 transition-all duration-300 transform hover:scale-102 active:scale-98"
                >
                    API-Schlüssel auswählen
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    Weitere Informationen zur Abrechnung finden Sie in der <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-800">offiziellen Dokumentation</a>.
                </p>
            </div>
        </div>
    );
};


const UploadView: React.FC<{ onFilesSelected: (files: FileList) => void }> = ({ onFilesSelected }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
        else if (e.type === "dragleave") setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) onFilesSelected(e.dataTransfer.files);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) onFilesSelected(e.target.files);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 bg-transparent">
            <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-10 rounded-3xl shadow-lg animate-fade-in-up border border-gray-200">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
                  <Icons.Microscope className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-700" />
                  <h1 className="text-3xl sm:text-4xl font-bold text-emerald-800">Tierwildanalyse</h1>
                </div>
                <p className="text-gray-600 mb-8 max-w-md text-center text-sm sm:text-base">Laden Sie Bilder aus Ihrem Wald hoch, um eine KI-gestützte Analyse der Tierpopulation zu erhalten.</p>
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrop}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-4 ${isDragging ? 'border-emerald-600 bg-emerald-50' : 'border-dashed border-gray-400 bg-gray-50'} rounded-2xl p-8 sm:p-12 cursor-pointer transition-all duration-300 transform hover:scale-102 hover:shadow-md`}
                >
                    <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleChange} />
                    <div className="flex flex-col items-center justify-center space-y-4 text-gray-500">
                        <Icons.ImageUp className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
                        <p className="font-semibold text-gray-600 text-center">Bilder hierher ziehen & ablegen</p>
                        <p className="text-sm text-center">oder klicken, um den Explorer zu öffnen</p>
                        <p className="text-xs text-gray-400 pt-2">Maximal 3.000 Bilder pro Analyse</p>
                    </div>
                </div>
                <div className="flex flex-col items-center mt-8 space-y-3">
                    <p className="text-xs text-gray-500 max-w-xs text-center">
                        Nutzt standardmäßig Gemini 2.5 Pro für präziseste Analyseergebnisse.
                    </p>
                </div>
            </div>
        </div>
    );
};

const ProcessingView: React.FC<{ images: UploadedImage[], progress: number, progressText: string }> = ({ images, progress, progressText }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 bg-transparent">
            <div className="animate-fade-in-up text-center">
                <Icons.Brain className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-600 mx-auto animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mt-6 shimmer-text">{progressText}</h2>
                <p className="text-gray-500 mt-2 text-sm sm:text-base">Gemini zählt, identifiziert und beobachtet die Tiere. Dies kann einen Moment dauern.</p>
                
                <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 mt-8 overflow-hidden">
                    <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${progress * 100}%`, transition: 'width 0.5s ease-out' }}></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{Math.round(progress * 100)}% abgeschlossen</p>

                <div className="mt-8 grid grid-cols-8 gap-2 max-w-2xl mx-auto opacity-30 blur-sm max-h-36 overflow-hidden">
                    {images.map(img => (
                        <div key={img.id} className="relative aspect-square">
                            <img src={img.previewUrl} alt="Vorschau" className="w-full h-full object-cover rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ChatBubble: React.FC<{
    msg: ChatMessage;
    generatingAudioId: string | null;
    playingAudioId: string | null;
    onPlayAudio: (text: string, messageId: string) => void;
}> = React.memo(({ msg, generatingAudioId, playingAudioId, onPlayAudio }) => {
    const isUser = msg.role === MessageRole.USER;
    const isGenerating = generatingAudioId === msg.id;
    const isPlaying = playingAudioId === msg.id;
    const isAssistant = msg.role === MessageRole.ASSISTANT;
    const shouldAnimate = msg.id.startsWith('msg-');

    return (
        <div id={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${shouldAnimate ? 'animate-fade-in-up' : ''}`}>
            <div className={`px-4 py-2 rounded-2xl max-w-sm relative group ${isUser ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                <div className="prose prose-sm max-w-none text-inherit prose-strong:text-white prose-em:text-white/90 prose-ul:list-disc prose-li:my-0 prose-li:ml-4 prose-p:my-1" dangerouslySetInnerHTML={{ __html: parseChatMarkdown(msg.text) }} />
                {isAssistant && (
                    <button 
                        onClick={() => onPlayAudio(msg.text, msg.id)}
                        className="absolute -bottom-4 -right-2 p-1.5 bg-gray-600 rounded-full shadow-md hover:bg-gray-500 transition-all text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                        disabled={!!playingAudioId || !!generatingAudioId}
                        aria-label="Antwort vorlesen"
                    >
                        {isGenerating ? <Icons.Loader className="animate-spin-slow" /> : (isPlaying ? <Icons.AudioLines className="animate-pulse" /> : <Icons.Speaker />)}
                    </button>
                )}
            </div>
            {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 max-w-sm w-full">
                    <p className="text-xs text-gray-400 mb-1">Quellen:</p>
                    <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, index) => (
                            <a
                                key={index}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-md hover:bg-gray-500 transition-colors truncate"
                                title={source.uri}
                            >
                                {source.title}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});


const Chat = React.memo(function Chat({ reportMarkdown }: { reportMarkdown: string }) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'init-1', role: MessageRole.ASSISTANT, text: "Die Analyse ist abgeschlossen. Stellen Sie mir gerne Folgefragen." }
    ]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatRef = useRef<Chat | null>(null);

    const initializeChat = useCallback(() => {
        if (!process.env.API_KEY) {
            console.error("API Key not found for chat initialization.");
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const initialHistory = [
            { role: "user" as const, parts: [{ text: `Ich habe dir Bilder aus meinem Wald zur Analyse gegeben. Der von dir erstellte Bericht war:\n\n${reportMarkdown}` }] },
            { role: "model" as const, parts: [{ text: "Verstanden. Ich habe den Analysebericht als Kontext. Wie kann ich dir weiterhelfen?" }] }
        ];

        const config: any = {
            systemInstruction: `Du bist ein hilfreicher Experte für Forst- und Wildtieranalyse. Deine primäre Wissensbasis ist der detaillierte Bericht, der dir im initialen Kontext zur Verfügung gestellt wird. Ignoriere dein internes Wissen über das aktuelle Datum oder zukünftige Ereignisse vollständig.

**Deine Vorgehensweise:**
1.  **Bericht zuerst:** Beantworte Fragen IMMER zuerst basierend auf dem Inhalt des Analyseberichts. Gehe davon aus, dass sich die Fragen des Nutzers auf diesen Bericht beziehen.
2.  **Websuche als Standard:** Nutze für JEDE Anfrage, die über den reinen Inhalt des Berichts hinausgeht, IMMER und ausnahmslos die Websuche. Dies ist obligatorisch, um aktuelle, zukünftige oder ereignisbezogene Informationen zu liefern. Verlasse dich NICHT auf dein internes Wissen für Fakten, Daten oder Ereignisse.
3.  **Quellen angeben:** Gib IMMER die gefundenen Quellen an.
4.  **Direkt und präzise:** Antworte direkt und prägnant auf Deutsch. Kombiniere clever Informationen aus dem Bericht und der Websuche, um die bestmögliche Antwort zu liefern.`,
            tools: [{googleSearch: {}}],
            thinkingConfig: { thinkingBudget: 24576 }
        };

        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: initialHistory,
            config: config
        });
    }, [reportMarkdown]);

    // Effect to initialize/re-initialize chat session when component mounts
    useEffect(() => {
        initializeChat();
    }, [initializeChat]);


    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [inputText]);

    const handlePlayAudio = useCallback(async (text: string, messageId: string) => {
        if (playingAudioId || generatingAudioId || !process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        setGeneratingAudioId(messageId);
        try {
            const audioData = await generateSpeech(ai, text);
            setPlayingAudioId(messageId);
            await playPcmAudio(audioData);
        } catch (error) {
            console.error("Error playing audio for message:", messageId, error);
        } finally {
            setGeneratingAudioId(null);
            setPlayingAudioId(null);
        }
    }, [playingAudioId, generatingAudioId]);
    
    const submitMessage = async (userText: string) => {
        if (!userText.trim() || !chatRef.current) return;
        
        setIsProcessing(true);
        const userMessageId = `msg-${Date.now()}`;
        setMessages(prev => [...prev, { id: userMessageId, role: MessageRole.USER, text: userText }]);
        
        try {
            const response = await chatRef.current.sendMessage({ message: userText });
            const assistantMessageId = `msg-${Date.now() + 1}`;
            
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            const sources = groundingMetadata?.groundingChunks
                ?.map(chunk => chunk.web)
                .filter((web): web is { uri: string; title: string } => 
                    !!web?.uri && !!web.title && !web.uri.includes('vertexaisearch.cloud.google.com')
                );
            
            const rawResponseText = response.text;
            const cleanedText = cleanToolResponse(rawResponseText);

            const responseText = cleanedText || "Es tut mir leid, ich konnte dazu keine passende Antwort finden. Könnten Sie die Frage umformulieren?";

            setMessages(prev => [...prev, { 
                id: assistantMessageId, 
                role: MessageRole.ASSISTANT, 
                text: responseText,
                sources: sources
            }]);
        } catch (error) {
            console.error("Error in chat:", error);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: MessageRole.ASSISTANT, text: "Entschuldigung, es ist ein Fehler aufgetreten." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinishedRecording = async (audioBlob: Blob) => {
        setIsListening(false);
        if (!process.env.API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        setIsProcessing(true);
        try {
            const base64Audio = await blobToBase64(audioBlob);
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{
                parts: [
                  {text: "Transcribe the following audio recording from German into German text."},
                  {inlineData: { mimeType: audioBlob.type, data: base64Audio }}
                ]
              }]
            });
            
            const userText = response.text.trim();
            if (userText) {
                await submitMessage(userText);
            } else {
                setIsProcessing(false);
            }
        } catch (error) {
            console.error("Error transcribing audio:", error);
            setIsProcessing(false);
        }
    };

    const { startRecording, stopRecording } = useAudioRecorder(handleFinishedRecording);
    
    const handleMicToggle = () => {
        if (isListening) stopRecording();
        else {
            startRecording();
            setIsListening(true);
        }
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitMessage(inputText);
        setInputText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit(e as any);
        }
    };
    
    const handleNewChat = () => {
        setMessages([{ id: 'init-1', role: MessageRole.ASSISTANT, text: "Die Analyse ist abgeschlossen. Stellen Sie mir gerne Folgefragen." }]);
        initializeChat();
    };


    return (
        <div className="bg-gray-900 backdrop-blur-md rounded-2xl shadow-lg flex flex-col h-full border border-gray-700/50">
            <div className="flex justify-between items-center p-4 border-b border-gray-700/80">
                <h3 className="text-lg font-semibold text-gray-300">Dialog</h3>
                <button
                    onClick={handleNewChat}
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    title="Neuer Chat"
                    aria-label="Neuer Chat"
                >
                    <Icons.RotateCcw className="w-5 h-5" />
                </button>
            </div>
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-6 dark-styled-scrollbar">
                {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} generatingAudioId={generatingAudioId} playingAudioId={playingAudioId} onPlayAudio={handlePlayAudio} />)}
                 {isProcessing && !isListening && (
                    <div className="flex justify-start animate-fade-in-up">
                        <div className="px-4 py-2 rounded-2xl max-w-sm bg-gray-700 text-gray-200">
                            <div className="flex items-center gap-2">
                                <Icons.Brain className="animate-spin-slow w-5 h-5"/>
                                <span className="text-sm">Denke nach...</span>
                            </div>
                        </div>
                    </div>
                 )}
            </div>
            <div className="border-t border-gray-700/80 p-2 bg-gray-900/80 rounded-b-2xl">
                 <form onSubmit={handleTextSubmit} className="flex items-end gap-2">
                    <button
                        type="button"
                        onClick={handleMicToggle}
                        disabled={isProcessing}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors duration-200 shrink-0 ${isListening ? 'bg-red-500' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:bg-gray-600`}
                        aria-label={isListening ? 'Aufnahme stoppen' : 'Aufnahme starten'}
                    >
                       {isListening ? <div className="w-3 h-3 bg-white rounded-sm"></div> : <Icons.Mic className="w-5 h-5" />}
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Stellen Sie eine Frage..."
                        rows={1}
                        className="flex-1 bg-gray-800 text-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 max-h-32 styled-scrollbar"
                        disabled={isProcessing || isListening}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isProcessing || isListening}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-emerald-600 hover:bg-emerald-700 transition-colors duration-200 shrink-0 disabled:bg-gray-600 disabled:cursor-not-allowed self-end"
                        aria-label="Nachricht senden"
                    >
                        <Icons.Send className="w-5 h-5" />
                    </button>
                 </form>
            </div>
        </div>
    );
});

const ImageCarousel: React.FC<{ images: UploadedImage[], onImageClick: (image: UploadedImage) => void }> = ({ images, onImageClick }) => {
    if (images.length === 0) return null;
    return (
        <div className="flex gap-3 overflow-x-auto py-3 styled-scrollbar my-2 -mx-1 px-1">
            {images.map(img => (
                <div 
                    key={img.id}
                    onClick={() => onImageClick(img)}
                    className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 shrink-0 rounded-lg overflow-hidden cursor-pointer group border-2 border-transparent hover:border-emerald-600 transition-all duration-300 shadow-sm"
                >
                    <img 
                        src={img.previewUrl} 
                        alt="Analysiertes Bild"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Icons.ZoomIn className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                </div>
            ))}
        </div>
    );
};

const Lightbox: React.FC<{ image: UploadedImage, onClose: () => void }> = ({ image, onClose }) => {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = image.previewUrl;
        link.download = image.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-lightbox-backdrop" onClick={onClose}>
            <div className="relative animate-lightbox-content w-full h-full max-w-screen-lg max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <img src={image.previewUrl} alt="Vollbild" className="w-full h-full object-contain" />
                <div className="absolute top-4 right-4 flex gap-4">
                    <button onClick={handleDownload} className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700 transition-colors">
                        <Icons.Download className="w-6 h-6" />
                    </button>
                    <button onClick={onClose} className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700 transition-colors">
                        <Icons.CircleX className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};


const AnalysisView: React.FC<{ report: AnalysisReport, images: UploadedImage[], onReset: () => void }> = ({ report, images, onReset }) => {
    const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
    const [showCost, setShowCost] = useState<boolean>(false);
    const parsedReportSections = useMemo(() => parseReportToSections(report.markdownContent, images), [report.markdownContent, images]);

    const estimatedCost = useMemo(() => {
        if (!report.modelUsed || report.promptTokenCount === undefined || report.candidatesTokenCount === undefined) return null;
        return calculateCost(report.modelUsed, report.promptTokenCount, report.candidatesTokenCount);
    }, [report]);

    const totalTokens = (report.promptTokenCount || 0) + (report.candidatesTokenCount || 0);


    const handleDownloadReport = () => {
        const blob = new Blob([report.markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'wildtieranalyse-bericht.md');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-screen flex flex-col bg-transparent">
             <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Icons.Microscope className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-700" />
                        <h1 className="text-xl sm:text-2xl font-bold text-emerald-800">Analysebericht</h1>
                        
                         {/* Desktop: Separate Pills */}
                        <div className='hidden sm:flex items-center gap-2'>
                            {totalTokens > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                                    <Icons.Hash className="w-3 h-3" />
                                    <span>{totalTokens.toLocaleString('de-DE')} Tokens</span>
                                </div>
                            )}
                             {estimatedCost !== null && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200" title={`Input: ${report.promptTokenCount?.toLocaleString('de-DE')} / Output: ${report.candidatesTokenCount?.toLocaleString('de-DE')}`}>
                                    <Icons.Wallet className="w-3 h-3" />
                                    <span>~ {estimatedCost.toFixed(4).replace('.', ',')} €</span>
                                </div>
                            )}
                        </div>
                        
                         {/* Mobile: Combined, Tappable Pill */}
                        {(totalTokens > 0 || estimatedCost !== null) && (
                            <div className='flex sm:hidden items-center'>
                                <button 
                                    onClick={() => setShowCost(!showCost)}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 transition-all active:scale-95"
                                    title={showCost ? 'Kosten (Klicken für Tokens)' : 'Tokens (Klicken für Kosten)'}
                                >
                                    {showCost && estimatedCost !== null ? (
                                        <>
                                            <Icons.Wallet className="w-3 h-3" />
                                            <span>~ {estimatedCost.toFixed(4).replace('.', ',')} €</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Hash className="w-3 h-3" />
                                            <span>{totalTokens.toLocaleString('de-DE')} Tokens</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownloadReport} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 shadow-sm">
                            <Icons.Download className="w-5 h-5" />
                            <span className="hidden sm:inline">Bericht Herunterladen</span>
                        </button>
                        <button onClick={onReset} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 shadow-sm">
                            <Icons.Reset className="w-5 h-5" />
                            <span className="hidden sm:inline">Neue Analyse</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 overflow-y-auto styled-scrollbar">
                <div className="lg:col-span-3 bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200">
                    {parsedReportSections.map(section => (
                        <section key={section.id} className="mb-2">
                            <div dangerouslySetInnerHTML={{ __html: section.htmlContent }} className="prose max-w-none"/>
                            <ImageCarousel images={section.images} onImageClick={setSelectedImage} />
                        </section>
                    ))}
                </div>
                <aside className="lg:col-span-2">
                    <div className="h-[75vh] lg:sticky lg:top-6 lg:h-[calc(100vh-120px)]">
                       <Chat reportMarkdown={report.markdownContent} />
                    </div>
                </aside>
            </main>
            {selectedImage && <Lightbox image={selectedImage} onClose={() => setSelectedImage(null)} />}
        </div>
    );
};


const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('Analysiere Bilder...');
    const [hasApiKey, setHasApiKey] = useState(false);
    const progressIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const keySelected = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(keySelected);
            } else {
                setHasApiKey(!!process.env.API_KEY);
            }
        };
        checkApiKey();
        
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        }
    }, []);

    const handleKeySelected = () => {
        setHasApiKey(true);
    };

    const handleFilesSelected = useCallback(async (selectedFiles: FileList) => {
        if (!process.env.API_KEY) {
            setError("API-Schlüssel nicht konfiguriert. Bitte wählen Sie einen Schlüssel aus.");
            setHasApiKey(false);
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        setError(null);
        setProgress(0);
        setAppState(AppState.PROCESSING);
    
        const files = Array.from(selectedFiles).slice(0, 3000);
    
        const initialImages: UploadedImage[] = files
            .filter(file => file.type.startsWith('image/'))
            .map((file, index) => ({
                id: Date.now() + index,
                file,
                base64: '', // Not used in Files API flow
                previewUrl: URL.createObjectURL(file),
            }));
        setImages(initialImages);
    
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
        let uploadedImagesWithUris: UploadedImage[] = [];
    
        try {
            setProgressText("Lade Bilder hoch...");
            
            let completedUploads = 0;
            const uploadPromises = initialImages.map(async (img) => {
                const uploadedFile = await ai.files.upload({
                    file: img.file,
                    config: { mimeType: img.file.type, displayName: img.file.name },
                });
                
                let file = uploadedFile;
                while (file.state === 'PROCESSING') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    file = await ai.files.get({ name: file.name });
                }
    
                if (file.state !== 'ACTIVE') {
                    throw new Error(`Datei ${img.file.name} konnte nicht verarbeitet werden. Status: ${file.state}`);
                }
    
                completedUploads++;
                setProgress((completedUploads / initialImages.length) * 0.5);
    
                return { ...img, fileNameApi: file.name, fileUri: file.uri };
            });
    
            uploadedImagesWithUris = await Promise.all(uploadPromises);
            setImages(uploadedImagesWithUris);
            
            setProgressText("Analysiere Bilder...");
            
            const duration = 60000;
            const tickRate = 100;
            const increment = (0.5 / (duration / tickRate));
            
            progressIntervalRef.current = window.setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev + increment;
                    if (newProgress >= 0.99) {
                        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                        return 0.99;
                    }
                    return newProgress;
                });
            }, tickRate);
    
            const report = await analyzeImages(ai, uploadedImagesWithUris, true);
            
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgress(1);
            setAnalysisReport(report);
            setAppState(AppState.ANALYSIS);
    
        } catch (e) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            const message = e instanceof Error ? e.message : "Unbekannter Fehler";

            if (message.includes('API key not valid') || message.includes('not found') || message.includes('Failed to get upload url')) {
                setError(`API-Schlüsselproblem: ${message}. Bitte versuchen Sie, einen anderen Schlüssel auszuwählen.`);
                setHasApiKey(false); 
                setAppState(AppState.UPLOAD);
                setProgress(0);
                return;
            }

            setError(`Vorgang fehlgeschlagen: ${message}`);
            setAppState(AppState.UPLOAD);
            setProgress(0);
        } finally {
            if (uploadedImagesWithUris.length > 0) {
                console.log("Cleaning up uploaded files in background...");
                Promise.all(uploadedImagesWithUris.map(img => {
                    if (img.fileNameApi) {
                        return ai.files.delete({ name: img.fileNameApi });
                    }
                    return Promise.resolve();
                })).then(() => {
                    console.log("File cleanup complete.");
                }).catch(err => {
                    console.error("File cleanup failed:", err);
                });
            }
        }
    }, []);
    
    const handleReset = () => {
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setAnalysisReport(null);
        setError(null);
        setProgress(0);
        setAppState(AppState.UPLOAD);
    };
    
    if (!hasApiKey) {
        return <ApiKeySelector onKeySelected={handleKeySelected} />;
    }

    const renderContent = () => {
        switch (appState) {
            case AppState.PROCESSING:
                return <ProcessingView images={images} progress={progress} progressText={progressText} />;
            case AppState.ANALYSIS:
                return analysisReport ? <AnalysisView report={analysisReport} images={images} onReset={handleReset} /> : <UploadView onFilesSelected={handleFilesSelected} />;
            case AppState.UPLOAD:
            default:
                return <UploadView onFilesSelected={handleFilesSelected} />;
        }
    };

    return (
        <div className="h-full font-sans">
            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up">
                    {error}
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default App;