import React from 'react';

const CloudIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
  </svg>
);

const SparklesIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);


interface ApiToggleProps {
  useVertexAI: boolean;
  onToggle: () => void;
}

export const ApiToggle: React.FC<ApiToggleProps> = ({ useVertexAI, onToggle }) => {
  const optionWrapperClasses = "relative z-10 flex items-center justify-center w-[92px] cursor-pointer px-2 py-1 space-x-1.5";

  return (
    <button
      onClick={onToggle}
      className="relative flex items-center h-9 p-0.5 rounded-full bg-slate-100/80 border border-slate-200/80 shadow-inner"
      aria-label={`Switch to ${useVertexAI ? 'Gemini API' : 'Vertex AI'}`}
    >
      {/* Sliding background */}
      <div
        className={`absolute top-0.5 left-0.5 h-8 w-[92px] rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out ${
          useVertexAI ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      
      {/* Gemini Option */}
      <div className={optionWrapperClasses}>
        <SparklesIcon className={`w-4 h-4 transition-colors duration-300 ${!useVertexAI ? 'text-purple-600' : 'text-slate-400'}`} />
        <span className={`text-xs font-semibold transition-colors duration-300 ${!useVertexAI ? 'text-slate-800' : 'text-slate-500'}`}>
          Gemini
        </span>
      </div>

      {/* Vertex Option */}
      <div className={optionWrapperClasses}>
        <CloudIcon className={`w-4 h-4 transition-colors duration-300 ${useVertexAI ? 'text-blue-600' : 'text-slate-400'}`} />
        <span className={`text-xs font-semibold transition-colors duration-300 ${useVertexAI ? 'text-slate-800' : 'text-slate-500'}`}>
          Vertex
        </span>
      </div>
    </button>
  );
};
