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
}

export const DEFAULT_STYLE: StyleConfig = {
  fontFamily: 'Space Grotesk',
  fontSize: 24,
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  yAlign: 85,
  fontWeight: '600',
  displayMode: 'word',
  wordsPerLine: 3
};