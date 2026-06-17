# Externalizing Set-Membership Reasoning: A Controlled Study of Sketch-Based Cues

This repository contains the implementation of a two-session, between-subjects user study investigating how sketch-based visual cues support set-membership reasoning. The study is published in the Proceedings of EuroVis 2026 — A. Schlieder, J. Rummel & F. Sadlo. [Visual Cues for Logical Reasoning about Text Enhance Metacognitive Sensitivity](https://diglib.eg.org/items/f14e8d51-a5ff-453d-9677-1ac4e44d8e05). The study is implemented using the [reVISit](https://revisit.dev) framework. Stimuli are defined as React components under `src/public/<condition>/assets/` and wired into the reVISit study configuration.

## Study Overview

Participants were assigned to one of three between-subjects conditions:

- **Baseline** (`as-baseline-study-part-1`) — no visual cues; participants reason from text alone.
- **Euler-type cues** (`as-euler-study-part-1`) — progressive Euler diagram cues revealed on demand.
- **Venn-type cues** (`as-venn-study-part-1`) — progressive Venn diagram cues revealed on demand.

The study ran across two sessions. An additional interview condition (`as-interview-study`) was used for a qualitative pilot study with different domain experts.



## Running Locally

You need Node.js installed.

```bash
yarn install     # install dependencies (run npm i -g yarn first if yarn is missing)
yarn serve       # start local dev server
```

Then open [http://localhost:8080](http://localhost:8080). The page reloads on changes.

## Repository Structure

```
src/public/
  as-baseline-study-part-1/   # baseline condition
  as-euler-study-part-1/      # Euler-type cue condition
  as-venn-study-part-1/       # Venn-type cue condition
  as-interview-study/         # qualitative interview condition
```

Each condition folder contains:
- `assets/` — React stimulus components (`EulerTask.tsx`, `VennTask.tsx`, `BaselineTask.tsx`, chart components)

The respective reVISit study config JSON defining the trial sequence, consent, and training can be found under `public/as-<condition-name>` 
