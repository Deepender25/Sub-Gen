import React from 'react';
import { StyleConfig } from '../types';
import { TypeIcon, PaletteIcon } from './Icons';

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
        <div className="h-full w-full border-2 border-dashed border-zinc-700/50 rounded-3xl bg-black/20 backdrop-blur-md flex flex-col overflow-hidden shadow-2xl transition-all hover:border-zinc-600/80">
            <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <PaletteIcon className="w-5 h-5 text-primary" />
                    Style Editor
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-8">
                    {/* Display Mode Section - NEW */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            Display Mode
                        </h3>

                        <div className="space-y-3">
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

                            {config.displayMode === 'phrase' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
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
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Typography Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <TypeIcon className="w-4 h-4" /> Typography
                        </h3>

                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Font Family</label>
                            <select
                                value={config.fontFamily}
                                onChange={(e) => update('fontFamily', e.target.value)}
                                className={glassInputClass}
                            >
                                <option value="Space Grotesk" className="bg-zinc-900">Space Grotesk</option>
                                <option value="Inter" className="bg-zinc-900">Inter</option>
                                <option value="Roboto" className="bg-zinc-900">Roboto</option>
                                <option value="Arial" className="bg-zinc-900">Arial</option>
                                <option value="Courier New" className="bg-zinc-900">Courier New</option>
                                <option value="Georgia" className="bg-zinc-900">Georgia</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm text-zinc-400 flex justify-between">
                                    Size (px)
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
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Color Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Colors</h3>

                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Text Color</label>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5">
                                <input
                                    type="color"
                                    value={config.color}
                                    onChange={(e) => update('color', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                                />
                                <span className="text-xs text-zinc-400 font-mono uppercase">{config.color}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Background Color</label>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5">
                                <input
                                    type="color"
                                    value={config.backgroundColor}
                                    onChange={(e) => update('backgroundColor', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={config.backgroundOpacity}
                                    onChange={(e) => update('backgroundOpacity', parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Layout Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Position</h3>
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Vertical Position (%)</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={config.yAlign}
                                onChange={(e) => update('yAlign', Number(e.target.value))}
                                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <div className="flex justify-between text-xs text-zinc-600">
                                <span>Top</span>
                                <span>Bottom</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StyleEditor;