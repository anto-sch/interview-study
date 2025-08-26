import React, { useMemo, useRef, useState } from "react";
import EulerTwoSets from "./chartcomponents/EulerTwoSets";
import { Implication, implicationsToVennPairs, parseLiteral } from "./chartcomponents/ImplicationsToVennPairs";
import './chartcomponents/UIstyles.css';

type PairData = Record<string, boolean | undefined>;

function extractPairNames(d: PairData): [string, string] {
    // Prefer explicit "X,Y" key if present
    for (const k of Object.keys(d)) {
        if (k.includes(",")) {
            const [l, r] = k.split(",").map((s) => s.trim());
            if (l && r) return [l, r];
        }
    }
    // Otherwise, pick the first two single keys that have boolean values
    const singles = Object.keys(d).filter((k) => !k.includes(",") && typeof d[k] === "boolean");
    if (singles.length >= 2) return [singles[0], singles[1]];
    return ["A", "B"]; // fallback
}

function uniqueMarkClassesDOM(items: Implication[]): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const scratch = document.createElement('div');

    for (const it of items) {
        scratch.innerHTML = it.text || '';
        scratch.querySelectorAll('mark').forEach(mark => {
            mark.classList.forEach(c => {
                if (c && !seen.has(c)) {
                    seen.add(c);
                    ordered.push(c);
                }
            });
        });
    }

    scratch.innerHTML = '';
    return ordered;
}

// 2) Color generator (distinct-ish colors)
// Cycles through hues using golden-angle steps
function colorForIndex(i: number) {
    const colors = ["#874fff", "#FF7237", "#24CB71"]
    const hue = (i * 137.508) % 360;
    const sat = 80;   // %
    const light = 85; // %
    // return `hsl(${hue}, ${sat}%, ${light}%)`;
    return colors[i]+"88"
}

function buildColorMap(classList: readonly string[]): Map<string, string> {
    const map = new Map<string, string>();
    classList.forEach((cls, idx) => map.set(cls, colorForIndex(idx).slice(0, -2)));
    return map;
}

// 3) CSS.escape polyfill (very simple)
function cssEscapeSimple(s: string) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

// 4) Build scoped CSS for this instance
function buildScopedCSS(classList: ReadonlyArray<string>, scopeId: string) {
    let css = `.vp-text-block[data-scope="${scopeId}"] .vp-sentence + .vp-sentence::before { content: " "; } .vp-text-block[data-scope="${scopeId}"] .vp-sentence mark { background: transparent; color: inherit; padding: 0 2px; border-radius: 3px; transition: background-color .15s ease, color .15s ease; }`.trim();

    classList.forEach((cls, idx) => {
        const color = colorForIndex(idx);
        const sel = cssEscapeSimple(cls);
        css += `.vp-text-block[data-scope="${scopeId}"] .vp-sentence.is-revealed mark.${sel} { background-color: ${color}; }`.trim();
    });

    return css;
}

function EulerTask({ parameters }: { parameters: any }) {

    const items: Implication[] = Array.isArray(parameters?.data) ? parameters.data : [];

    // Sizing (you can override via parameters)
    const gap: number = parameters?.gap ?? 16;

    const twoWidth: number = parameters?.twoWidth ?? 110;
    const twoHeight: number = parameters?.twoHeight ?? 90;

    const textMaxWidth: number | undefined = parameters?.textMaxWidth ?? 500; // e.g., 360

    // Convert to TwoSets data array
    const pairs: PairData[] = implicationsToVennPairs(items);

    // Progressive reveal state with one extra step for the 3-set diagram
    // step range: 0 .. items.length + 1
    const [step, setStep] = useState<number>(0);
    // no step for unification
    const totalSteps = items.length;

    const revealedCount = Math.min(step, items.length); // sentences + EulerTwoSets revealed
    const showThree = step >= items.length + 1;

    const canHint = step < totalSteps && items.length > 0;

    const onHint = () => {
        if (!canHint) return;
        setStep((s) => Math.min(s + 1, totalSteps));
    };

    const onReset = () => setStep(0);

    // Unique scope id so styles don't leak between component instances
    const scopeId = useRef(`vp-${Math.random().toString(36).slice(2, 9)}`).current;

    const classList = useMemo(() => uniqueMarkClassesDOM(items), [items]);
    const colorMap = useMemo(() => buildColorMap(classList), [classList]);
    const dynamicCSS = useMemo(() => buildScopedCSS(classList, scopeId), [classList, scopeId]);

    return (

        <div className="vp-dynamic-container" style={{ display: "grid", gap }}>
            {/* Grid with two columns: [text | all EulerTwoSets (space reserved) */}
            <div
                className="vp-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "0.85fr auto",
                    alignItems: "center",
                    gap,
                    width: "58%"
                }}
            >
                {/* Left column: sentences as one flowing block, no manual line breaks */}
                <>
                    <style>{dynamicCSS}</style>
                    <div
                        className="vp-text-block"
                        data-scope={scopeId}
                        style={{
                            maxWidth: textMaxWidth,
                            whiteSpace: "normal",
                            lineHeight: 2
                        }}
                    >
                        {items.map((it, idx) => {
                            const left = parseLiteral(it.antecedent).name;
                            const right = parseLiteral(it.consequent).name;
                            const pairKey = `${left}, ${right}`;
                            const revealed = idx < revealedCount;

                            return (
                                <span
                                    key={idx}
                                    className={`vp-sentence vp-sentence-${idx} ${revealed ? "is-revealed" : ""}`}
                                    data-index={idx}
                                    data-left={left}
                                    data-right={right}
                                    data-pair={pairKey}
                                    style={{ display: "inline" }}
                                    dangerouslySetInnerHTML={{ __html: it.text }}
                                />
                            );
                        })}
                    </div>
                </>
                {/* Right: reserve space by rendering all EulerTwoSets; hide unrevealed via visibility */}
                <div
                    className="vp-two-list"
                    style={{
                        display: "grid",
                        gridAutoRows: "min-content",
                        gap,
                        width: twoWidth
                    }}
                >
                    {pairs.length > 0 ? (
                        pairs.map((d, idx) => {
                            const [leftName, rightName] = extractPairNames(d);
                            const visible = idx < revealedCount;
                            return (
                                <div
                                    key={idx}
                                    className={`vp-two-item vp-two-item-${idx} ${visible ? "is-revealed" : ""}`}
                                    data-index={idx}
                                    data-left={leftName}
                                    data-right={rightName}
                                    data-pair={`${leftName},${rightName}`}
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        width: twoWidth,
                                        height: twoHeight,
                                        // Reserve space: keep the box size; hide content until revealed
                                        visibility: visible ? "visible" : "hidden"
                                    }}
                                    aria-hidden={!visible}
                                >
                                    <EulerTwoSets
                                        data={d}
                                        setNames={[leftName, rightName]}
                                        labels={[leftName, rightName]}
                                        width={twoWidth}
                                        height={twoHeight}
                                        colors={{ A: colorMap.get(leftName), B: colorMap.get(rightName) }}
                                    />
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ color: "#666", fontStyle: "italic" }}>No pair data</div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="vp-controls" style={{ display: "flex", marginBottom: "20px", gap }}>
                <button
                    type="button"
                    className="vp-btn-hint"
                    onClick={onHint}
                    disabled={!canHint}
                    aria-disabled={!canHint}
                >
                    Hint
                </button>
                <button
                    type="button"
                    className="vp-btn-reset"
                    onClick={onReset}
                    disabled={step === 0}
                    aria-disabled={step === 0}
                >
                    Reset
                </button>
            </div>
        </div >
    );
}

export default EulerTask;