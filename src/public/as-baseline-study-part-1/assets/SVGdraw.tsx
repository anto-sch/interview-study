import React from 'react';

export type Point = { x: number; y: number };
export type Stroke = Point[];

export interface SvgDrawProps {
    width?: number;
    height?: number;
    stroke?: string;
    strokeWidth?: number;
    background?: string;            // e.g., 'white' or 'transparent'
    roundDecimals?: number;         // coordinate quantization (1–2 is good)
    className?: string;
    style?: React.CSSProperties;
    onChangeSvg?: (svg: string) => void; // called after each completed stroke
}

export const SvgDraw: React.FC<SvgDrawProps> = ({
    width = 300,
    height = 200,
    stroke = 'black',
    strokeWidth = 2,
    background = 'transparent',
    roundDecimals = 1,
    className,
    style,
    onChangeSvg,
}) => {
    const [strokes, setStrokes] = React.useState<Stroke[]>([]);
    const drawingRef = React.useRef(false);

    const round = React.useCallback((n: number, d: number) => {
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
    }, []);

    const getPoint = React.useCallback(
        (e: React.PointerEvent<SVGSVGElement>): Point => {
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * width;
            const y = ((e.clientY - rect.top) / rect.height) * height;
            return { x, y };
        },
        [width, height]
    );

    const handlePointerDown = React.useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drawingRef.current = true;
            const p = getPoint(e);
            setStrokes((s) => [...s, [p]]);
        },
        [getPoint]
    );

    const handlePointerMove = React.useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            if (!drawingRef.current) return;
            const p = getPoint(e);
            setStrokes((s) => {
                if (s.length === 0) return [[p]];
                const copy = s.slice();
                copy[copy.length - 1] = copy[copy.length - 1].concat(p);
                return copy;
            });
        },
        [getPoint]
    );

    const finalizeStroke = React.useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            if (!drawingRef.current) return;
            drawingRef.current = false;
            const p = getPoint(e);
            setStrokes((s) => {
                const copy = s.slice();
                if (copy.length > 0) {
                    const last = copy[copy.length - 1];
                    const lastPt = last[last.length - 1];
                    if (!lastPt || lastPt.x !== p.x || lastPt.y !== p.y) {
                        copy[copy.length - 1] = last.concat(p);
                    }
                }
                if (onChangeSvg) {
                    const svgStr = strokesToSvgString(copy, {
                        width,
                        height,
                        stroke,
                        strokeWidth,
                        background,
                        roundDecimals,
                    });
                    onChangeSvg(svgStr);
                }
                return copy;
            });
        },
        [getPoint, onChangeSvg, width, height, stroke, strokeWidth, background, roundDecimals]
    );

    const handlePointerUp = finalizeStroke;
    const handlePointerCancel = finalizeStroke;
    const handlePointerLeave = finalizeStroke;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className={className}
            style={{ touchAction: 'none', background, display: 'block', ...style }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
        >
            {
                strokes.map((pts, i) => (
                    <path
                        key={i}
                        d={
                            pts.length
                                ? 'M ' +
                                pts
                                    .map((p) => `${round(p.x, roundDecimals)}, ${round(p.y, roundDecimals)}`)
                                    .join(' L ')
                                : ''
                        }
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
        </svg >
    );
};

// Helper to serialize strokes -> SVG string
export function strokesToSvgString(
    strokes: Stroke[],
    opts: {
        width: number;
        height: number;
        stroke: string;
        strokeWidth: number;
        background?: string;
        roundDecimals?: number;
    }
): string {
    const {
        width,
        height,
        stroke,
        strokeWidth,
        background = 'transparent',
        roundDecimals = 1,
    } = opts;

    const round = (n: number) => {
        const f = Math.pow(10, roundDecimals);
        return Math.round(n * f) / f;
    };

    const bg =
        background && background !== 'transparent'
            ? <rect x="0" y="0" width="100%" height="100%" fill="${background}" />
            : '';

    const paths = strokes
        .map((pts) => {
            if (!pts || pts.length === 0) return '';
            const d = 'M ' + pts.map((p) => `${round(p.x)
                }, ${round(p.y)
                }`).join(' L ');
            return `<path d="${d}" fill="none" stroke="${escapeAttr(stroke)}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" />`;
        })
        .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg}${paths}</svg>`;
}

// Minimal attribute escape for stroke color strings
function escapeAttr(s: string): string {
    return s.replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<');
}