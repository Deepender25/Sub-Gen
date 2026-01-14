import React from 'react';
import { StyleConfig } from '../types';
import { TypeIcon, PaletteIcon } from './Icons';
import FontSelector from './FontSelector';
import ColorPicker from './ColorPicker';

interface StyleEditorProps {
    config: StyleConfig;
    onChange: (newConfig: StyleConfig) => void;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ config, onChange }) => {
    const update = (key: keyof StyleConfig, value: any) => {
        onChange({ ...config, [key]: value });
    };

    const glassInputClass = "w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-primary/50 outline-none backdrop-blur-sm transition-all hover:bg-black/50 hover:border-white/20";

    return (
        <div className="h-full w-full bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <PaletteIcon className="w-5 h-5 text-primary" />
                    Style Editor
                </h2>
                <p className="text-xs text-zinc-400 mt-1">Customize appearance & layout</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-8">

                    {/* --- 1. TYPOGRAPHY & TEXT STYLE --- */}
                    <div className="space-y-5">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <TypeIcon className="w-4 h-4" /> Text Style
                        </h3>

                        {/* Font Family */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Font</label>
                            <FontSelector
                                value={config.fontFamily}
                                onChange={(val) => update('fontFamily', val)}
                            />
                        </div>

                        {/* Font Size */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 flex justify-between">
                                Size
                                <span className="text-white text-xs">{config.fontSize}px</span>
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="range"
                                    min="12"
                                    max="400"
                                    value={config.fontSize}
                                    onChange={(e) => update('fontSize', Number(e.target.value))}
                                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary self-center"
                                />
                                <input
                                    type="number"
                                    value={config.fontSize}
                                    onChange={(e) => update('fontSize', Number(e.target.value))}
                                    className="w-16 bg-black/40 border border-white/10 rounded-lg p-1.5 text-sm text-center text-white focus:ring-2 focus:ring-primary/50 outline-none backdrop-blur-sm"
                                />
                            </div>
                        </div>

                        {/* Weight Row */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Weight</label>
                            <select
                                value={config.fontWeight}
                                onChange={(e) => update('fontWeight', e.target.value)}
                                className={glassInputClass}
                            >
                                <option value="400" className="bg-zinc-900">Regular</option>
                                <option value="600" className="bg-zinc-900">Semi-Bold</option>
                                <option value="800" className="bg-zinc-900">Bold</option>
                            </select>
                        </div>

                        {/* Text Color - Full Width for Consistency */}
                        <div className="pt-2">
                            <ColorPicker
                                label="Text Color"
                                value={config.color}
                                onChange={(val) => update('color', val)}
                            />
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* --- 2. LAYOUT & DISPLAY --- */}
                    <div className="space-y-5">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            Layout
                        </h3>

                        {/* Display Mode */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Display Mode</label>
                            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                                {(['word', 'phrase', 'sentence'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => update('displayMode', mode)}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${config.displayMode === mode
                                            ? 'bg-primary text-white shadow-lg'
                                            : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Words Per Line (Conditional) */}
                        {config.displayMode === 'phrase' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 p-3 bg-white/5 rounded-lg border border-white/5">
                                <label className="text-xs text-zinc-400 flex justify-between">
                                    <span>Words per line</span>
                                    <span className="text-white">{config.wordsPerLine || 3}</span>
                                </label>
                                <input
                                    type="range"
                                    min="2"
                                    max="8"
                                    step="1"
                                    value={config.wordsPerLine || 3}
                                    onChange={(e) => update('wordsPerLine', Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        )}

                        {/* Vertical Position */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 flex justify-between">
                                Vertical Position
                                <span className="text-xs text-zinc-500">{config.yAlign}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={config.yAlign}
                                onChange={(e) => update('yAlign', Number(e.target.value))}
                                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* --- 3. BACKGROUND EFFECTS --- */}
                    <div className="space-y-5">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            Background
                        </h3>

                        <div className="space-y-4">
                            <ColorPicker
                                label="Background Color"
                                value={config.backgroundColor}
                                onChange={(val) => update('backgroundColor', val)}
                            />

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 flex justify-between">
                                    Opacity
                                    <span className="text-xs text-zinc-500">{Math.round(config.backgroundOpacity * 100)}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={config.backgroundOpacity}
                                    onChange={(e) => update('backgroundOpacity', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StyleEditor;