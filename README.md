# VRF-BFT Consensus Simulator Dashboard

[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)](https://vrf-simulator.vercel.app)

This dashboard visualizes and validates Verifiable Random Function (VRF) facilitated leader election and dynamic trust scoring in peer-to-peer Decentralized Machine Learning environments. It provides experimental proof that this architecture significantly reduces the probability of malicious nodes being selected for the validator committee compared to standard random baselines.

You can find the WASM Rust Engine that runs its logic here-\
NPM- https://www.npmjs.com/package/vrf-bft-simulator

GitHub- https://github.com/ayushsaksena30/vrf-bft-simulator-rust

## Overview
This dashboard consumes data from a custom WASM Rust engine running entirely client-side. It features:
- **Real-Time Analytics:** Live tracking of threat reduction, explicitly comparing the expected random baseline against the VRF architecture's actual malicious selection rate.
- **Interactive Network Topology:** A force-directed D3 physics graph visualizing the peer-to-peer environment, validator committee selection, and the slashing of malicious nodes.
- **Time-Series Simulation Playback:** A timeline scrubber enabling step-by-step observation of network evolution and dynamic trust score adjustments over time.
- **Data Export Pipeline:** One-click JSON exports of raw simulation snapshots and probability matrices to support academic review and data analysis.

## Tech Stack
- **Framework:** Next.js (App Router)
- **UI/Styling:** Tailwind CSS, shadcn/ui, Tremor
- **Visualization:** react-force-graph-2d
- **Engine Integration:** WebAssembly (WASM) via custom Rust package

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
