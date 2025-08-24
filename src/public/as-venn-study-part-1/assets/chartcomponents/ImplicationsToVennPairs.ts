export type Implication = {
    argument: string;
    antecedent: string;
    consequent: string;
    text: string;
};

export type VennPairData = Record<string, boolean>;

export function implicationsToVennPairs(inputs: Implication[]): VennPairData[] {
    return inputs.map((imp) => {
        const A = parseLiteral(imp.antecedent);
        const B = parseLiteral(imp.consequent);

        // Region colors per your 4 cases:
        // 1) A -> B          => { A: false, "A,B": true,  B: true }
        // 2) not A -> B      => { A: true,  "A,B": false, B: true }
        // 3) A -> not B      => { A: true,  "A,B": false, B: true }
        // 4) not A -> not B  => { A: true,  "A,B": true,  B: false }
        //
        // Compact formulas that match the above:
        // onlyLeft  = aNeg OR bNeg
        // both      = aNeg === bNeg      (XNOR)
        // onlyRight = NOT (aNeg AND bNeg)
        const onlyLeft = A.negated || B.negated;
        const both = A.negated === B.negated;
        const onlyRight = !(A.negated && B.negated);

        const leftName = A.name;
        const rightName = B.name;

        return {
            [leftName]: onlyLeft,
            [`${leftName},${rightName}`]: both,
            [rightName]: onlyRight
        };

    });
}

export function parseLiteral(lit: string): { name: string; negated: boolean } {
    const t = lit.trim();
    // Accept "not X", "!X", "¬X" (case-insensitive for "not")
    const m = t.match(/^(?:not\s+|!\s*|¬\s*)(.+)$/i);
    if (m) {
        return { name: m[1].trim(), negated: true };
    }
    return { name: t, negated: false };
}