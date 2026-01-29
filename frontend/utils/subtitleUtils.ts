import { Subtitle, StyleConfig } from '../types';

/**
 * Represents a single subtitle entry with exact timing and text.
 * This is the unified format used for both SRT generation and video burning.
 */
export interface SubtitleEntry {
    text: string;
    startTime: number;
    endTime: number;
}

/**
 * Video preset for common platforms
 */
export interface VideoPreset {
    id: string;
    name: string;
    aspectRatio: string;
    width: number;
    height: number;
    recommendedFontSize: number;
    recommendedYAlign: number;
    icon: string;
}

/**
 * Predefined presets for popular platforms
 */
export const VIDEO_PRESETS: VideoPreset[] = [
    {
        id: 'reels',
        name: 'Instagram Reels',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        recommendedFontSize: 48,
        recommendedYAlign: 75,
        icon: '📱'
    },
    {
        id: 'shorts',
        name: 'YouTube Shorts',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        recommendedFontSize: 52,
        recommendedYAlign: 70,
        icon: '▶️'
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        recommendedFontSize: 50,
        recommendedYAlign: 72,
        icon: '🎵'
    },
    {
        id: 'feed',
        name: 'Instagram Feed',
        aspectRatio: '4:5',
        width: 1080,
        height: 1350,
        recommendedFontSize: 42,
        recommendedYAlign: 80,
        icon: '📷'
    },
    {
        id: 'square',
        name: 'Square',
        aspectRatio: '1:1',
        width: 1080,
        height: 1080,
        recommendedFontSize: 36,
        recommendedYAlign: 82,
        icon: '⬜'
    },
    {
        id: 'landscape',
        name: 'Landscape (16:9)',
        aspectRatio: '16:9',
        width: 1920,
        height: 1080,
        recommendedFontSize: 28,
        recommendedYAlign: 85,
        icon: '🖥️'
    }
];

/**
 * Build subtitle entries based on display mode.
 * This replicates the frontend getDisplayedText() logic but generates
 * a complete list of all entries with proper timing.
 * 
 * @param subtitles - Raw subtitles with word-level timestamps
 * @param styleConfig - Style configuration including displayMode
 * @returns Array of SubtitleEntry with exact start/end times
 */
export function buildSubtitleEntries(
    subtitles: Subtitle[],
    styleConfig: StyleConfig
): SubtitleEntry[] {
    const entries: SubtitleEntry[] = [];
    const displayMode = styleConfig.displayMode;

    for (const subtitle of subtitles) {
        // Sentence mode: one entry per subtitle segment
        if (displayMode === 'sentence') {
            entries.push({
                text: subtitle.text.trim(),
                startTime: subtitle.startTime,
                endTime: subtitle.endTime
            });
            continue;
        }

        // If no word-level data, fallback to sentence
        if (!subtitle.words || subtitle.words.length === 0) {
            entries.push({
                text: subtitle.text.trim(),
                startTime: subtitle.startTime,
                endTime: subtitle.endTime
            });
            continue;
        }

        // Word mode: one entry per word
        if (displayMode === 'word') {
            for (let i = 0; i < subtitle.words.length; i++) {
                const word = subtitle.words[i];
                const nextWord = subtitle.words[i + 1];

                // Extend word duration to fill gap (prevents flashing)
                // End time is either next word start or subtitle end
                const endTime = nextWord
                    ? Math.min(nextWord.startTime, subtitle.endTime)
                    : subtitle.endTime;

                entries.push({
                    text: word.text.trim(),
                    startTime: word.startTime,
                    endTime: endTime
                });
            }
            continue;
        }

        // Phrase mode: group words into chunks
        if (displayMode === 'phrase') {
            const wordsPerLine = styleConfig.wordsPerLine || 3;
            const allWords = subtitle.words;

            let currentChunk: typeof allWords = [];
            let chunkStartTime = allWords[0]?.startTime ?? subtitle.startTime;
            let wordCount = 0;

            for (let i = 0; i < allWords.length; i++) {
                const word = allWords[i];

                if (currentChunk.length === 0) {
                    chunkStartTime = word.startTime;
                }

                currentChunk.push(word);
                wordCount++;

                // Break conditions:
                // 1. Reached max words per line
                // 2. Hit punctuation (natural break)
                // 3. Last word in segment
                const hasPunctuation = /[.?!,;:]/.test(word.text);
                const shouldBreak = wordCount >= wordsPerLine || (hasPunctuation && wordCount > 1);
                const isLast = i === allWords.length - 1;

                if (shouldBreak || isLast) {
                    const lastWordInChunk = currentChunk[currentChunk.length - 1];
                    const nextWord = allWords[i + 1];

                    // Extend chunk duration to fill gap
                    const endTime = nextWord
                        ? Math.min(nextWord.startTime, subtitle.endTime)
                        : subtitle.endTime;

                    entries.push({
                        text: currentChunk.map(w => w.text.trim()).join(' '),
                        startTime: chunkStartTime,
                        endTime: endTime
                    });

                    currentChunk = [];
                    wordCount = 0;
                }
            }
        }
    }

    return entries;
}

/**
 * Generate SRT content from subtitle entries
 */
export function generateSRTContent(entries: SubtitleEntry[]): string {
    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
    };

    let srtContent = '';
    entries.forEach((entry, index) => {
        srtContent += `${index + 1}\n`;
        srtContent += `${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n`;
        srtContent += `${entry.text}\n\n`;
    });

    return srtContent;
}

/**
 * Convert hex color to ASS format (&HAABBGGRR)
 */
function hexToASSColor(hex: string, opacity: number = 1.0): string {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return '&H00FFFFFF';

    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);

    // ASS alpha: 00 = opaque, FF = transparent
    const alpha = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase();

    // ASS color format is BBGGRR
    return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

/**
 * Format time for ASS format (H:MM:SS.cc)
 */
function formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centis = Math.floor((seconds % 1) * 100);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

/**
 * Generate ASS subtitle content for FFmpeg
 */
export function generateASSContent(
    entries: SubtitleEntry[],
    styleConfig: StyleConfig,
    videoWidth: number = 1080,
    videoHeight: number = 1920
): string {
    const fontFamily = styleConfig.fontFamily || 'Arial';
    const fontSize = styleConfig.fontSize || 48;
    const primaryColor = hexToASSColor(styleConfig.color || '#FFFFFF');
    const backColor = hexToASSColor(styleConfig.backgroundColor || '#000000', styleConfig.backgroundOpacity || 0.6);

    // Calculate MarginV based on yAlign (percentage from top)
    const yAlign = styleConfig.yAlign || 75;
    const marginV = Math.round(videoHeight * (1.0 - (yAlign / 100)));

    // Font weight to bold flag
    const bold = parseInt(styleConfig.fontWeight || '400') >= 600 ? 1 : 0;

    // Alignment: 2 = bottom center
    const alignment = 2;

    // BorderStyle: 3 = opaque box, 1 = outline
    const borderStyle = styleConfig.backgroundOpacity > 0 ? 3 : 1;

    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,0,0,${borderStyle},0,0,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events = entries.map(entry => {
        const start = formatASSTime(entry.startTime);
        const end = formatASSTime(entry.endTime);
        // Escape special characters and newlines
        const text = entry.text.replace(/\n/g, '\\N').replace(/\r/g, '');
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

    return header + events.join('\n');
}

/**
 * Estimate file size for client-side processing warning
 */
export function estimateProcessingDifficulty(
    videoDuration: number,
    videoWidth: number,
    videoHeight: number
): 'easy' | 'medium' | 'hard' {
    const pixels = videoWidth * videoHeight;
    const megapixels = pixels / 1000000;

    // Easy: short video, low resolution
    if (videoDuration < 60 && megapixels < 2) return 'easy';

    // Hard: long video or high resolution
    if (videoDuration > 180 || megapixels > 4) return 'hard';

    return 'medium';
}
