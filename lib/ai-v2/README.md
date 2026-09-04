# AI Engine V2

Clean rebuild of ING reflection AI (03–06), built **beside** the legacy engine.

## Status

- **V2.1 SEE** — Internal-only (`engine: "v2"` + Internal membership)
- 04 / 05 / 06 — not started

## Design contract (do not implement beyond SEE yet)

- FACT → may state directly
- POSSIBILITY → surface with calibrated language (not DROP)
- USER_CONFIRMED → trusted downstream (later stages)
- UNSUPPORTED → do not present

## Isolation

Do not import legacy Reasoner / Selector / Judge / Gate / Thinking Core / value lenses / silence cascade.
