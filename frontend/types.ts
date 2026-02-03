export enum AppState {
  UPLOAD = 'UPLOAD',
  PREVIEW = 'PREVIEW',
  GENERATING = 'GENERATING',
  EDITOR = 'EDITOR'
}

export interface Subtitle {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  words?: {
    text: string;
    startTime: number;
    endTime: number;
  }[];
}

export interface StyleConfig {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  yAlign: number; // 0 to 100 (percentage from top)
  fontWeight: string;
  displayMode: 'word' | 'phrase' | 'sentence';
  wordsPerLine?: number;
  activePreset?: string; // ID of the active video preset (e.g., 'reels', 'shorts')
  aspectRatio?: string; // Target aspect ratio (e.g., '9:16', '16:9') or undefined for auto
}

// Default style optimized for vertical video (Instagram Reels / YouTube Shorts)
export const DEFAULT_STYLE: StyleConfig = {
  fontFamily: 'Space Grotesk',
  fontSize: 48, // Larger default for vertical video
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  yAlign: 75, // Better position for vertical video
  fontWeight: '600',
  displayMode: 'word',
  wordsPerLine: 3,
  activePreset: '9:16', // Default to Portrait
  aspectRatio: '9:16'
};