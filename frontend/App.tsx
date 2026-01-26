import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { AppState, Subtitle, StyleConfig, DEFAULT_STYLE } from './types';
import UploadZone from './components/UploadZone';
import LoadingScreen from './components/LoadingScreen';
import StyleEditor from './components/StyleEditor';
import SubtitleList from './components/SubtitleList'; // New Component
import Timeline from './components/Timeline';
import ExportModal from './components/ExportModal';
import DiscardModal from './components/DiscardModal';

import { uploadVideo, generateSubtitles, exportVideo } from './services/api';
import { useHistory } from './hooks/useHistory';
import { PlayIcon, WandIcon, UndoIcon, RedoIcon } from './components/Icons';

// --- Dynamic Subtitle Component ---
interface DynamicSubtitleProps {
  text: string;
  styleConfig: StyleConfig;
  previewScale: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

const DynamicSubtitle: React.FC<DynamicSubtitleProps> = ({ text, styleConfig, previewScale, containerRef }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const baseFontSize = Math.max(12, styleConfig.fontSize * previewScale);
  const [fontSize, setFontSize] = useState(baseFontSize);

  // Reset font size when content or base configuration changes
  useLayoutEffect(() => {
    setFontSize(baseFontSize);
  }, [text, baseFontSize, styleConfig.fontFamily, styleConfig.fontWeight]);

  // Adjust size if overflowing
  useLayoutEffect(() => {
    if (!spanRef.current || !containerRef.current) return;

    const element = spanRef.current;
    const container = containerRef.current;

    const checkFit = () => {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Safety margin (px)
      const margin = 20 * previewScale;

      const isOverflowingBottom = rect.bottom > (containerRect.bottom - margin);
      const isOverflowingTop = rect.top < (containerRect.top + margin);
      // We also check if it's strictly wider than the container (minus padding)
      const isTooWide = rect.width > (containerRect.width - (margin * 2));

      if ((isOverflowingBottom || isOverflowingTop || isTooWide) && fontSize > 8) {
        // Decrease font size by 10%
        setFontSize(prev => Math.max(8, prev * 0.9));
      }
    };

    // We can't synchronously loop re-renders, but the effect dependency on 'fontSize'
    // creates a loop until it stabilizes.
    // To speed it up and avoid flash, we could do invisible pre-measuring, 
    // but React effects are fast enough for this UI.
    checkFit();
  }, [fontSize, text, previewScale, containerRef]);

  return (
    <span
      ref={spanRef}
      style={{
        fontFamily: styleConfig.fontFamily,
        fontSize: `${fontSize}px`,
        color: styleConfig.color,
        backgroundColor: `rgba(${parseInt(styleConfig.backgroundColor.slice(1, 3), 16)}, ${parseInt(styleConfig.backgroundColor.slice(3, 5), 16)}, ${parseInt(styleConfig.backgroundColor.slice(5, 7), 16)}, ${styleConfig.backgroundOpacity})`,
        fontWeight: styleConfig.fontWeight,
        padding: '0.25em 0.5em',
        borderRadius: '0.4em',
        maxWidth: '94%', // increased slightly to give room for "almost fits" cases
        lineHeight: '1.4',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        display: 'inline-block', // inline-block respects transform/box model better
        whiteSpace: 'pre-wrap',  // Ensure wrapping happens
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        textAlign: 'center'
      }}
    >
      {text}
    </span>
  );
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const {
    state: subtitles,
    set: setSubtitles,
    undo: undoSubtitles,
    redo: redoSubtitles,
    canUndo,
    canRedo,
    init: initSubtitles
  } = useHistory<Subtitle[]>([]);

  const [styleConfig, setStyleConfig] = useState<StyleConfig>(DEFAULT_STYLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [previewScale, setPreviewScale] = useState(1);


  const [showExportModal, setShowExportModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        const x = e.clientX;
        const y = e.clientY;
        cursorRef.current.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(99, 102, 241, 0.08), transparent 40%)`;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea';

      if ((e.ctrlKey || e.metaKey) && appState === AppState.EDITOR) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          e.shiftKey ? redoSubtitles() : undoSubtitles();
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          redoSubtitles();
        }
      }

      if (e.code === 'Space' && !isInputActive) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, appState, undoSubtitles, redoSubtitles]);

  // --- High Precision Timer ---
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
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // --- Scale Calculation ---
  useEffect(() => {
    const updateScale = () => {
      if (videoRef.current && videoSize.width > 0) {
        const clientWidth = videoRef.current.clientWidth;
        setPreviewScale(clientWidth / videoSize.width);
      }
    };

    window.addEventListener('resize', updateScale);
    // Initial update
    const interval = setInterval(updateScale, 500); // Check periodically for layout changes

    return () => {
      window.removeEventListener('resize', updateScale);
      clearInterval(interval);
    };
  }, [videoSize.width]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // --- Handlers ---
  const handleFileSelect = (file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setAppState(AppState.PREVIEW);
  };

  const handleGenerate = async () => {
    if (!videoFile) return;
    setAppState(AppState.GENERATING);
    try {
      const filename = await uploadVideo(videoFile);
      setCurrentFilename(filename);
      const generatedSubs = await generateSubtitles(filename);
      initSubtitles(generatedSubs);
      setAppState(AppState.EDITOR);
    } catch (error) {
      console.error("Error processing video:", error);
      alert("Failed to process video. See console for details.");
      setAppState(AppState.UPLOAD);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    isPlaying ? videoRef.current.pause() : videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      const { videoWidth, videoHeight } = videoRef.current;
      setVideoSize({
        width: videoWidth,
        height: videoHeight
      });

      // Smart Auto-Sizing: Set font size to roughly 4.5% of the video height
      // This ensures readability on both 1080p landscapes and 4K verticals
      const optimalFontSize = Math.max(24, Math.round(videoHeight * 0.045));
      setStyleConfig(prev => ({
        ...prev,
        fontSize: optimalFontSize
      }));
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const updateSubtitleText = (id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const updateSubtitleTime = (id: string, startTime: number, endTime: number) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, startTime, endTime } : s));
  }

  const deleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  };

  const handleDiscardClick = () => {
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    setShowDiscardModal(true);
  };

  const handleConfirmDiscard = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setSubtitles([]);
    setCurrentFilename(null);
    setAppState(AppState.UPLOAD);
    setShowDiscardModal(false);
  };

  const handleExportClick = () => {
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    setShowExportModal(true);
  };

  // --- render logic ---
  const activeSubtitle = subtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  );

  const getDisplayedText = () => {
    if (!activeSubtitle) return null;

    if (styleConfig.displayMode === 'sentence') {
      return activeSubtitle.text;
    }

    if (!activeSubtitle.words || activeSubtitle.words.length === 0) {
      return activeSubtitle.text; // Fallback
    }

    // 1. Try to find the word currently being spoken
    let currentWordIndex = activeSubtitle.words.findIndex(
      w => currentTime >= w.startTime && currentTime <= w.endTime
    );

    // 2. If inside a gap (no word is "active"), find the LAST word that passed
    //    This creates the "sticky" effect so it doesn't flash the whole sentence
    if (currentWordIndex === -1) {
      // Find the last word that has started
      for (let i = activeSubtitle.words.length - 1; i >= 0; i--) {
        if (currentTime >= activeSubtitle.words[i].startTime) {
          currentWordIndex = i;
          break;
        }
      }
      // If still -1 (before first word), default to 0
      if (currentWordIndex === -1) currentWordIndex = 0;
    }

    if (styleConfig.displayMode === 'word') {
      return activeSubtitle.words[currentWordIndex].text;
    }

    if (styleConfig.displayMode === 'phrase') {
      const wordsPerLine = styleConfig.wordsPerLine || 3;
      const allWords = activeSubtitle.words;

      // Smart Chunking Algorithm
      // 1. Identify natural break points (punctuation)
      // 2. Group words while respecting max length (wordsPerLine)

      let currentChunk: typeof allWords = [];
      let foundChunk = false;
      let wordCount = 0;

      for (let i = 0; i < allWords.length; i++) {
        const word = allWords[i];
        currentChunk.push(word);
        wordCount++;

        // Define break condition:
        // - Reached max length
        // - OR Hit punctuation (.,?!), unless it's the very start of a chunk (rare)
        const hasPunctuation = /[.?!,]/.test(word.text);
        const shouldBreak = wordCount >= wordsPerLine || (hasPunctuation && wordCount > 1);

        if (shouldBreak || i === allWords.length - 1) {
          // Check if our target index is in THIS chunk
          // We need to know if the "active word" (currentWordIndex) is inside the range of this chunk
          // The range of this chunk is from (i - wordCount + 1) to i
          const startIndex = i - wordCount + 1;
          const endIndex = i;

          if (currentWordIndex >= startIndex && currentWordIndex <= endIndex) {
            return currentChunk.map(w => w.text).join(' ');
          }

          // Prepare for next chunk
          currentChunk = [];
          wordCount = 0;
        }
      }

      // Fallback (safety)
      return activeSubtitle.text;
    }

    return activeSubtitle.text;
  };

  return (
    <div className="h-screen bg-[#050505] text-white font-sans selection:bg-primary selection:text-white overflow-hidden relative flex flex-col">

      {/* --- BACKGROUND --- */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#09090b00] to-transparent pointer-events-none blur-3xl" />
      <div ref={cursorRef} className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* --- APP CONTENT --- */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">

        {/* HEADER */}
        {(appState === AppState.EDITOR || appState === AppState.PREVIEW) && (
          <div className="h-16 border-b border-white/5 bg-black/10 backdrop-blur-md flex items-center justify-between px-6 z-30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <WandIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white/90">Cinescript AI</span>
            </div>

            {appState === AppState.EDITOR && (
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1 mr-4 bg-white/5 rounded-lg p-1 border border-white/5">
                  <button onClick={undoSubtitles} disabled={!canUndo} className={`p-2 rounded-md transition-colors ${canUndo ? 'hover:bg-white/10 text-zinc-200' : 'text-zinc-600 cursor-not-allowed'}`}>
                    <UndoIcon className="w-4 h-4" />
                  </button>
                  <button onClick={redoSubtitles} disabled={!canRedo} className={`p-2 rounded-md transition-colors ${canRedo ? 'hover:bg-white/10 text-zinc-200' : 'text-zinc-600 cursor-not-allowed'}`}>
                    <RedoIcon className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={handleDiscardClick} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Discard</button>
                <button onClick={handleExportClick} className="px-5 py-2 text-sm font-bold bg-white text-black rounded-lg hover:bg-zinc-200 shadow-lg">Export Video</button>
              </div>
            )}
          </div>
        )}

        {showExportModal && videoUrl && currentFilename && (
          <ExportModal
            videoUrl={videoUrl}
            subtitles={subtitles}
            styleConfig={styleConfig}
            currentFilename={currentFilename}
            onClose={() => setShowExportModal(false)}
          />
        )}

        {showDiscardModal && (
          <DiscardModal
            onConfirm={handleConfirmDiscard}
            onCancel={() => setShowDiscardModal(false)}
          />
        )}


        {/* EDITOR LAYOUT */}
        {appState === AppState.EDITOR && videoUrl ? (
          <>
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT PANEL: SUBTITLE LIST */}
              <div className="w-80 border-r border-white/5 bg-black/20 backdrop-blur-sm p-4 flex flex-col min-w-[320px]">
                <SubtitleList
                  subtitles={subtitles}
                  currentTime={currentTime}
                  onSubtitleClick={seekTo}
                  onUpdateSubtitle={updateSubtitleText}
                />
              </div>

              {/* CENTER PANEL: VIDEO PLAYER */}
              <div className="flex-1 relative bg-black/40 flex flex-col p-6 min-w-0">
                <div className="flex-1 relative flex items-center justify-center rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-[#0a0a0a]">

                  {/* Ambient Background Blur */}
                  <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none">
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover blur-[80px] scale-110"
                      ref={(el) => {
                        // Sync background video with main video if possible, strictly visual
                        if (el && videoRef.current) {
                          el.currentTime = videoRef.current.currentTime;
                        }
                      }}
                      muted
                    />
                  </div>

                  {/* Main Video Container */}
                  <div className="relative z-10 max-h-full max-w-full aspect-[var(--aspect-ratio)] shadow-2xl"
                    style={{ '--aspect-ratio': videoSize.width && videoSize.height ? `${videoSize.width}/${videoSize.height}` : '16/9' } as any}>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="max-h-full max-w-full block"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onClick={togglePlay}
                      onEnded={() => setIsPlaying(false)}
                      style={{ maxHeight: 'calc(100vh - 160px)' }} // Prevent overflow
                    />

                    {/* Controls Overlay */}
                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer" onClick={togglePlay}>
                        <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center animate-pulse shadow-2xl">
                          <PlayIcon className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Subtitle Overlay */}
                    {activeSubtitle && (
                      <div
                        className="absolute w-full flex justify-center pointer-events-none px-8 text-center transition-all duration-200"
                        style={{ top: `${styleConfig.yAlign}%` }}
                      >
                        <DynamicSubtitle
                          text={getDisplayedText() || ''}
                          styleConfig={styleConfig}
                          previewScale={previewScale}
                          containerRef={videoRef as any}
                        />
                      </div>
                    )}

                    {/* Simple Progress Bar on Video */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer group" onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = (e.clientX - rect.left) / rect.width;
                      if (duration > 0) seekTo(percent * duration);
                    }}>
                      <div className="h-full bg-primary relative" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md" />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: STYLE EDITOR */}
              <div className="w-80 border-l border-white/5 bg-black/20 backdrop-blur-sm p-4 min-w-[320px]">
                <StyleEditor config={styleConfig} onChange={setStyleConfig} />

              </div>

            </div>

            {/* TIMELINE - Bottom Panel */}
            <div className="h-40 border-t border-white/5 bg-black/40 backdrop-blur-md p-4 z-20 shrink-0">
              <Timeline
                subtitles={subtitles}
                currentTime={currentTime}
                duration={duration}
                onSubtitleClick={seekTo}
                onDeleteSubtitle={deleteSubtitle}
                onUpdateSubtitle={updateSubtitleText}
                onSubtitleTimeUpdate={updateSubtitleTime}
                videoRef={videoRef}
              />
            </div>

          </>
        ) : (
          // NON-EDITOR STATE (UPLOAD / PREVIEW / GENERATING)
          <div className="flex-1 flex flex-col">
            {appState === AppState.UPLOAD && <UploadZone onFileSelect={handleFileSelect} />}

            {appState === AppState.GENERATING && <LoadingScreen />}

            {appState === AppState.PREVIEW && videoUrl && (
              <div className="flex flex-col items-center justify-center flex-1 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative group w-full max-w-4xl aspect-video rounded-3xl border-2 border-dashed border-white/10 bg-black/40 backdrop-blur-md overflow-hidden p-2 shadow-2xl">
                  <video src={videoUrl} className="w-full h-full object-contain rounded-2xl" controls />
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setAppState(AppState.UPLOAD)} className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-white/10">Choose Different Video</button>
                  <button onClick={handleGenerate} className="group flex items-center gap-2 px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                    <WandIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Generate
                  </button>
                </div>
              </div>
            )}
          </div>
        )
        }
      </div >
    </div >
  );
};

export default App;