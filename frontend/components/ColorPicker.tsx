import React, { useState } from 'react';
import { PaletteIcon } from './Icons';

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

// Curated palette of modern, vibrant colors + B&W
const PRESETS = [
    "#FFFFFF", // White
    "#000000", // Black
    "#FACC15", // Yellow
    "#EF4444", // Red
    "#3B82F6", // Blue
    "#22C55E", // Green
    "#A855F7", // Purple
    "#EC4899", // Pink
];

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm text-zinc-400">
                <span>{label}</span>
                <span className="font-mono text-xs text-zinc-600 uppercase">{value}</span>
            </div>

            <div className="flex flex-wrap gap-2">
                {PRESETS.map((color) => (
                    <button
                        key={color}
                        onClick={() => onChange(color)}
                        className={`w-8 h-8 rounded-full border border-white/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black ${value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : ''
                            }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                    />
                ))}

                {/* Custom Color Trigger - Animated Rainbow */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden hover:scale-110 transition-transform ring-1 ring-white/20 group">
                    <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] animate-spin [animation-duration:3s]" />
                    <div className="absolute inset-[2px] bg-black rounded-full flex items-center justify-center">
                        <div className="w-full h-full rounded-full opacity-50 bg-[conic-gradient(from_0deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] animate-spin [animation-duration:3s] blur-sm" />
                    </div>
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        title="Custom Color"
                    />
                </div>
            </div>
        </div>
    );
};

export default ColorPicker;
