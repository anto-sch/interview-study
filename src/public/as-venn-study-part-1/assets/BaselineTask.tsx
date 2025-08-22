import React, { useMemo, useRef, useState } from "react";

function BaselineTask({ parameters }: { parameters: any }) {

    // Sizing (you can override via parameters)
    const gap: number = parameters?.gap ?? 16;

    const textMaxWidth: number | undefined = parameters?.textMaxWidth ?? 500;

    return (

        <div className="vp-dynamic-container" style={{ display: "grid", marginBottom: "20px", gap }}>
            {/* Grid with one column: [text] */}
            <div
                className="vp-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "0.85fr",
                    alignItems: "center",
                    gap,
                    width: "43%"
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
            </div >
        </div >
    );
}

export default BaselineTask;