import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './Icons';

interface FontSelectorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

const fontOptions = [
    {
        label: "Sans Serif",
        options: [
            "Space Grotesk", "Inter", "Roboto", "Open Sans", "Lato",
            "Montserrat", "Poppins", "Raleway", "Work Sans", "Rubik",
            "Oswald", "Fjalla One", "Anton"
        ]
    },
    {
        label: "Serif",
        options: [
            "Merriweather", "Playfair Display", "Lora", "EB Garamond"
        ]
    },
    {
        label: "Display / Modern",
        options: [
            "Bangers", "Cinzel", "Righteous", "Fredoka", "Comfortaa",
            "Lobster", "Pacifico", "Dancing Script", "Permanent Marker"
        ]
    },
    {
        label: "Monospace",
        options: [
            "Roboto Mono", "Courier Prime"
        ]
    }
];

const FontSelector: React.FC<FontSelectorProps> = ({ value, onChange, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-primary/50 outline-none backdrop-blur-sm transition-all hover:bg-black/50 hover:border-white/20 flex items-center justify-between group"
            >
                <span className="truncate" style={{ fontFamily: value }}>{value}</span>
                <ChevronDownIcon className={`w-4 h-4 text-zinc-400 transition-transform duration-200 group-hover:text-white ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 transform origin-top animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
                    <div className="p-1 space-y-1">
                        {fontOptions.map((group) => (
                            <div key={group.label} className="mb-2">
                                <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest sticky top-0 bg-black/95 backdrop-blur-md z-10">
                                    {group.label}
                                </div>
                                <div className="space-y-0.5">
                                    {group.options.map((font) => (
                                        <button
                                            key={font}
                                            onClick={() => {
                                                onChange(font);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between group/item
                                                ${value === font ? 'bg-primary/20 text-primary' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}
                                            `}
                                        >
                                            <span style={{ fontFamily: font }}>{font}</span>
                                            {value === font && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FontSelector;
