import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Subtitle, StyleConfig } from '../types';
import { XIcon, DownloadIcon, FilmIcon } from './Icons';
import { exportVideo } from '../services/api';
import { DynamicSubtitle } from './DynamicSubtitle';
import { buildSubtitleEntries, generateSRTContent, SubtitleEntry } from '../utils/subtitleUtils';
import ClientExporter from './ClientExporter';

interface ExportModalProps {
    videoUrl: string;
    subtitles: Subtitle[];
    styleConfig: StyleConfig;
    currentFilename: string;
    onClose: () => void;
}

type ExportMode = 'server' | 'client';
type ExportState = 'idle' | 'exporting' | 'client-exporting' | 'complete';

const ExportModal: React.FC<ExportModalProps> = ({ videoUrl, subtitles, styleConfig, currentFilename, onClose }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedFormat, setSelectedFormat] = useState('mp4');
    const [exportState, setExportState] = useState<ExportState>('idle');
    const [exportMode, setExportMode] = useState<ExportMode>('server');
    const [clientDownloadUrl, setClientDownloadUrl] = useState<string | null>(null);
    const [videoWidth, setVideoWidth] = useState(1080);
    const [videoHeight, setVideoHeight] = useState(1920);

    // Pre-compute subtitle entries using unified logic
    const subtitleEntries = useMemo(() => {
        return buildSubtitleEntries(subtitles, styleConfig);
    }, [subtitles, styleConfig]);

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
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const elementWidth = video.clientWidth;
                const elementHeight = video.clientHeight;

                if (vw > 0 && vh > 0) {
                    const videoRatio = vw / vh;
                    const elementRatio = elementWidth / elementHeight;

                    let scale = 1;
                    if (elementRatio > videoRatio) {
                        scale = elementHeight / vh;
                    } else {
                        scale = elementWidth / vw;
                    }
                    setPreviewScale(scale);
                }
            }
        };
        window.addEventListener('resize', updateScale);
        updateScale();
        return () => window.removeEventListener('resize', updateScale);
    }, [videoUrl]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            setVideoWidth(video.videoWidth || 1080);
            setVideoHeight(video.videoHeight || 1920);

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const elementWidth = video.clientWidth;
            const elementHeight = video.clientHeight;

            if (vw > 0 && vh > 0) {
                const videoRatio = vw / vh;
                const elementRatio = elementWidth / elementHeight;
                let scale = 1;
                if (elementRatio > videoRatio) {
                    scale = elementHeight / vh;
                } else {
                    scale = elementWidth / vw;
                }
                setPreviewScale(scale);
            }
        }
    };

    // --- Get displayed text using pre-computed entries ---
    const getDisplayedText = () => {
        const activeEntry = subtitleEntries.find(
            e => currentTime >= e.startTime && currentTime <= e.endTime
        );
        return activeEntry?.text || null;
    };

    // --- Export Actions ---
    const handleExportSRT = () => {
        // Use pre-computed entries for perfect consistency
        const srtContent = generateSRTContent(subtitleEntries);
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
        if (exportMode === 'client') {
            setExportState('client-exporting');
        } else {
            setExportState('exporting');
            try {
                const downloadUrl = await exportVideo(currentFilename, subtitles, styleConfig, selectedFormat);
                window.open(downloadUrl, '_blank');
                setExportState('complete');
            } catch (error) {
                console.error("Export failed:", error);
                alert("Failed to export video. Please try again.");
                setExportState('idle');
            }
        }
    };

    const handleClientExportComplete = (blobUrl: string) => {
        setClientDownloadUrl(blobUrl);
        setExportState('complete');
    };

    const handleClientExportError = (error: string) => {
        console.error('Client export error:', error);
        alert(`Client-side export failed: ${error}\n\nTry using server-side export instead.`);
        setExportState('idle');
    };

    const handleClientExportCancel = () => {
        setExportState('idle');
    };

    const handleDownloadClientVideo = () => {
        if (clientDownloadUrl) {
            const a = document.createElement('a');
            a.href = clientDownloadUrl;
            a.download = `${currentFilename.split('.')[0]}_subtitled.${selectedFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleExportBoth = async () => {
        handleExportSRT();
        await handleExportVideo();
    };

    const isExporting = exportState === 'exporting' || exportState === 'client-exporting';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            {/* Glassmorphism Window */}
            <div className="relative w-full max-w-5xl bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[30px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isExporting}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/5 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/5 disabled:opacity-50"
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
                        {getDisplayedText() && (
                            <div
                                className="absolute w-full flex justify-center pointer-events-none px-4 text-center transition-all duration-75"
                                style={{ top: `${styleConfig.yAlign}%` }}
                            >
                                <DynamicSubtitle
                                    text={getDisplayedText() || ''}
                                    styleConfig={styleConfig}
                                    previewScale={previewScale}
                                    containerRef={videoRef}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Export Options */}
                <div className="w-full md:w-80 bg-white/5 border-l border-white/5 p-8 flex flex-col gap-6 shrink-0 overflow-y-auto">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Export</h2>
                        <p className="text-zinc-400 text-sm">Choose how you want to save your video.</p>
                    </div>

                    {/* Client Export Progress */}
                    {exportState === 'client-exporting' && (
                        <ClientExporter
                            videoUrl={videoUrl}
                            entries={subtitleEntries}
                            styleConfig={styleConfig}
                            videoWidth={videoWidth}
                            videoHeight={videoHeight}
                            outputFilename={currentFilename}
                            format={selectedFormat}
                            onComplete={handleClientExportComplete}
                            onError={handleClientExportError}
                            onCancel={handleClientExportCancel}
                        />
                    )}

                    {/* Normal Export UI */}
                    {exportState !== 'client-exporting' && (
                        <div className="space-y-6">
                            {/* Export Mode Toggle */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-zinc-300">Export Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setExportMode('server')}
                                        className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-all ${exportMode === 'server'
                                                ? 'bg-primary/20 border-primary/50 text-white'
                                                : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-lg mb-1">🖥️</span>
                                        <span className="text-xs font-medium">Server</span>
                                        <span className="text-[9px] text-zinc-500">Recommended</span>
                                    </button>
                                    <button
                                        onClick={() => setExportMode('client')}
                                        className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-all ${exportMode === 'client'
                                                ? 'bg-primary/20 border-primary/50 text-white'
                                                : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-lg mb-1">🌐</span>
                                        <span className="text-xs font-medium">Browser</span>
                                        <span className="text-[9px] text-zinc-500">No upload</span>
                                    </button>
                                </div>
                                {exportMode === 'client' && (
                                    <p className="text-[10px] text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2">
                                        ⚠️ Browser export works offline but may be slower for long videos.
                                    </p>
                                )}
                            </div>

                            {/* Format Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-zinc-300">Video Format</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['mp4', 'mov', 'avi'].map((fmt) => (
                                        <button
                                            key={fmt}
                                            onClick={() => setSelectedFormat(fmt)}
                                            disabled={exportMode === 'client' && fmt === 'avi'}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedFormat === fmt
                                                ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-primary-400'
                                                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                                                } ${exportMode === 'client' && fmt === 'avi' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-white/10" />

                            {/* Subtitle Entry Stats */}
                            <div className="bg-white/5 rounded-xl p-4 space-y-2">
                                <h4 className="text-xs font-medium text-zinc-400">Subtitle Preview</h4>
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Entries</span>
                                    <span className="text-white font-medium">{subtitleEntries.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Mode</span>
                                    <span className="text-white font-medium capitalize">{styleConfig.displayMode}</span>
                                </div>
                            </div>

                            <div className="h-px bg-white/10" />

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleExportSRT}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-200 transition-all group"
                                >
                                    <span className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-[#FFD700]/10 text-[#FFD700]">
                                            <DownloadIcon className="w-4 h-4" />
                                        </div>
                                        <span className="font-medium">Download SRT</span>
                                    </span>
                                    <span className="text-xs text-zinc-500 group-hover:text-zinc-400">.srt</span>
                                </button>

                                {exportState === 'complete' && clientDownloadUrl ? (
                                    <button
                                        onClick={handleDownloadClientVideo}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 transition-all group"
                                    >
                                        <span className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                                                <DownloadIcon className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium">Download Video</span>
                                        </span>
                                        <span className="text-xs text-green-400">Ready!</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleExportVideo}
                                        disabled={isExporting}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-200 transition-all group disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        <span className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                <FilmIcon className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium">{isExporting ? 'Processing...' : 'Export Video'}</span>
                                        </span>
                                        <span className="text-xs text-zinc-500 group-hover:text-zinc-400">.{selectedFormat}</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleExportBoth}
                                    disabled={isExporting}
                                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 shadow-xl shadow-white/5 transition-all active:scale-95 disabled:opacity-70"
                                >
                                    Download Both
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ExportModal;
