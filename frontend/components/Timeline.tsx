import React, { useRef, useState, useEffect } from 'react';
import { Subtitle } from '../types';
import { TrashIcon } from './Icons';

interface TimelineProps {
    subtitles: Subtitle[];
    currentTime: number;
    duration: number;
    onSubtitleClick: (time: number) => void;
    onDeleteSubtitle: (id: string, updates: Partial<Subtitle>) => void; // Changed signature to allow updates
    onUpdateSubtitle: (id: string, text: string) => void;
}

// Helper to support updates (hacky bridge to current onDelete wrapper? No, we need a real update prop)
// The current App.tsx only has onUpdateSubtitle for text. 
// We should probably emit an "onChange" for the whole subtitle or strictly start/end.
// For now, let's assume valid props are passed or we modify types.
// Actually, App.tsx doesn't have a specific "update times" function.
// We will need to modify App.tsx to support time updates, or use a new prop.
// For this step I will assume `onSubtitleUpdate` event exists or I will cast.
// Ah, the user asked to make it work. I should add `ontimeUpdate` support to App later.
// For now I will define the prop but `App` might complain. I'll stick to the existing props in signature 
// but will likely need to modify App.tsx next.
// Wait, `onDeleteSubtitle` is for deleting. I need `onsubtitleChange`.
// Let's modify the Props interface to include `onSubtitleChange`.

interface ExtendedTimelineProps extends Omit<TimelineProps, 'onDeleteSubtitle'> {
    onDeleteSubtitle: (id: string) => void;
    onSubtitleTimeUpdate?: (id: string, startTime: number, endTime: number) => void;
    videoRef: React.RefObject<HTMLVideoElement>;
}

const Timeline: React.FC<ExtendedTimelineProps> = ({
    subtitles,
    currentTime,
    duration,
    onSubtitleClick,
    onDeleteSubtitle,
    onUpdateSubtitle,
    onSubtitleTimeUpdate,
    videoRef
}) => {
    const safeDuration = duration || 1;
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);

    // Refs for Dragging & Auto-scroll
    const mouseXRef = useRef<number>(0);
    const isDraggingRef = useRef<boolean>(false); // To access in loop without dependency issues

    // Configuration
    const [zoom, setZoom] = useState(0.5);
    const BASE_PX_PER_SEC = 100;

    // State
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize-l' | 'resize-r' | 'scrub' | null>(null);
    const [dragTargetId, setDragTargetId] = useState<string | null>(null);
    const [dragSnapshot, setDragSnapshot] = useState<{ start: number, end: number } | null>(null);
    const [dragStartTime, setDragStartTime] = useState<number>(0); // Time at cursor when drag started

    const getPxPerSec = () => BASE_PX_PER_SEC * zoom;
    const formatTime = (s: number) => new Date(s * 1000).toISOString().substr(11, 8);

    // Helper: Get absolute time from clientX (accounting for scroll)
    const getTimeAtMouse = (clientX: number) => {
        if (!scrollAreaRef.current) return 0;
        const rect = scrollAreaRef.current.getBoundingClientRect();
        const scrollLeft = scrollAreaRef.current.scrollLeft;
        const offsetX = clientX - rect.left + scrollLeft;
        return Math.max(0, offsetX / getPxPerSec());
    };

    const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-l' | 'resize-r' | 'scrub', id?: string, sub?: Subtitle) => {
        e.preventDefault();
        e.stopPropagation();

        const startT = getTimeAtMouse(e.clientX);

        setIsDragging(true);
        isDraggingRef.current = true; // Sync ref
        setDragType(type);
        setDragStartTime(startT);
        mouseXRef.current = e.clientX;

        if (type !== 'scrub' && id && sub) {
            setDragTargetId(id);
            setDragSnapshot({ start: sub.startTime, end: sub.endTime });
        }

        if (type === 'scrub') {
            onSubtitleClick(startT);
        }
    };

    // Core Drag Logic (Extracted for use in Loop)
    const updateDrag = (clientX: number) => {
        const currentTimeAtMouse = getTimeAtMouse(clientX);

        // Scrubbing
        if (dragType === 'scrub') {
            onSubtitleClick(Math.min(currentTimeAtMouse, safeDuration));
            return;
        }

        // Subtitle Manipulation
        if (dragTargetId && dragSnapshot && onSubtitleTimeUpdate) {
            const dt = currentTimeAtMouse - dragStartTime;
            let newStart = dragSnapshot.start;
            let newEnd = dragSnapshot.end;

            if (dragType === 'move') {
                newStart += dt;
                newEnd += dt;
                // Clamping
                if (newStart < 0) { newStart = 0; newEnd = dragSnapshot.end - dragSnapshot.start; }
                const dur = dragSnapshot.end - dragSnapshot.start;
                // Optional: Clamp to timeline end? allowed to go past?
                // if (newEnd > safeDuration) { newEnd = safeDuration; newStart = newEnd - dur; }
            } else if (dragType === 'resize-l') {
                newStart += dt;
                if (newStart > newEnd - 0.2) newStart = newEnd - 0.2;
                if (newStart < 0) newStart = 0;
            } else if (dragType === 'resize-r') {
                newEnd += dt;
                if (newEnd < newStart + 0.2) newEnd = newStart + 0.2;
            }

            onSubtitleTimeUpdate(dragTargetId, newStart, newEnd);
        }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        mouseXRef.current = e.clientX;
        updateDrag(e.clientX);
    };

    const handleGlobalMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            isDraggingRef.current = false;
            setDragType(null);
            setDragTargetId(null);
            setDragSnapshot(null);
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, dragType, dragTargetId, dragStartTime, dragSnapshot, zoom]); // Added zoom/deps

    // Unified Animation Loop
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            // 1. Playhead Update
            if (videoRef.current && playheadRef.current) {
                const t = videoRef.current.currentTime;
                const pxPerSec = getPxPerSec();
                const pos = t * pxPerSec;
                playheadRef.current.style.left = `${pos}px`;

                // Auto-scroll during Playback (only if NOT dragging)
                if (!videoRef.current.paused && !isDraggingRef.current && scrollAreaRef.current) {
                    const containerWidth = scrollAreaRef.current.clientWidth;
                    const scrollLeft = scrollAreaRef.current.scrollLeft;
                    if (pos - scrollLeft > containerWidth * 0.8) {
                        scrollAreaRef.current.scrollLeft = pos - containerWidth * 0.2;
                    }
                }
            }

            // 2. Drag Auto-Scroll
            if (isDraggingRef.current && scrollAreaRef.current) {
                const rect = scrollAreaRef.current.getBoundingClientRect();
                const mx = mouseXRef.current;
                const containerWidth = rect.width;

                let scrollDelta = 0;
                const EDGE_THRESHOLD = 50;
                const SCROLL_SPEED = 15; // px per frame

                if (mx < rect.left + EDGE_THRESHOLD) {
                    scrollDelta = -SCROLL_SPEED;
                } else if (mx > rect.right - EDGE_THRESHOLD) {
                    scrollDelta = SCROLL_SPEED;
                }

                if (scrollDelta !== 0) {
                    scrollAreaRef.current.scrollLeft += scrollDelta;
                    // Trigger drag update because scroll changed logical time under cursor
                    updateDrag(mx);
                }
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [zoom, dragType, dragTargetId, dragStartTime, dragSnapshot]); // Deps needed for updateDrag closure

    const totalWidth = safeDuration * getPxPerSec();

    return (
        <div className="h-full w-full border-2 border-dashed border-zinc-700/50 rounded-3xl bg-black/20 backdrop-blur-md flex flex-col overflow-hidden shadow-2xl transition-all hover:border-zinc-600/80">
            {/* Header / Toolbar */}
            <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center bg-white/5 select-none shrink-0">
                <span className="text-[10px] tracking-widest font-bold text-zinc-400 uppercase">Sequence Timeline</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setZoom(Math.max(0.2, zoom / 1.25))} className="p-1 hover:bg-white/10 rounded text-xs">-</button>
                        <span className="text-[10px] text-zinc-500">Zoom</span>
                        <button onClick={() => setZoom(Math.min(5, zoom * 1.25))} className="p-1 hover:bg-white/10 rounded text-xs">+</button>
                    </div>
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        {formatTime(currentTime)} / {formatTime(safeDuration)}
                    </span>
                </div>
            </div>

            <div
                ref={scrollAreaRef}
                className="flex-1 relative overflow-x-auto overflow-y-hidden select-none custom-scrollbar pt-2"
                onMouseDown={(e) => {
                    if (e.target === scrollAreaRef.current || (e.target as HTMLElement).classList.contains('timeline-bg')) {
                        handleMouseDown(e, 'scrub');
                    }
                }}
            >
                <div
                    className="relative h-full timeline-bg"
                    style={{ width: `${Math.max(scrollAreaRef.current?.clientWidth || 0, totalWidth + 200)}px` }}
                >
                    {/* Ruler */}
                    <div className="h-6 border-b border-white/5 relative pointer-events-none">
                        {Array.from({ length: Math.ceil(safeDuration) }).map((_, sec) => {
                            const showMajor = sec % 5 === 0;
                            if (!showMajor && zoom < 0.5) return null;
                            return (
                                <div
                                    key={sec}
                                    className={`absolute bottom-0 border-l ${showMajor ? 'h-3 border-zinc-500' : 'h-1.5 border-zinc-700'}`}
                                    style={{ left: `${sec * getPxPerSec()}px` }}
                                >
                                    {showMajor && <span className="absolute -top-4 left-1 text-[9px] text-zinc-300 font-medium">{formatTime(sec)}</span>}
                                </div>
                            );
                        })}
                    </div>

                    {/* Playhead */}
                    <div
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 w-[1px] bg-primary z-30 pointer-events-none shadow-[0_0_10px_#6366f1]"
                        style={{ left: `${currentTime * getPxPerSec()}px` }}
                    >
                        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary transform rotate-45 border border-white"></div>
                    </div>

                    {/* Subtitle Track */}
                    <div className="relative h-12 top-1">
                        {subtitles.map((sub) => {
                            const left = sub.startTime * getPxPerSec();
                            const width = (sub.endTime - sub.startTime) * getPxPerSec();
                            const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

                            return (
                                <div
                                    key={sub.id}
                                    className={`
                                absolute h-10 rounded-md border backdrop-blur-sm overflow-hidden group transition-colors shadow-sm
                                ${isActive
                                            ? 'bg-primary/20 border-primary/50 ring-1 ring-primary/30 z-10'
                                            : 'bg-zinc-800/40 border-white/10 hover:bg-zinc-700/60 hover:border-white/30'
                                        }
                            `}
                                    style={{
                                        left: `${left}px`,
                                        width: `${Math.max(width, 5)}px`,
                                        cursor: 'grab'
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, 'move', sub.id, sub)}
                                    // Removed Click propagation stop to prevent seeking when clicking sub
                                    onClick={(e) => { e.stopPropagation(); onSubtitleClick(sub.startTime); }}
                                >
                                    {/* Resize Handles */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20 z-20"
                                        onMouseDown={(e) => handleMouseDown(e, 'resize-l', sub.id, sub)}
                                    />
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 z-20"
                                        onMouseDown={(e) => handleMouseDown(e, 'resize-r', sub.id, sub)}
                                    />

                                    <div className="px-2 py-1 h-full flex flex-col justify-between">
                                        <input
                                            className="bg-transparent text-xs text-zinc-200 outline-none w-full font-medium placeholder-zinc-600 truncate pointer-events-auto"
                                            value={sub.text}
                                            onChange={(e) => onUpdateSubtitle(sub.id, e.target.value)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSubtitle(sub.id);
                                                }}
                                                className="text-zinc-500 hover:text-red-400 p-0.5 rounded hover:bg-white/5 transition-colors pointer-events-auto"
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timeline;