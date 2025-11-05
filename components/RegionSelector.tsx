import React, { useState, useRef, useEffect } from 'react';
import { VertexRegion } from '../types';

// Chevron Icon
const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

interface RegionSelectorProps {
    currentRegion: VertexRegion;
    onRegionChange: (region: VertexRegion) => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({ currentRegion, onRegionChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const regions: VertexRegion[] = ['europe-west4', 'europe-west1', 'us-west1'];
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelect = (region: VertexRegion) => {
        onRegionChange(region);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 h-9 pl-3 pr-2 rounded-full bg-slate-100/80 border border-slate-200/80 shadow-inner text-xs font-semibold text-slate-600 hover:bg-slate-200/80 transition-colors"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Current region: ${currentRegion}`}
            >
                <span>{currentRegion}</span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <ul
                    className="absolute z-10 top-full mt-1.5 w-full bg-white rounded-lg shadow-lg border border-gray-200/80 overflow-hidden animate-fade-in-up"
                    style={{ animationDuration: '0.2s' }}
                    role="listbox"
                >
                    {regions.map(region => (
                        <li key={region}>
                            <button
                                onClick={() => handleSelect(region)}
                                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-sky-100 transition-colors ${currentRegion === region ? 'bg-sky-50 text-sky-700' : 'text-slate-600'}`}
                                role="option"
                                aria-selected={currentRegion === region}
                            >
                                {region}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};