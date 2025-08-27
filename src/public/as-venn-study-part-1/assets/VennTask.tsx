import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initializeTrrack, Registry } from '@trrack/core';
import { optimize } from 'svgo';
import { StimulusParams } from '../../../store/types';
import VennTwoSets from "./chartcomponents/VennTwoSets";
import VennThreeSets from "./chartcomponents/VennThreeSets";
import { Implication, implicationsToVennPairs, parseLiteral } from "./chartcomponents/ImplicationsToVennPairs";
import './chartcomponents/UIstyles.css';
import { SvgDraw } from './SVGdraw'; // adjust the path

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
function colorForIndex(i: number) {
    const colors = ["#874fff", "#FF7237", "#24CB71"]
    return colors[i] + "88"
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

function minifySvg(svg: string) {
    const { data } = optimize(svg, {
        multipass: true,
        plugins: [
            {
                name: 'preset-default', params: {
                    overrides: {
                        // keep viewBox; tune precision for your tolerance (2–3 is often fine)
                        removeViewBox: false,
                        cleanupNumericValues: { floatPrecision: 2 },
                        convertPathData: { floatPrecision: 2 },
                    }
                }
            },
            'removeViewBox'
        ],
    });
    return data;
}

function getSingleDifference(arr1: string[], arr2: string[]) {
    // Copy the arrays and sort for a predictable comparison
    const a = [...arr1].sort();
    const b = [...arr2].sort();
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) {
            // That element is the only mismatch
            return (a[i] !== undefined && b[i] !== undefined)
                ? (a.length > b.length ? a[i] : b[i])
                : (a[i] !== undefined ? a[i] : b[i]);
        }
    }
    // No difference found
    return undefined;
}

function VennTask({ parameters, setAnswer }: StimulusParams<any>) {

    const items: Implication[] = Array.isArray(parameters?.data) ? parameters.data : [];
    const premises = items.filter(item => item.argument === "premise");
    const hasConclusion = items.some(item => item.argument === "conclusion");

    // Sizing of diagrams
    const gap: number = parameters?.gap ?? 16;

    const twoWidth: number = parameters?.twoWidth ?? 100;
    const twoHeight: number = parameters?.twoHeight ?? 90;

    const threeWidth: number = parameters?.threeWidth ?? 130;
    const threeHeight: number = parameters?.threeHeight ?? 160;

    const textMaxWidth: number | undefined = parameters?.textMaxWidth ?? 500; // e.g., 360

    // VennThreeSets passthrough options (optional)
    const combineMode = parameters?.combineMode; // "or" | "and" | "vote"
    const centerDistance = parameters?.centerDistance ?? 40; // number
    const orientation = parameters?.orientation; // "twoBottom" | "twoTop"

    // Convert to VennTwoSets data array
    const premisePairs: PairData[] = implicationsToVennPairs(premises);
    const pairs: PairData[] = implicationsToVennPairs(items);

    // Progressive reveal state with one extra step for the 3-set diagram or two if there is a conclusion in the argument
    // step range: 0 .. items.length + 1
    const [step, setStep] = useState<number>(0);

    let totalSteps = items.length + 1;
    hasConclusion && (totalSteps = totalSteps + 1);

    const revealedCount = Math.min(step, items.length); // sentences + VennTwoSets revealed
    const showThree = step >= items.length + 1;
    const showConclusion = step >= items.length + 2;

    const canHint = step < totalSteps && items.length > 0;

    // Unique scope id so styles don't leak between component instances
    const scopeId = useRef(`vp-${Math.random().toString(36).slice(2, 9)}`).current;

    // get propositions in premises
    const classListPremises = useMemo(() => uniqueMarkClassesDOM(premises), [premises]);
    // get propositions in argument
    const classList = useMemo(() => uniqueMarkClassesDOM(items), [items]);
    const colorMap = useMemo(() => buildColorMap(classList), [classList]);
    const dynamicCSS = useMemo(() => buildScopedCSS(classList, scopeId), [classList, scopeId]);

    const extraProposition = getSingleDifference(classList, classListPremises)

    let extraImplication: Record<string, boolean | undefined> = {};
    if (extraProposition !== undefined) {
        extraImplication = {
            [extraProposition]: true,
            [`${extraProposition},${classList[0]}`]: true,
            [classList[0]]: true
        }
    }
    console.log(extraProposition, extraImplication)

    const [svg, setSvg] = React.useState<string>('');

    const { actions, trrack } = useMemo(() => {
        const reg = Registry.create();

        const clickAction = reg.register('draw', (state, currentSketch: any) => {
            state.sketch = currentSketch;
            return state;
        });

        const getHint = reg.register('hint', (state, currentHint: number) => {
            state.hint = currentHint;
            return state;
        });

        const resetHint = reg.register('reset', (state, currentHint: number) => {
            state.hint = currentHint;
            return state;
        });

        const trrackInst = initializeTrrack({
            registry: reg,
            initialState: { sketch: [], hint: 0 },
        });

        return {
            actions: {
                clickAction,
                getHint,
                resetHint
            },
            trrack: trrackInst,
        };
    }, []);

    const onHint = useCallback(() => {
        if (!canHint) return;
        setStep((s) => Math.min(s + 1, totalSteps));
        trrack.apply('get hint', actions.clickAction(step));

        setAnswer({
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: {}
        });
    }, [actions, trrack]);

    useEffect(() => {
        let timer: number | undefined;
        if (!canHint) return; 
        if (step > 0) {
            timer = window.setTimeout(() => {
                setStep(s => Math.min(s + 1, totalSteps));
            }, 1500);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [step, totalSteps]);

    const onReset = useCallback(() => {
        setStep(0);
        trrack.apply('reset hint', actions.clickAction(step));
        setAnswer({
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: {}
        });
    }, [actions, trrack]);

    const handleSvgChange = useCallback((s: string) => {
        setSvg(s);
        trrack.apply('draw path', actions.clickAction(s));

        const min = minifySvg(s);
        console.log(min)

        setAnswer({
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: { "sketch": min } // You can set the answers here if you want to control it manually, otherwise leave empty.
        });
    }, [actions, setAnswer, trrack]);

    return (

        <div className="vp-dynamic-container" style={{ display: "grid", gap }}>
            {/* Grid with three columns: [text | all VennTwoSets (space reserved) | VennThreeSets (space reserved) | sketch pad] */}
            <div
                className="vp-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "0.85fr auto auto auto",
                    alignItems: "center",
                    gap,
                    width: "100%"
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
                {/* Middle: reserve space by rendering all VennTwoSets; hide unrevealed via visibility */}
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
                                    <VennTwoSets
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

                {/* Right: reserve space for VennThreeSets; reveal on the extra (last) click */}
                <div
                    className="vp-three"
                    style={{
                        display: "grid",
                        gridAutoRows: "min-content",
                        gap,
                        width: threeWidth,
                        height: threeHeight * 2
                    }}
                >
                    <div
                        className={`vp-three-inner ${showThree ? "is-revealed" : ""}`}
                        style={{
                            display: "flex",
                            width: threeWidth,
                            height: threeHeight,
                            visibility: showThree ? "visible" : "hidden"
                        }}
                        aria-hidden={!showThree}
                    >
                        {pairs.length > 0 ? (
                            <VennThreeSets
                                data={extraProposition === undefined ? premisePairs : [...premisePairs, extraImplication]}
                                width={threeWidth}
                                height={threeHeight}
                                colors={{ "singles": { [classList[0]]: colorMap.get(classList[0]) ?? "undefined", [classList[1]]: colorMap.get(classList[1]) ?? "undefined", [classList[2]]: colorMap.get(classList[2]) ?? "undefined" } }}
                                {...(combineMode ? { combineMode } : {})}
                                {...(centerDistance ? { centerDistance } : {})}
                                {...(orientation ? { orientation } : {})}
                            />
                        ) : null}
                    </div>
                    <div
                        className={`vp-three-inner-conclusion ${showConclusion ? "is-revealed" : ""}`}
                        style={{
                            display: "flex",
                            width: threeWidth,
                            height: threeHeight,
                            visibility: showConclusion ? "visible" : "hidden"
                        }}
                        aria-hidden={!showThree}
                    >
                        {(pairs.length > 0 && hasConclusion) ? (
                            <VennThreeSets
                                data={pairs}
                                width={threeWidth}
                                height={threeHeight}
                                colors={{ "singles": { [classList[0]]: colorMap.get(classList[0]) ?? "undefined", [classList[1]]: colorMap.get(classList[1]) ?? "undefined", [classList[2]]: colorMap.get(classList[2]) ?? "undefined" } }}
                                {...(combineMode ? { combineMode } : {})}
                                {...(centerDistance ? { centerDistance } : {})}
                                {...(orientation ? { orientation } : {})}
                            />
                        ) : null}
                    </div>
                </div>
                {/* Far right: sketch pad for externalization */}
                <div
                    className="sketchpad"
                    style={{
                        display: "flex",
                        justifyContent: "center"
                    }}
                >
                    <div
                        style={{ border: '1px solid #ccc', borderRadius: 8, padding: 8 }}>
                        <SvgDraw
                            width={400}
                            height={400}
                            stroke="#228be6"
                            strokeWidth={2}
                            background="white"
                            onChangeSvg={handleSvgChange}
                        />
                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                            sketchpad
                        </div>
                    </div>
                </div>
            </div>
            {/* Controls */}
            <div className="vp-controls" style={{ display: "flex", marginBottom: "20px", gap }}>
                Remember to look at the hint!
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

export default VennTask;