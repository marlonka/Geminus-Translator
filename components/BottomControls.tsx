import React from 'react';
import { AppState, LanguagePair } from '../types';

// --- SVG Icons ---
const MicIcon = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
);
const VolumeIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);
const MutedIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);
const StopIcon = ({ className = "w-8 h-8" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z" />
    </svg>
);
const ProcessingIcon = ({ className = "w-8 h-8" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);
const LeftRightArrowsIcon = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
);


interface BottomControlsProps {
    appState: AppState;
    amplitude: number;
    languages: LanguagePair;
    autoPlayback: boolean;
    onMicToggle: () => void;
    onLanguageChange: (langKey: 'langA' | 'langB') => void;
    onAutoPlaybackToggle: () => void;
}

const Waveform: React.FC<{ amplitude: number }> = ({ amplitude }) => {
    const barHeight = (amp: number, factor: number) => Math.max(6, Math.min(28, amp * 200 * factor));
    return (
        <div className="flex items-center justify-center h-full w-full space-x-1.5">
            <div className="w-2 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: `${barHeight(amplitude, 1.5)}px` }}></div>
            <div className="w-2 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: `${barHeight(amplitude, 2.0)}px` }}></div>
            <div className="w-2 bg-white rounded-full transition-all duration-75 ease-out" style={{ height: `${barHeight(amplitude, 1.5)}px` }}></div>
        </div>
    );
};

const FabContent: React.FC<{appState: AppState; amplitude: number;}> = ({ appState, amplitude }) => {
    switch (appState) {
        case AppState.LISTENING:
            return <Waveform amplitude={amplitude} />;
        case AppState.PROCESSING:
            return <ProcessingIcon className="w-8 h-8 animate-spin-slow text-white" />;
        case AppState.IDLE:
        default:
            return (
                <div className="flex items-center space-x-2">
                    <MicIcon /> 
                    <span className="font-medium text-lg">Start</span>
                </div>
            );
    }
};

const LanguagePill: React.FC<{lang: string, onClick: () => void, className?: string}> = ({ lang, onClick, className = '' }) => (
    <button 
        onClick={onClick} 
        className={`px-4 py-3 bg-white border border-gray-300 rounded-2xl text-base font-medium text-[#464646] hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm flex-1 text-center ${className}`}
        aria-label={`Select language: ${lang}`}
    >
        {lang.split('(')[0]}
    </button>
);

export const BottomControls: React.FC<BottomControlsProps> = ({ appState, amplitude, languages, autoPlayback, onMicToggle, onLanguageChange, onAutoPlaybackToggle }) => {
    
    const isIdle = appState === AppState.IDLE;
    const mainButtonBaseClasses = "relative flex items-center justify-center bg-[#c3002d] text-white shadow-lg transform transition-all duration-200 ease-out hover:scale-105 active:scale-95";

    if (isIdle) {
        return (
            <footer className="bg-white/80 backdrop-blur-sm p-4 shrink-0 border-t border-gray-200">
                <div className="flex items-center justify-center w-full max-w-lg mx-auto space-x-2">
                    <LanguagePill lang={languages.langA} onClick={() => onLanguageChange('langA')} />
                    <div className="text-[#464646]">
                      <LeftRightArrowsIcon />
                    </div>
                    <LanguagePill lang={languages.langB} onClick={() => onLanguageChange('langB')} />
                </div>
                <div className="flex items-center justify-between w-full max-w-lg mx-auto mt-4">
                    <button 
                      onClick={onAutoPlaybackToggle} 
                      className={`flex items-center space-x-2 text-sm text-slate-500 hover:scale-105 active:scale-95 transition-all duration-200 ${autoPlayback ? 'opacity-100' : 'opacity-60'}`}
                      aria-label={autoPlayback ? 'Auto sound on' : 'Auto sound off'}
                    >
                        {autoPlayback ? <VolumeIcon /> : <MutedIcon />}
                        <span className="text-xs w-36 text-left">{autoPlayback ? 'Auto Sound AN' : 'Auto Sound AUS'}</span>
                    </button>
                    <button
                        onClick={onMicToggle}
                        className={`${mainButtonBaseClasses} w-48 h-16 rounded-full`}
                        aria-label="Start recording"
                    >
                        <FabContent appState={appState} amplitude={amplitude} />
                    </button>
                </div>
            </footer>
        );
    }

    // Listening or Processing State
    return (
         <footer className="bg-white/80 backdrop-blur-sm p-4 shrink-0 border-t border-gray-200">
             <div className="flex items-center justify-between w-full max-w-lg mx-auto h-16">
                 <button 
                   onClick={onAutoPlaybackToggle} 
                   className={`flex items-center space-x-2 text-sm text-slate-500 hover:scale-105 active:scale-95 transition-all duration-200 ${autoPlayback ? 'opacity-100' : 'opacity-60'}`}
                   aria-label={autoPlayback ? 'Auto sound on' : 'Auto sound off'}
                 >
                    {autoPlayback ? <VolumeIcon /> : <MutedIcon />}
                    <span className="text-xs w-36 text-left">{autoPlayback ? 'Auto Sound AN' : 'Auto Sound AUS'}</span>
                 </button>
                 
                 <button
                     onClick={onMicToggle}
                     className={`${mainButtonBaseClasses} w-[150px] h-16 rounded-full`}
                     disabled={appState === AppState.PROCESSING}
                     aria-label="Stop recording"
                 >
                     <FabContent appState={appState} amplitude={amplitude} />
                 </button>
             </div>
         </footer>
    );
};