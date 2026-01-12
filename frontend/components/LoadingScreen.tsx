import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in duration-500">
      
      {/* Central Glass Card */}
      <div className="relative p-16 rounded-[2.5rem] bg-black/20 backdrop-blur-2xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col items-center gap-10">
        
        {/* Animated AI Core */}
        <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer spinning rings */}
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_4s_linear_infinite]" />
            <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-[spin_3s_linear_infinite_reverse]" />
            <div className="absolute inset-0 rounded-full border-t-2 border-primary/60 animate-[spin_2s_linear_infinite]" />
            
            {/* Inner glowing core */}
            <div className="relative w-16 h-16 bg-gradient-to-br from-primary via-indigo-500 to-purple-600 rounded-full animate-pulse shadow-[0_0_40px_rgba(99,102,241,0.6)] flex items-center justify-center">
                <div className="w-12 h-12 bg-white/10 rounded-full backdrop-blur-sm" />
            </div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold tracking-[0.2em] text-white uppercase">
                Processing
            </h2>
            <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono tracking-widest">
                <span>AI ANALYSIS IN PROGRESS</span>
                <span className="flex gap-1 ml-2">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                </span>
            </div>
        </div>

        {/* Decorative corner accents */}
        <div className="absolute top-8 left-8 w-2 h-2 border-t border-l border-white/30" />
        <div className="absolute top-8 right-8 w-2 h-2 border-t border-r border-white/30" />
        <div className="absolute bottom-8 left-8 w-2 h-2 border-b border-l border-white/30" />
        <div className="absolute bottom-8 right-8 w-2 h-2 border-b border-r border-white/30" />
      </div>

    </div>
  );
};

export default LoadingScreen;