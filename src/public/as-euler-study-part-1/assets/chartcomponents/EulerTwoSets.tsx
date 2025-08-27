import React, { useEffect, useMemo, useRef } from "react";
import { select, Selection, BaseType } from "d3-selection";

type GenericRegions = {
    onlyLeft?: boolean;
    both?: boolean;
    onlyRight?: boolean;
};

export type EulerTwoSetsProps = {
    // Either a generic region object or a name-keyed map like { "P": false, "P,Q": true, "Q": true }
    data: GenericRegions | Record<string, boolean>;
    // Identifiers used in the name-keyed data (e.g., ["P","Q"]); defaults to ["A","B"]
    setNames?: [string, string];
    // Labels shown inside the circles; defaults to setNames
    labels?: [string, string];

    width?: number;
    height?: number;
    r?: number;
    gap?: number;
    colors?: {
        A?: string; // left color
        B?: string; // right color
        // AB?: string; // intersection color
        // shade?: string;
    };
    stroke?: string;
    strokeWidth?: number;
    fontFamily?: string;
    className?: string;
    style?: React.CSSProperties;
};

export default function EulerTwoSets({
    data,
    setNames = ["A", "B"],
    labels,
    width = 420,
    height = 260,
    r: rProp,
    gap: gapProp,
    colors = {},
    stroke = "#333",
    strokeWidth = 3,
    fontFamily = "system-ui, sans-serif",
    className,
    style,
}: EulerTwoSetsProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const uidRef = useRef<string>(`e2-${Math.random().toString(36).slice(2, 9)}`);

    const [leftName, rightName] = setNames;
    const [labelLeft, labelRight] = labels ?? setNames;

    const r = useMemo(
        () => rProp ?? Math.min(width, height) / 3,
        [rProp, width, height]
    );
    const gap = useMemo(() => gapProp ?? r * 1.2, [gapProp, r]);

    const palette = useMemo(
        () => ({
            A: colors.A ?? "#5DA5DA",
            B: colors.B ?? "#F17CB0",
            // AB: colors.AB ?? "#B2912F",
            // shade: colors.shade ?? "#D9D9D9",
        }),
        [colors]
    );

    // Resolve booleans from either generic keys or name-based keys.
    const norm = useMemo(() => {
        // If generic keys exist, use them directly.
        if (
            typeof (data as GenericRegions).onlyLeft === "boolean" ||
            typeof (data as GenericRegions).both === "boolean" ||
            typeof (data as GenericRegions).onlyRight === "boolean"
        ) {
            const g = data as GenericRegions;
            return {
                onlyLeft: !!g.onlyLeft,
                both: !!g.both,
                onlyRight: !!g.onlyRight,
            };
        }

        // Otherwise, interpret as name-keyed map: { "L": boolean, "L,R": boolean, "R": boolean }
        const map = data as Record<string, boolean>;
        const keyBothVariants = [
            `${leftName},${rightName}`,
            `${leftName}, ${rightName}`, // allow a space variant
        ];

        return {
            onlyLeft: !!map[leftName],
            both: keyBothVariants.some((k) => !!map[k]),
            onlyRight: !!map[rightName],
        };
    }, [data, leftName, rightName]);

    useEffect(() => {
        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        const uid = uidRef.current;

        switch (true) {
            // left implies right
            case (!norm.onlyLeft && norm.both && norm.onlyRight): {
                const cxA = width / 2.6;
                const cyA = height / 2.6;
                const rA = Math.min(width, height) / 4.6;
                const cxB = width / 2;
                const cyB = height / 2;
                const rB = Math.min(width, height) / 2.2;
                // Outlines
                svg
                    .append("circle")
                    .attr("cx", cxA)
                    .attr("cy", cyA)
                    .attr("r", rA)
                    .attr("fill", "none")
                    .attr("stroke", palette.A)
                    .attr("stroke-width", strokeWidth);

                svg
                    .append("circle")
                    .attr("cx", cxB)
                    .attr("cy", cyB)
                    .attr("r", rB)
                    .attr("fill", "none")
                    .attr("stroke", palette.B)
                    .attr("stroke-width", strokeWidth);

                // Labels
                svg
                    .append("text")
                    .attr("x", cxA)
                    .attr("y", cyA)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.A)
                    .text(labelLeft);

                svg
                    .append("text")
                    .attr("x", cxB * 1.35)
                    .attr("y", cyB * 1.5)
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.B)
                    .text(labelRight);
                break;
            }

            // not left implies right OR left implies not right
            case (norm.onlyLeft && !norm.both && norm.onlyRight): {
                const cxA = width / 2 - .8*gap;
                const cyA = height / 2;
                const rA = Math.min(width, height) / 4;
                const cxB = width / 2 + 0.8*gap;
                const cyB = height / 2;
                const rB = Math.min(width, height) / 4;
                // Outlines
                svg
                    .append("circle")
                    .attr("cx", cxA)
                    .attr("cy", cyA)
                    .attr("r", rA)
                    .attr("fill", "none")
                    .attr("stroke", palette.A)
                    .attr("stroke-width", strokeWidth);

                svg
                    .append("circle")
                    .attr("cx", cxB)
                    .attr("cy", cyB)
                    .attr("r", rB)
                    .attr("fill", "none")
                    .attr("stroke", palette.B)
                    .attr("stroke-width", strokeWidth);

                // Labels
                svg
                    .append("text")
                    .attr("x", cxA)
                    .attr("y", cyA)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.A)
                    .text(labelLeft);

                svg
                    .append("text")
                    .attr("x", cxB)
                    .attr("y", cyB)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.B)
                    .text(labelRight);
                break;
            }

            // 3) not left implies not right
            case (norm.onlyLeft && norm.both && !norm.onlyRight): {
                const cxA = width / 2;
                const cyA = height / 2;
                const rA = Math.min(width, height) / 2.2;
                const cxB = width / 2.6;
                const cyB = height / 2.6;
                const rB = Math.min(width, height) / 4.6;
                // Outlines
                svg
                    .append("circle")
                    .attr("cx", cxA)
                    .attr("cy", cyA)
                    .attr("r", rA)
                    .attr("fill", "none")
                    .attr("stroke", palette.A)
                    .attr("stroke-width", strokeWidth);

                svg
                    .append("circle")
                    .attr("cx", cxB)
                    .attr("cy", cyB)
                    .attr("r", rB)
                    .attr("fill", "none")
                    .attr("stroke", palette.B)
                    .attr("stroke-width", strokeWidth);

                // Labels
                svg
                    .append("text")
                    .attr("x", cxA * 1.35)
                    .attr("y", cyA * 1.5)
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.A)
                    .text(labelLeft);

                svg
                    .append("text")
                    .attr("x", cxB)
                    .attr("y", cyB)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-family", fontFamily)
                    .attr("font-size", 20)
                    .attr("font-weight", "bold")
                    .attr("fill", palette.B)
                    .text(labelRight);
                break;
            }
        }

        }, [
            data,
            norm.onlyLeft,
            norm.both,
            norm.onlyRight,
            width,
            height,
            r,
            gap,
            palette.A,
            palette.B,
            stroke,
            strokeWidth,
            fontFamily,
            labelLeft,
            labelRight,
        ]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className={className}
            style={style}
            role="img"
            aria-label="Euler diagram of two sets"
        />
    );
}
