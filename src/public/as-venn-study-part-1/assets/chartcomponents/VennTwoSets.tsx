import React, { useEffect, useMemo, useRef } from "react";
import { select, Selection, BaseType } from "d3-selection";

type GenericRegions = {
  onlyLeft?: boolean;
  both?: boolean;
  onlyRight?: boolean;
};

export type VennTwoSetsProps = {
  // Either a generic region object or a name-keyed map like { "P": false, "P,Q": true, "Q": true }
  data: GenericRegions | Record<string, boolean>;
  // Identifiers used in the name-keyed data (e.g., ["P","Q"]); defaults to ["A","B"]
  setNames?: [string, string];
  // Labels shown next to circles; defaults to setNames
  labels?: [string, string];

  width?: number;
  height?: number;
  r?: number;
  gap?: number;
  colors?: {
    A?: string; // left color
    B?: string; // right color
    AB?: string; // intersection color
    shade?: string;
  };
  stroke?: string;
  strokeWidth?: number;
  fontFamily?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function VennTwoSets({
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
}: VennTwoSetsProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const uidRef = useRef<string>(`v2-${Math.random().toString(36).slice(2, 9)}`);

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
      AB: colors.AB ?? "#B2912F",
      shade: colors.shade ?? "#D9D9D9",
    }),
    [colors]
  );

  const hatchPattern = `<pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4"     height="4"><path d="M-1,1 l2,-2
                      M0,4 l4,-4
                      M3,5 l2,-2" 
              style="stroke:black; stroke-width:1" />
    </pattern>`

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

    const cxA = width / 2 - gap / 2;
    const cxB = width / 2 + gap / 2;
    const cy = height / 2;

    const idClipA = `${uid}-clipA`;
    const idClipB = `${uid}-clipB`;

    const defs = svg.append("defs");
    addClip(defs, idClipA, cxA, cy, r);
    addClip(defs, idClipB, cxB, cy, r);

    // Hatched pattern
    const spacing = 8;
    const angle = 45;
    const stroke = palette.shade;     // or a different color if you want
    const idHatch = `hatch-${idClipA}`; // ensure uniqueness per component

    const pattern = defs
      .append("pattern")
      .attr("id", idHatch)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", spacing)
      .attr("height", spacing)
      .attr("patternTransform", `rotate(${angle})`);

    pattern
      .append("rect")
      .attr("width", spacing)
      .attr("height", spacing)
      .attr("fill", "white")          // or palette.shade with lower opacity
      .attr("opacity", 0.0);          // 0 for transparent background

    // One stripe per tile (the pattern repeats)
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", spacing)
      .attr("stroke", stroke)
      .attr("stroke-width", strokeWidth*3);


    // Only Left region (clipped to left circle)
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", norm.onlyLeft ? "#FFFF" : `url(#${idHatch})`)
      .attr("opacity", 0.9)
      .attr("clip-path", `url(#${idClipA})`);

    // Only Right region (clipped to right circle)
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", norm.onlyRight ? "#FFFF" : `url(#${idHatch})`)
      .attr("opacity", 0.9)
      .attr("clip-path", `url(#${idClipB})`);

    // Intersection region (clip to left then right)
    const gAB = svg.append("g").attr("clip-path", `url(#${idClipA})`);
    gAB
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", norm.both ? "#FFFF" : `url(#${idHatch})`)
      .attr("opacity", 0.9)
      .attr("clip-path", `url(#${idClipB})`);

    // Outlines
    svg
      .append("circle")
      .attr("cx", cxA)
      .attr("cy", cy)
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", palette.A)
      .attr("stroke-width", strokeWidth);

    svg
      .append("circle")
      .attr("cx", cxB)
      .attr("cy", cy)
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", palette.B)
      .attr("stroke-width", strokeWidth);

    // Labels
    svg
      .append("text")
      .attr("x", cxA - r * 0.75)
      .attr("y", cy - r * 1.0)
      .attr("font-family", fontFamily)
      .attr("font-size", 20)
      .attr("font-weight", "bold")
      .attr("fill", palette.A)
      .text(labelLeft);

    svg
      .append("text")
      .attr("x", cxB + r * 0.55)
      .attr("y", cy - r * 1.0)
      .attr("font-family", fontFamily)
      .attr("font-size", 20)
      .attr("font-weight", "bold")
      .attr("fill", palette.B)
      .text(labelRight);
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
    palette.AB,
    palette.shade,
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
      aria-label="Venn diagram of two sets"
    />
  );
}

function addClip(
  defs: Selection<SVGDefsElement, unknown, BaseType, unknown>,
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
