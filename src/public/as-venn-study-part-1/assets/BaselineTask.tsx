import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initializeTrrack, Registry } from '@trrack/core';
import { optimize } from 'svgo';
import { StimulusParams } from '../../../store/types';
import { SvgDraw } from './SVGdraw';
import './chartcomponents/UIstyles.css';

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

function BaselineTask({ parameters, setAnswer }: StimulusParams<any>) {

    // Sizing (you can override via parameters)
    const gap: number = parameters?.gap ?? 16;

    const textMaxWidth: number | undefined = parameters?.textMaxWidth ?? 500;

    const [svg, setSvg] = React.useState<string>('');

    const { actions, trrack } = useMemo(() => {
        const reg = Registry.create();

        const clickAction = reg.register('draw', (state, currentSketch: any) => {
            state.sketch = currentSketch;
            return state;
        });

        const trrackInst = initializeTrrack({
            registry: reg,
            initialState: { sketch: [], hint: 0 },
        });

        return {
            actions: {
                clickAction
            },
            trrack: trrackInst,
        };
    }, []);

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

        <div className="vp-dynamic-container" style={{ display: "grid", marginBottom: "20px", gap }}>
            {/* Grid with one column: [text] */}
            <div
                className="vp-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "0.85fr auto",
                    alignItems: "center",
                    gap,
                    width: "60%"
                }}
            >
                {/* Left column: sentences as one flowing block, no manual line breaks */}
                <div
                    className="vp-text-block"
                    style={{
                        maxWidth: textMaxWidth,
                        whiteSpace: "normal",
                        lineHeight: 2
                    }}
                >

                    <span
                        style={{ display: "inline" }}
                    >
                        {parameters.text}
                    </span>
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
            </div >
        </div >
    );
}

export default BaselineTask;