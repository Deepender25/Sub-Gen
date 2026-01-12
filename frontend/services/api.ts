import { Subtitle } from '../types';

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
        text: seg.text
    }));
};

export const exportVideo = async (filename: string, subtitles: Subtitle[]): Promise<string> => {
    // Convert Subtitle[] back to segments format expected by backend
    const segments = subtitles.map(s => ({
        start: s.startTime,
        end: s.endTime,
        text: s.text
    }));

    const response = await fetch(`${API_BASE}/burn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, segments }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export video');
    }

    const data = await response.json();
    return data.download_url; // Returns the download URL
};
