import React, { useEffect, useRef } from 'react';
import { Subtitle } from '../types';

interface SubtitleListProps {
    subtitles: Subtitle[];
    currentTime: number;
    onSubtitleClick: (startTime: number) => void;
    onUpdateSubtitle: (id: string, text: string) => void;
}

const SubtitleList: React.FC<SubtitleListProps> = ({
    subtitles,
    currentTime,
    onSubtitleClick,
    onUpdateSubtitle
}) => {
    const activeRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [isHovering, setIsHovering] = React.useState(false);

    useEffect(() => {
        // Scroll active subtitle into view ONLY if not hovering
        if (isHovering) return;

        const activeSub = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
        if (activeSub && activeRefs.current[activeSub.id]) {
            activeRefs.current[activeSub.id]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentTime, subtitles, isHovering]);

    return (
        <div className="h-full flex flex-col bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-bold text-white">Transcript</h2>
                <p className="text-xs text-zinc-400">Click to seek • Edit text freely</p>
            </div>

            <div
                className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                {subtitles.map((sub) => {
                    const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

                    return (
                        <div
                            key={sub.id}
                            ref={el => activeRefs.current[sub.id] = el}
                            className={`p-3 rounded-xl transition-all duration-300 border ${isActive
                                ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-[1.02]'
                                : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'
                                }`}
                        >
                            <div
                                className="flex justify-between items-center mb-2 cursor-pointer"
                                onClick={() => onSubtitleClick(sub.startTime)}
                            >
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 ${isActive ? 'bg-primary text-white font-bold tracking-wide' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                    {new Date(sub.startTime * 1000).toISOString().substr(14, 5)} - {new Date(sub.endTime * 1000).toISOString().substr(14, 5)}
                                </span>
                                {isActive && (
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>

                            <textarea
                                value={sub.text}
                                onChange={(e) => onUpdateSubtitle(sub.id, e.target.value)}
                                className={`w-full bg-transparent resize-none outline-none text-sm leading-relaxed transition-all p-2 rounded-lg border border-transparent hover:border-white/10 focus:border-primary/50 focus:bg-white/5 ${isActive ? 'text-white font-medium' : 'text-zinc-400 focus:text-zinc-200'
                                    }`}
                                rows={Math.max(2, Math.ceil(sub.text.length / 30))}
                                spellCheck={false}
                                placeholder="Edit subtitle text..."
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SubtitleList;
