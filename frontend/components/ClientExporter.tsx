import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { SubtitleEntry, generateASSContent } from '../utils/subtitleUtils';
import { StyleConfig } from '../types';

interface ClientExporterProps {
    videoUrl: string;
    entries: SubtitleEntry[];
    styleConfig: StyleConfig;
    videoWidth: number;
    videoHeight: number;
    outputFilename: string;
    format: string;
    onComplete: (blobUrl: string) => void;
    onError: (error: string) => void;
    onCancel: () => void;
}

type ExportStage = 'loading' | 'processing' | 'complete' | 'error';

const ClientExporter: React.FC<ClientExporterProps> = ({
    videoUrl,
    entries,
    styleConfig,
    videoWidth,
    videoHeight,
    outputFilename,
    format,
    onComplete,
    onError,
    onCancel
}) => {
    const [stage, setStage] = useState<ExportStage>('loading');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Initializing FFmpeg...');
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const abortRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        let loadTimeout: NodeJS.Timeout | null = null;

        const runExport = async () => {
            try {
                // Check for SharedArrayBuffer support (required for FFmpeg.wasm)
                if (typeof SharedArrayBuffer === 'undefined') {
                    throw new Error('Browser export requires SharedArrayBuffer support. Please reload the page or use server-side export.');
                }

                // Initialize FFmpeg
                setStatusMessage('Loading FFmpeg WebAssembly...');
                const ffmpeg = new FFmpeg();
                ffmpegRef.current = ffmpeg;

                ffmpeg.on('progress', ({ progress: p }) => {
                    if (mounted && !abortRef.current) {
                        setProgress(Math.round(p * 100));
                    }
                });

                ffmpeg.on('log', ({ message }) => {
                    console.log('[FFmpeg]', message);
                });

                // Set a timeout for loading (30 seconds max)
                const loadPromise = (async () => {
                    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    });
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    loadTimeout = setTimeout(() => {
                        reject(new Error('FFmpeg loading timed out. Try using server-side export instead.'));
                    }, 30000);
                });

                try {
                    await Promise.race([loadPromise, timeoutPromise]);
                    if (loadTimeout) clearTimeout(loadTimeout);
                } catch (loadError) {
                    if (loadTimeout) clearTimeout(loadTimeout);
                    throw loadError;
                }

                if (abortRef.current || !mounted) return;

                setStage('processing');
                setStatusMessage('Preparing video...');

                // Write input video to FFmpeg virtual filesystem
                const videoData = await fetchFile(videoUrl);
                await ffmpeg.writeFile('input.mp4', videoData);

                if (abortRef.current || !mounted) return;

                // Generate ASS subtitle content
                setStatusMessage('Generating subtitles...');
                const assContent = generateASSContent(entries, styleConfig, videoWidth, videoHeight);
                const assBlob = new TextEncoder().encode(assContent);
                await ffmpeg.writeFile('subtitles.ass', assBlob);

                if (abortRef.current || !mounted) return;

                // Burn subtitles
                setStatusMessage('Burning subtitles into video...');

                const outputExt = format === 'mov' ? 'mov' : 'mp4';
                const outputFile = `output.${outputExt}`;

                // FFmpeg command to burn ASS subtitles
                await ffmpeg.exec([
                    '-i', 'input.mp4',
                    '-vf', 'ass=subtitles.ass',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast', // Fast preset for browser
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', '+faststart',
                    '-y',
                    outputFile
                ]);

                if (abortRef.current || !mounted) return;

                // Read output file
                setStatusMessage('Finalizing...');
                const data = await ffmpeg.readFile(outputFile);
                // Handle FFmpeg FileData type - create blob from the data
                const blob = new Blob(
                    [typeof data === 'string' ? new TextEncoder().encode(data) : data as unknown as ArrayBuffer],
                    { type: `video/${outputExt}` }
                );
                const blobUrl = URL.createObjectURL(blob);

                // Cleanup
                await ffmpeg.deleteFile('input.mp4');
                await ffmpeg.deleteFile('subtitles.ass');
                await ffmpeg.deleteFile(outputFile);

                if (mounted && !abortRef.current) {
                    setStage('complete');
                    setStatusMessage('Export complete!');
                    onComplete(blobUrl);
                }

            } catch (error) {
                console.error('Client export error:', error);
                if (mounted && !abortRef.current) {
                    setStage('error');
                    setStatusMessage('Export failed');
                    onError(error instanceof Error ? error.message : 'Unknown error occurred');
                }
            }
        };

        runExport();

        return () => {
            mounted = false;
            abortRef.current = true;
        };
    }, []);

    const handleCancel = () => {
        abortRef.current = true;
        onCancel();
    };

    return (
        <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-300">{statusMessage}</span>
                    <span className="text-primary font-mono">{progress}%</span>
                </div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-primary-400 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Stage Indicator */}
            <div className="flex justify-center gap-2">
                {['loading', 'processing', 'complete'].map((s, i) => (
                    <div
                        key={s}
                        className={`w-2 h-2 rounded-full transition-all ${stage === s
                            ? 'bg-primary scale-125'
                            : (stage === 'complete' || (['loading', 'processing'].indexOf(stage) > i - 1 && stage !== 'error'))
                                ? 'bg-primary/50'
                                : 'bg-zinc-600'
                            }`}
                    />
                ))}
            </div>

            {/* Cancel Button */}
            {stage !== 'complete' && stage !== 'error' && (
                <button
                    onClick={handleCancel}
                    className="w-full py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    Cancel
                </button>
            )}

            {/* Error Message */}
            {stage === 'error' && (
                <div className="text-center text-red-400 text-sm">
                    <p>Export failed. Try using server-side export instead.</p>
                </div>
            )}
        </div>
    );
};

export default ClientExporter;
