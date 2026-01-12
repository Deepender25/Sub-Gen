import React, { useRef, useState } from 'react';
import { UploadIcon } from './Icons';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onFileSelect(file);
      } else {
        alert("Please upload a video file.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 relative overflow-hidden animate-in fade-in duration-700">
      
      <div className="z-10 text-center mb-10">
        <h1 className="text-6xl font-extrabold tracking-tight mb-4 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          CineScript AI
        </h1>
        <p className="text-zinc-400 text-lg font-light tracking-wide">
          Next-generation subtitle automation powered by Gemini
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          group relative w-full max-w-2xl aspect-video rounded-3xl border-2 border-dashed 
          flex flex-col items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-sm
          ${isDragging 
            ? 'border-primary bg-primary/10 scale-[1.02] shadow-[0_0_50px_rgba(99,102,241,0.3)]' 
            : 'border-zinc-700/50 bg-black/20 hover:border-zinc-500 hover:bg-black/30 hover:shadow-2xl'
          }
        `}
      >
        <div className={`p-6 rounded-3xl bg-zinc-800/50 mb-6 transition-all duration-300 group-hover:scale-110 group-hover:bg-zinc-700/50 ring-1 ring-white/10 ${isDragging ? 'bg-primary/20 text-white' : 'text-zinc-400'}`}>
          <UploadIcon className="w-12 h-12" />
        </div>
        <h3 className="text-2xl font-semibold text-zinc-200 mb-2">
          Drag & Drop Video
        </h3>
        <p className="text-zinc-500">or click to browse files</p>
        <div className="mt-8 flex gap-3">
            <span className="text-[10px] text-zinc-500 font-mono border border-zinc-800/50 bg-black/20 px-3 py-1.5 rounded-full">MP4</span>
            <span className="text-[10px] text-zinc-500 font-mono border border-zinc-800/50 bg-black/20 px-3 py-1.5 rounded-full">MOV</span>
            <span className="text-[10px] text-zinc-500 font-mono border border-zinc-800/50 bg-black/20 px-3 py-1.5 rounded-full">WEBM</span>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept="video/*"
          className="hidden"
        />
      </div>
    </div>
  );
};

export default UploadZone;