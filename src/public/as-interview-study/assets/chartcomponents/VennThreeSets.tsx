import React, { useEffect, useMemo, useRef } from "react";
import { select, BaseType, Selection } from "d3-selection";

export type PairData = Record<string, boolean | undefined>;

export type CombineMode = "or" | "and" | "vote";

export type VennThreeSetsProps = {
    data: PairData[]; // e.g., [{ A: false, "A,B": true, B: true }, { B: false, "B,C": true, C: true }]
    width?: number;
    height?: number;
    r?: number; // circle radius
    centerDistance?: number; // distance between any two circle centers (equilateral triangle)
    combineMode?: CombineMode; // how to combine multiple pair inputs, default "or"
    // Optional display labels for propositions (map raw name -> label)
    labels?: Record<string, string>;
    // Optional colors by region. Keys must match:
    // - singles: the three proposition names (e.g., "A", "B", "C")
    // - pairs: sorted "A&B" style keys
    // - triple: "A&B&C"
    colors?: {
        singles?: Record<string, string>; // e.g., { A: "#5DA5DA", B: "#F17CB0", C: "#60BD68" }
        pairs?: Record<string, string>; // e.g., { "A&B": "#B2912F", "A&C": "#B276B2", "B&C": "#DECF3F" }
        triple?: string; // e.g., "#F15854"
        shade?: string; // e.g., "#D9D9D9"
    };
    stroke?: string;
    strokeWidth?: number;
    fontFamily?: string;
    className?: string;
    style?: React.CSSProperties;
};

type RegionAgg = { seen: number; yes: number };

// Utility to get a stable key like "A&B" with names sorted
function pairKey(a: string, b: string) {
    return [a, b].sort().join("&");
}
function tripleKey(a: string, b: string, c: string) {
    return [a, b, c].sort().join("&");
}

export default function VennThreeSets({
    data,
    width = 520,
    height = 360,
    r: rProp,
    centerDistance = 90,
    combineMode = "and",
    labels = {},
    colors = {},
    stroke = "#333",
    strokeWidth = 3,
    fontFamily = "system-ui, sans-serif",
    className,
    style,
}: VennThreeSetsProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const uidRef = useRef<string>(`v3-${Math.random().toString(36).slice(2, 9)}`);

    // 1) Infer the three unique proposition names
    const names = useMemo(() => {
        const set = new Set<string>();
        for (const d of data) {
            for (const k of Object.keys(d)) {
                if (k.includes(",")) {
                    const [l, r] = k.split(",").map((s) => s.trim());
                    if (l) set.add(l);
                    if (r) set.add(r);
                } else {
                    set.add(k.trim());
                }
            }
        }
        const arr = Array.from(set);
        if (arr.length !== 3) {
            throw new Error(
                `VennThreeSets: expected exactly 3 unique propositions, found ${arr.length
                }: ${arr.join(", ")}`
            );
        }
        // Sort to keep stable ordering
        return arr.sort();
    }, [data]);

    const [A, B, C] = names;

    // 2) Compute default geometry
    const r = useMemo(
        () => rProp ?? Math.min(width, height) / 4,
        [rProp, width, height]
    );
    const s = useMemo(
        () => centerDistance ?? r * 1.7, // center-to-center distance per pair
        [centerDistance, r]
    );

    // Equilateral triangle positions centered in the viewport
    const cx0 = width / 2;
    const cy0 = height / 2;
    const h = s / Math.sqrt(3); // vertical offset factor
    const centers = useMemo(
        () => ({
            [A]: { x: cx0 - s / 2, y: cy0 + h / 2 }, // bottom-left
            [B]: { x: cx0 + s / 2, y: cy0 + h / 2 }, // bottom-right
            [C]: { x: cx0, y: cy0 - h }, // top
        }),
        [A, B, C, cx0, cy0, s, h]
    );

    // 3) Aggregate pairwise inputs into 7 micro-regions using the chosen combineMode
    const regions = useMemo(() => {
        // Region keys:
        // singles: A, B, C
        // pairs: "A&B", "A&C", "B&C" (sorted)
        // triple: "A&B&C" (sorted)
        const agg = new Map<string, RegionAgg>();
        const ensure = (k: string) => {
            if (!agg.has(k)) agg.set(k, { seen: 0, yes: 0 });
            return agg.get(k)!;
        };

        // Helper to record a contribution for a region
        const addVote = (key: string, v: boolean | undefined) => {
            if (typeof v === "boolean") {
                const a = ensure(key);
                a.seen += 1;
                if (v) a.yes += 1;
            }
        };

        // Go through each pair data object
        for (const d of data) {
            // Find the pair key in the object ("X,Y" or "Y,X")
            let left: string | undefined;
            let right: string | undefined;
            let bothVal: boolean | undefined;

            for (const k of Object.keys(d)) {
                if (k.includes(",")) {
                    const [l, r] = k.split(",").map((s) => s.trim());
                    if (names.indexOf(l) !== -1 && names.indexOf(r) !== -1) {
                        left = l;
                        right = r;
                        // Accept either order in the object
                        bothVal =
                            d[`${l},${r}`] ??
                            d[`${l}, ${r}`] ??
                            d[`${r},${l}`] ??
                            d[`${r}, ${l}`];
                        break;
                    }
                }
            }

            if (!left || !right) {
                // If we didn't find an explicit "X,Y" key, fallback: try to guess from present singles
                const present = names.filter((n) => typeof d[n] === "boolean");
                if (present.length === 2) {
                    [left, right] = present;
                    bothVal =
                        d[`${left},${right}`] ??
                        d[`${left}, ${right}`] ??
                        d[`${right},${left}`] ??
                        d[`${right}, ${left}`];
                } else {
                    // Skip malformed entries
                    continue;
                }
            }

            const X = left;
            const Y = right;
            const Z = names.find((n) => n !== X && n !== Y)!;

            const onlyX = d[X];
            const onlyY = d[Y];
            const bothXY = !!bothVal;

            // Map this pair to 3-set micro-regions
            // only X => X-only, XZ-only
            addVote(X, onlyX);
            addVote(pairKey(X, Z), onlyX);

            // both X,Y => XY-only, XYZ
            addVote(pairKey(X, Y), bothXY);
            addVote(tripleKey(A, B, C), bothXY);

            // only Y => Y-only, YZ-only
            addVote(Y, onlyY);
            addVote(pairKey(Y, Z), onlyY);
        }

        // Reduce by combineMode
        const reduceAgg = (k: string): boolean => {
            const a = agg.get(k);
            if (!a || a.seen === 0) return false; // untouched => shade
            switch (combineMode) {
                case "and":
                    return a.yes === a.seen;
                case "vote":
                    return a.yes > a.seen / 2;
                case "or":
                default:
                    return a.yes > 0;
            }
        };

        return {
            singles: {
                [A]: reduceAgg(A),
                [B]: reduceAgg(B),
                [C]: reduceAgg(C),
            },
            pairs: {
                [pairKey(A, B)]: reduceAgg(pairKey(A, B)),
                [pairKey(A, C)]: reduceAgg(pairKey(A, C)),
                [pairKey(B, C)]: reduceAgg(pairKey(B, C)),
            },
            triple: reduceAgg(tripleKey(A, B, C)),
        };
    }, [data, names, A, B, C, combineMode]);

    // 4) Colors (with sensible defaults)
    const palette = useMemo(() => {
        const defaultSingles = {
            [A]: "#5DA5DA",
            [B]: "#F17CB0",
            [C]: "#60BD68",
        };
        const defaultPairs: Record<string, string> = {
            [pairKey(A, B)]: "#B2912F",
            [pairKey(A, C)]: "#B276B2",
            [pairKey(B, C)]: "#DECF3F",
        };
        return {
            singles: { ...defaultSingles, ...(colors.singles ?? {}) },
            pairs: { ...defaultPairs, ...(colors.pairs ?? {}) },
            triple: colors.triple ?? "#F15854",
            shade: colors.shade ?? "#D9D9D9",
        };
    }, [A, B, C, colors]);

    useEffect(() => {
        const svg = select<SVGSVGElement, unknown>(svgRef.current!);
        svg.selectAll("*").remove();

        const uid = uidRef.current;

        // Define clipPaths for the three circles
        const defs = svg.append("defs");

        const idA = `${uid}-clip-${A}`;
        const idB = `${uid}-clip-${B}`;
        const idC = `${uid}-clip-${C}`;

        addClip(defs, idA, centers[A].x, centers[A].y, r);
        addClip(defs, idB, centers[B].x, centers[B].y, r);
        addClip(defs, idC, centers[C].x, centers[C].y, r);

        const fullRect = { x: 0, y: 0, w: width, h: height };

        // Draw order:
        // 1) Singles: A, B, C (entire circles) using "only" flags; later layers will overwrite overlaps
        drawRectWithClip(
            svg,
            fullRect,
            idA,
            regions.singles[A] ? "#FFFF" : palette.shade,
            0.9
        );
        drawRectWithClip(
            svg,
            fullRect,
            idB,
            regions.singles[B] ? "#FFFF" : palette.shade,
            0.9
        );
        drawRectWithClip(
            svg,
            fullRect,
            idC,
            regions.singles[C] ? "#FFFF" : palette.shade,
            0.9
        );

        // 2) Pair overlaps (nested clips). These temporarily include the center; the triple layer will overwrite it.
        // AB
        drawNestedPair(
            svg,
            fullRect,
            idA,
            idB,
            regions.pairs[pairKey(A, B)]
                ? "#FFFF"
                : palette.shade,
            0.9
        );
        drawNestedPair(
            svg,
            fullRect,
            idA,
            idC,
            regions.pairs[pairKey(A, C)]
                ? "#FFFF"
                : palette.shade,
            0.9
        );
        drawNestedPair(
            svg,
            fullRect,
            idB,
            idC,
            regions.pairs[pairKey(B, C)]
                ? "#FFFF"
                : palette.shade,
            0.9
        );

        // 3) Triple overlap (nested A -> B -> C)
        drawNestedTriple(
            svg,
            fullRect,
            idA,
            idB,
            idC,
            regions.triple ? "#FFFF" : palette.shade,
            0.9
        );

        // 4) Circle outlines
        // [A, B, C].forEach((n) => {
        //     svg
        //         .append("circle")
        //         .attr("cx", centers[n].x)
        //         .attr("cy", centers[n].y)
        //         .attr("r", r)
        //         .attr("fill", "none")
        //         .attr("stroke", stroke)
        //         .attr("stroke-width", strokeWidth);
        // });

        svg
            .append("circle")
            .attr("cx", centers[A].x)
            .attr("cy", centers[A].y)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", palette.singles[A])
            .attr("stroke-width", strokeWidth);

        svg
            .append("circle")
            .attr("cx", centers[B].x)
            .attr("cy", centers[B].y)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", palette.singles[B])
            .attr("stroke-width", strokeWidth);

        svg
            .append("circle")
            .attr("cx", centers[C].x)
            .attr("cy", centers[C].y)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", palette.singles[C])
            .attr("stroke-width", strokeWidth);

        // 5) Labels
        const labelOffset = 0.9 * r;
        svg
            .append("text")
            .attr("x", centers[A].x - 1.5 * labelOffset)
            .attr("y", centers[A].y + 0.9 * labelOffset)
            .attr("font-family", fontFamily)
            .attr("font-size", 20)
            .attr("font-weight", "bold")
            .attr("fill", palette.singles[A])
            .text(labels[A] ?? A);

        svg
            .append("text")
            .attr("x", centers[B].x + labelOffset * 1.1)
            .attr("y", centers[B].y + 0.9 * labelOffset)
            .attr("font-family", fontFamily)
            .attr("font-size", 20)
            .attr("font-weight", "bold")
            .attr("fill", palette.singles[B])
            .text(labels[B] ?? B);

        svg
            .append("text")
            .attr("x", centers[C].x)
            .attr("y", centers[C].y - labelOffset * 1.3)
            .attr("font-family", fontFamily)
            .attr("font-size", 20)
            .attr("font-weight", "bold")
            .attr("fill", palette.singles[C])
            .attr("text-anchor", "middle")
            .text(labels[C] ?? C);
    }, [
        data,
        A,
        B,
        C,
        regions.singles,
        regions.pairs,
        regions.triple,
        width,
        height,
        r,
        centers,
        palette,
        stroke,
        strokeWidth,
        fontFamily,
        labels,
    ]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className={className}
            style={style}
            role="img"
            aria-label="Venn diagram of three sets"
        />
    );
}

// Helpers

type Sel = Selection<SVGSVGElement, unknown, any, unknown>;
type DefsSel = Selection<SVGDefsElement, unknown, any, unknown>;

function addClip(
    defs: DefsSel,
    id: string,
    cx: number,
    cy: number,
    r: number
) {
    defs
        .append("clipPath")
        .attr("id", id)
        .attr("clipPathUnits", "userSpaceOnUse")
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r);
}

function drawRectWithClip(
    svg: Sel,
    rect: { x: number; y: number; w: number; h: number },
    clipId: string,
    fill: string,
    opacity: number
) {
    svg
        .append("rect")
        .attr("x", rect.x)
        .attr("y", rect.y)
        .attr("width", rect.w)
        .attr("height", rect.h)
        .attr("fill", fill)
        .attr("opacity", opacity)
        .attr("clip-path", `url(#${clipId})`);
}

function drawNestedPair(
    svg: Sel,
    rect: { x: number; y: number; w: number; h: number },
    clipId1: string,
    clipId2: string,
    fill: string,
    opacity: number
) {
    const g = svg.append("g").attr("clip-path", `url(#${clipId1})`);
    g.append("rect")
        .attr("x", rect.x)
        .attr("y", rect.y)
        .attr("width", rect.w)
        .attr("height", rect.h)
        .attr("fill", fill)
        .attr("opacity", opacity)
        .attr("clip-path", `url(#${clipId2})`);
}

function drawNestedTriple(
    svg: Sel,
    rect: { x: number; y: number; w: number; h: number },
    clipIdA: string,
    clipIdB: string,
    clipIdC: string,
    fill: string,
    opacity: number
) {
    const gA = svg.append("g").attr("clip-path", `url(#${clipIdA})`);
    const gB = gA.append("g").attr("clip-path", `url(#${clipIdB})`);
    gB
        .append("rect")
        .attr("x", rect.x)
        .attr("y", rect.y)
        .attr("width", rect.w)
        .attr("height", rect.h)
        .attr("fill", fill)
        .attr("opacity", opacity)
        .attr("clip-path", `url(#${clipIdC})`);
}