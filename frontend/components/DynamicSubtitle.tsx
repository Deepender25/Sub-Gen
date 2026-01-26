import React, { useRef, useState, useLayoutEffect } from 'react';
import { StyleConfig } from '../types';

interface DynamicSubtitleProps {
    text: string;
    styleConfig: StyleConfig;
    previewScale: number;
    containerRef: React.RefObject<HTMLElement>;
}

export const DynamicSubtitle: React.FC<DynamicSubtitleProps> = ({ text, styleConfig, previewScale, containerRef }) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const baseFontSize = Math.max(12, styleConfig.fontSize * previewScale);
    const [fontSize, setFontSize] = useState(baseFontSize);

    // Reset font size when content or base configuration changes
    useLayoutEffect(() => {
        setFontSize(baseFontSize);
    }, [text, baseFontSize, styleConfig.fontFamily, styleConfig.fontWeight]);

    // Adjust size if overflowing
    useLayoutEffect(() => {
        if (!spanRef.current || !containerRef.current) return;

        const element = spanRef.current;
        const container = containerRef.current;

        const checkFit = () => {
            const rect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Safety margin (px)
            const margin = 20 * previewScale;

            const isOverflowingBottom = rect.bottom > (containerRect.bottom - margin);
            const isOverflowingTop = rect.top < (containerRect.top + margin);
            // We also check if it's strictly wider than the container (minus padding)
            const isTooWide = rect.width > (containerRect.width - (margin * 2));

            if ((isOverflowingBottom || isOverflowingTop || isTooWide) && fontSize > 8) {
                // Decrease font size by 10%
                setFontSize(prev => Math.max(8, prev * 0.9));
            }
        };

        // We can't synchronously loop re-renders, but the effect dependency on 'fontSize'
        // creates a loop until it stabilizes.
        checkFit();
    }, [fontSize, text, previewScale, containerRef]);

    return (
        <span
            ref={spanRef}
            style={{
                fontFamily: styleConfig.fontFamily,
                fontSize: `${fontSize}px`,
                color: styleConfig.color,
                backgroundColor: `rgba(${parseInt(styleConfig.backgroundColor.slice(1, 3), 16)}, ${parseInt(styleConfig.backgroundColor.slice(3, 5), 16)}, ${parseInt(styleConfig.backgroundColor.slice(5, 7), 16)}, ${styleConfig.backgroundOpacity})`,
                fontWeight: styleConfig.fontWeight,
                padding: '0.25em 0.5em',
                borderRadius: '0.4em',
                maxWidth: '94%', // increased slightly to give room for "almost fits" cases
                lineHeight: '1.4',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-block',
                whiteSpace: 'pre-wrap',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
                textAlign: 'center'
            }}
        >
            {text}
        </span>
    );
};
