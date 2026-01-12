import React, { useState, useRef, useEffect } from 'react';
import { AppState, Subtitle, StyleConfig, DEFAULT_STYLE } from './types';
import UploadZone from './components/UploadZone';
import LoadingScreen from './components/LoadingScreen';
import StyleEditor from './components/StyleEditor';
import Timeline from './components/Timeline';
import { uploadVideo, generateSubtitles, exportVideo } from './services/api';
import { useHistory } from './hooks/useHistory';
import { PlayIcon, WandIcon, UndoIcon, RedoIcon } from './components/Icons';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Replaced simple state with History hook
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Cursor Reactive Animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        const x = e.clientX;
        const y = e.clientY;
        // Using a radial gradient that moves with the cursor
        cursorRef.current.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(99, 102, 241, 0.08), transparent 40%)`;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea';

      // Undo/Redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && appState === AppState.EDITOR) {
        if (e.code === 'KeyZ') {
          if (e.shiftKey) {
            e.preventDefault();
            redoSubtitles();
          } else {
            e.preventDefault();
            undoSubtitles();
          }
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          redoSubtitles();
        }
      }

      if (e.code === 'Space') {
        // Prevent default only if not typing
        if (isInputActive) return;

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
  // Actually, togglePlay depends on isPlaying state, so we either need to add isPlaying to dependency 
  // or use functional state update in togglePlay if possible (but we call videoRef.current functions).
  // Better: separate useEffect for keydown or just add isPlaying to deps properly.


  // Clean up URL object
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileSelect = (file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setAppState(AppState.PREVIEW);
  };

  const handleGenerate = async () => {
    if (!videoFile) return;
    setAppState(AppState.GENERATING);
    try {
      // 1. Upload Video
      const filename = await uploadVideo(videoFile);
      setCurrentFilename(filename);

      // 2. Generate Subtitles
      // 2. Generate Subtitles
      const generatedSubs = await generateSubtitles(filename);

      initSubtitles(generatedSubs); // Initialize history with generated subs
      setAppState(AppState.EDITOR);
    } catch (error) {
      console.error("Error processing video:", error);
      alert("Failed to process video. See console for details.");
      setAppState(AppState.UPLOAD);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
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
  };

  const deleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  };

  // Helper to find active subtitle
  const activeSubtitle = subtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  );

  const handleExport = async () => {
    if (!currentFilename) return;
    try {
      const downloadUrl = await exportVideo(currentFilename, subtitles);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. See console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary selection:text-white overflow-hidden relative">

      {/* --- SOPHISTICATED BACKGROUND SYSTEM --- */}

      {/* 1. Base Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* 2. Top Spotlight Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#09090b00] to-transparent pointer-events-none blur-3xl" />

      {/* 3. Dynamic Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow [animation-delay:2s]" />

      {/* 4. Reactive Cursor Spotlight (New) */}
      <div ref={cursorRef} className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300" />

      {/* 5. Film Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* --- APP CONTENT --- */}
      <div className="relative z-10 h-full flex flex-col">
        {/* STATE: UPLOAD */}
        {appState === AppState.UPLOAD && (
          <UploadZone onFileSelect={handleFileSelect} />
        )}

        {/* STATE: PREVIEW */}
        {appState === AppState.PREVIEW && videoUrl && (
          <div className="flex flex-col items-center justify-center h-screen space-y-8 bg-transparent relative z-10 animate-in fade-in zoom-in-95 duration-500">

            <div className="relative group w-full max-w-4xl aspect-video rounded-3xl border-2 border-dashed border-white/10 bg-black/40 backdrop-blur-md overflow-hidden p-2 shadow-2xl ring-1 ring-white/5">
              <video src={videoUrl} className="w-full h-full object-contain rounded-2xl" controls />
            </div>

            <div className="flex items-center gap-4 z-10">
              <button
                onClick={() => setAppState(AppState.UPLOAD)}
                className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white font-medium transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                Choose Different Video
              </button>
              <button
                onClick={handleGenerate}
                className="group flex items-center gap-2 px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                <WandIcon className="w-5 h-5 transition-transform group-hover:rotate-12" />
                Generate Subtitles
              </button>
            </div>
          </div>
        )}

        {/* STATE: GENERATING */}
        {appState === AppState.GENERATING && <LoadingScreen />}

        {/* STATE: EDITOR */}
        {appState === AppState.EDITOR && videoUrl && (
          <div className="h-screen flex flex-col relative z-10 animate-in slide-in-from-bottom-4 duration-700">
            {/* Top Navigation / Header */}
            <div className="h-16 border-b border-white/5 bg-black/10 backdrop-blur-md flex items-center justify-between px-8 z-30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <WandIcon className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white/90">CineScript AI</span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1 mr-4 bg-white/5 rounded-lg p-1 border border-white/5">
                  <button
                    onClick={undoSubtitles}
                    disabled={!canUndo}
                    className={`p-2 rounded-md transition-colors ${canUndo ? 'hover:bg-white/10 text-zinc-200' : 'text-zinc-600 cursor-not-allowed'}`}
                    title="Undo (Ctrl+Z)"
                  >
                    <UndoIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redoSubtitles}
                    disabled={!canRedo}
                    className={`p-2 rounded-md transition-colors ${canRedo ? 'hover:bg-white/10 text-zinc-200' : 'text-zinc-600 cursor-not-allowed'}`}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <RedoIcon className="w-4 h-4" />
                  </button>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                  Discard
                </button>
                <button
                  onClick={handleExport}
                  className="px-5 py-2 text-sm font-bold bg-white text-black rounded-lg hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]">
                  Export Video
                </button>
              </div>
            </div>

            {/* Main Content: Spaced Grid Layout */}
            <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-6 p-6 overflow-hidden">

              {/* Video Player: Columns 1-9 (Left) */}
              <div className="col-span-9 row-span-4 relative flex flex-col min-h-0">
                <div className="relative w-full h-full border-2 border-dashed border-zinc-700/30 rounded-3xl bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden shadow-2xl transition-all hover:border-zinc-600/50 hover:bg-black/30 group">

                  <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/5">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="max-h-full max-w-full shadow-2xl"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onClick={togglePlay}
                      onEnded={() => setIsPlaying(false)}
                    />

                    {/* Custom Controls Overlay */}
                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity group-hover:bg-black/10">
                        <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                          <PlayIcon className="w-10 h-10 text-white fill-current ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Subtitle Overlay */}
                    {activeSubtitle && (
                      <div
                        className="absolute w-full flex justify-center pointer-events-none px-8 text-center"
                        style={{ top: `${styleConfig.yAlign}%` }}
                      >
                        <span
                          style={{
                            fontFamily: styleConfig.fontFamily,
                            fontSize: `${styleConfig.fontSize}px`,
                            color: styleConfig.color,
                            backgroundColor: `rgba(${parseInt(styleConfig.backgroundColor.slice(1, 3), 16)}, ${parseInt(styleConfig.backgroundColor.slice(3, 5), 16)}, ${parseInt(styleConfig.backgroundColor.slice(5, 7), 16)}, ${styleConfig.backgroundOpacity})`,
                            fontWeight: styleConfig.fontWeight,
                            padding: '4px 12px',
                            borderRadius: '4px',
                            maxWidth: '80%',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                          }}
                        >
                          {activeSubtitle.text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Style Editor: Columns 10-12 (Right) */}
              <div className="col-span-3 row-span-4 min-h-0">
                <StyleEditor config={styleConfig} onChange={setStyleConfig} />
              </div>

              {/* Timeline: Columns 1-12 (Bottom) */}
              <div className="col-span-12 row-span-2 min-h-0">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;