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

## SEE exploration (inside ONE model call)

Eight **optional** Thinking Tool lenses (not modules / not separate API calls):

1. Reality Check · 2. Reframe Lens · 3. Gut Decode · 4. Thought Organizer  
5. Decision Mirror · 6. Root Question · 7. Risk Scan · 8. Next Move  

Use only lenses that fit today. Never name tools in the user-facing answer.  
Prefer a mix of MIRROR + CONNECT + NEW ANGLE when evidence supports it.

## Isolation

Do not import legacy Reasoner / Selector / Judge / Gate / Thinking Core / value lenses / silence cascade.
