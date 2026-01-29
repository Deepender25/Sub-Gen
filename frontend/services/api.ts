import { Subtitle, StyleConfig } from '../types';

const API_BASE = ''; // Proxy will handle the domain

export const uploadVideo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload video');
    }

    const data = await response.json();
    return data.filename;
};

export const generateSubtitles = async (filename: string): Promise<Subtitle[]> => {
    const response = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate subtitles');
    }

    const data = await response.json();

    // backend returns { segments: [{ start: number, end: number, text: string }, ...], language: string }
    // we need to map to Subtitle[]

    return data.segments.map((seg: any, index: number) => ({
        id: `sub-${index}-${Date.now()}`,
        startTime: seg.start,
        endTime: seg.end,
        text: seg.text,
        words: seg.words?.map((w: any) => ({
            text: w.word,
            startTime: w.start,
            endTime: w.end
        }))
    }));
};

export const exportVideo = async (
    filename: string,
    subtitles: Subtitle[],
    styleConfig: StyleConfig,
    format: string = 'mp4'
): Promise<string> => {
    // Convert Subtitle[] back to segments format expected by backend
    // Include word-level data for server-side entry building
    const segments = subtitles.map(s => ({
        start: s.startTime,
        end: s.endTime,
        text: s.text,
        words: s.words?.map(w => ({
            word: w.text,
            start: w.startTime,
            end: w.endTime
        }))
    }));

    // Send complete style config including displayMode and wordsPerLine
    // Backend will use this to compute entries server-side
    const response = await fetch(`${API_BASE}/burn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename,
            segments,
            styleConfig: {
                ...styleConfig,
                // Ensure these critical fields are included
                displayMode: styleConfig.displayMode || 'sentence',
                wordsPerLine: styleConfig.wordsPerLine || 3
            },
            format
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export video');
    }

    const data = await response.json();
    return data.download_url;
};
