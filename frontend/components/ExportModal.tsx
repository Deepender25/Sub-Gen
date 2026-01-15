import React, { useState, useRef, useEffect } from 'react';
import { Subtitle, StyleConfig } from '../types';
import { XIcon, DownloadIcon, FilmIcon } from './Icons';
import { exportVideo } from '../services/api';

interface ExportModalProps {
    videoUrl: string;
    subtitles: Subtitle[];
    styleConfig: StyleConfig;
    currentFilename: string;
    onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ videoUrl, subtitles, styleConfig, currentFilename, onClose }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedFormat, setSelectedFormat] = useState('mp4');
    const [isExporting, setIsExporting] = useState(false);

    // --- Playback Logic ---
    const togglePlay = () => {
        if (!videoRef.current) return;
        isPlaying ? videoRef.current.pause() : videoRef.current.play();
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        let animationFrameId: number;
        const tick = () => {
            if (videoRef.current && !videoRef.current.paused) {
                setCurrentTime(videoRef.current.currentTime);
                animationFrameId = requestAnimationFrame(tick);
            }
        };
        if (isPlaying) {
            animationFrameId = requestAnimationFrame(tick);
        }
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying]);

    // --- Scale Logic ---
    useEffect(() => {
        const updateScale = () => {
            if (videoRef.current && containerRef.current) {
                const video = videoRef.current;
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const elementWidth = video.clientWidth;
                const elementHeight = video.clientHeight;

                if (videoWidth > 0 && videoHeight > 0) {
                    const videoRatio = videoWidth / videoHeight;
                    const elementRatio = elementWidth / elementHeight;

                    let scale = 1;
                    if (elementRatio > videoRatio) {
                        // Pillarboxed (container wider than video)
                        scale = elementHeight / videoHeight;
                    } else {
                        // Letterboxed (container taller than video)
                        scale = elementWidth / videoWidth;
                    }
                    setPreviewScale(scale);
                }
            }
        };
        window.addEventListener('resize', updateScale);
        // Initial call
        updateScale();
        return () => window.removeEventListener('resize', updateScale);
    }, [videoUrl]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            // Force update scale immediately when metadata loads
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const elementWidth = video.clientWidth;
            const elementHeight = video.clientHeight;

            if (videoWidth > 0 && videoHeight > 0) {
                const videoRatio = videoWidth / videoHeight;
                const elementRatio = elementWidth / elementHeight;
                let scale = 1;

                // If container hasn't sized yet, we might rely on width matching
                if (elementRatio > videoRatio) {
                    scale = elementHeight / videoHeight;
                } else {
                    scale = elementWidth / videoWidth;
                }
                setPreviewScale(scale);
            }
        }
    };


    // --- Subtitle Rendering Logic (Duplicated from App.tsx/Display Logic) ---
    const activeSubtitle = subtitles.find(
        s => currentTime >= s.startTime && currentTime <= s.endTime
    );

    const getDisplayedText = () => {
        if (!activeSubtitle) return null;
        if (styleConfig.displayMode === 'sentence') return activeSubtitle.text;
        if (!activeSubtitle.words || activeSubtitle.words.length === 0) return activeSubtitle.text;

        let currentWordIndex = activeSubtitle.words.findIndex(
            w => currentTime >= w.startTime && currentTime <= w.endTime
        );

        if (currentWordIndex === -1) {
            for (let i = activeSubtitle.words.length - 1; i >= 0; i--) {
                if (currentTime >= activeSubtitle.words[i].startTime) {
                    currentWordIndex = i;
                    break;
                }
            }
            if (currentWordIndex === -1) currentWordIndex = 0;
        }

        if (styleConfig.displayMode === 'word') {
            return activeSubtitle.words[currentWordIndex].text;
        }

        if (styleConfig.displayMode === 'phrase') {
            const wordsPerLine = styleConfig.wordsPerLine || 3;
            const allWords = activeSubtitle.words;
            let currentChunk = [];
            let wordCount = 0;

            for (let i = 0; i < allWords.length; i++) {
                const word = allWords[i];
                currentChunk.push(word);
                wordCount++;
                const hasPunctuation = /[.?!,]/.test(word.text);
                const shouldBreak = wordCount >= wordsPerLine || (hasPunctuation && wordCount > 1);

                if (shouldBreak || i === allWords.length - 1) {
                    const startIndex = i - wordCount + 1;
                    const endIndex = i;
                    if (currentWordIndex >= startIndex && currentWordIndex <= endIndex) {
                        return currentChunk.map(w => w.text).join(' ');
                    }
                    currentChunk = [];
                    wordCount = 0;
                }
            }
            return activeSubtitle.text;
        }
        return activeSubtitle.text;
    };


    // --- Export Actions ---
    const handleExportSRT = () => {
        // Generate SRT content
        let srtContent = '';
        subtitles.forEach((sub, index) => {
            const formatTime = (seconds: number) => {
                const date = new Date(0);
                date.setMilliseconds(seconds * 1000);
                return date.toISOString().substr(11, 12).replace('.', ',');
            };
            srtContent += `${index + 1}\n`;
            srtContent += `${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n`;
            srtContent += `${sub.text}\n\n`;
        });

        const blob = new Blob([srtContent], { type: 'text/srt' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFilename.split('.')[0]}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportVideo = async () => {
        setIsExporting(true);
        try {
            const downloadUrl = await exportVideo(currentFilename, subtitles, styleConfig, selectedFormat);
            window.open(downloadUrl, '_blank');
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export video. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportBoth = async () => {
        handleExportSRT();
        await handleExportVideo();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            {/* Glassmorphism Window */}
            <div className="relative w-full max-w-5xl bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[30px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/5 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/5"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                {/* Left: Video Preview */}
                <div className="flex-1 relative bg-black flex items-center justify-center p-8 overflow-hidden group">
                    {/* Video Container */}
                    <div ref={containerRef} className="relative w-full h-full flex justify-center items-center">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="max-w-full max-h-[60vh] object-contain shadow-2xl rounded-2xl border border-white/5"
                            onClick={togglePlay}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={() => setIsPlaying(false)}
                        />
                        {/* Controls Overlay (Minimal) */}
                        {!isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer" onClick={togglePlay}>
                                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
                                    <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1"><path d="M5 3l14 9-14 9V3z" /></svg>
                                </div>
                            </div>
                        )}

                        {/* Subtitle Overlay */}
                        {activeSubtitle && (
                            <div
                                className="absolute w-full flex justify-center pointer-events-none px-4 text-center transition-all duration-75"
                                style={{ top: `${styleConfig.yAlign}%` }}
                            >
                                <span
                                    style={{
                                        fontFamily: styleConfig.fontFamily,
                                        fontSize: `${styleConfig.fontSize * previewScale}px`,
                                        color: styleConfig.color,
                                        backgroundColor: `rgba(${parseInt(styleConfig.backgroundColor.slice(1, 3), 16)}, ${parseInt(styleConfig.backgroundColor.slice(3, 5), 16)}, ${parseInt(styleConfig.backgroundColor.slice(5, 7), 16)}, ${styleConfig.backgroundOpacity})`,
                                        fontWeight: styleConfig.fontWeight,
                                        padding: '0.25em 0.5em',
                                        borderRadius: '0.4em',
                                        maxWidth: '90%',
                                        lineHeight: '1.4',
                                        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                        display: 'inline',
                                        boxDecorationBreak: 'clone',
                                        WebkitBoxDecorationBreak: 'clone',
                                        textAlign: 'center'
                                    }}
                                >
                                    {getDisplayedText()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Export Options */}
                <div className="w-full md:w-80 bg-white/5 border-l border-white/5 p-8 flex flex-col gap-8 shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Export</h2>
                        <p className="text-zinc-400 text-sm">Choose how you want to save your video.</p>
                    </div>

                    <div className="space-y-6">
                        {/* Format Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-300">Video Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['mp4', 'mov', 'avi'].map((fmt) => (
                                    <button
                                        key={fmt}
                                        onClick={() => setSelectedFormat(fmt)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedFormat === fmt
                                            ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-primary-400'
                                            : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {fmt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button onClick={handleExportSRT} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-200 transition-all group">
                                <span className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-[#FFD700]/10 text-[#FFD700]">
                                        <DownloadIcon className="w-4 h-4" />
                                    </div>
                                    <span className="font-medium">Download SRT</span>
                                </span>
                                <span className="text-xs text-zinc-500 group-hover:text-zinc-400">.srt</span>
                            </button>

                            <button onClick={handleExportVideo} disabled={isExporting} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-200 transition-all group disabled:opacity-50 disabled:cursor-wait">
                                <span className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                        <FilmIcon className="w-4 h-4" />
                                    </div>
                                    <span className="font-medium">{isExporting ? 'Procesing...' : 'Download Video'}</span>
                                </span>
                                <span className="text-xs text-zinc-500 group-hover:text-zinc-400">.{selectedFormat}</span>
                            </button>

                            <button onClick={handleExportBoth} disabled={isExporting} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 shadow-xl shadow-white/5 transition-all active:scale-95 disabled:opacity-70">
                                Download Both
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ExportModal;
