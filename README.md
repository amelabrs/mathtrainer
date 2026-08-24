# Mental Math Trainer

A local-first, single-user web app for building mental math speed and technique
across addition, subtraction, multiplication, and division. Prioritizes teaching
*how* to compute fast (compensation, splitting, doubling/halving, etc.) over
raw drilling.

No build step — plain HTML/CSS/JS with ES modules.

## Run it locally

```
cd mathtrainer
python3 -m http.server 8090
```

Then open http://localhost:8090 in a browser (ES modules need `http://`, not `file://`).

## Structure

- `index.html` / `style.css` — shell + styling (light/dark aware)
- `js/problemGenerator.js` — pure problem generators, one per operation/level (unit-tested)
- `js/techniques.js` — technique hint labels + worked-example generators
- `js/adaptive.js` — rolling accuracy/speed → advance/hold/drop level decisions
- `js/mixedReview.js` — weighted picker for Mixed Review mode (favors weak/slow spots)
- `js/storage.js` — localStorage persistence (levels, attempts, session summaries)
- `js/statsView.js` — renders the Stats & history screen
- `js/app.js` — screen state machine, timer, keyboard-first input handling
- `tests/` — `node --test` suite for the generator, adaptive logic, and technique
  worked examples (arithmetic correctness of hint text is checked here — this is
  where a sign-flip bug in the compensation hint was caught)

## Modes

- **Technique practice** — untimed, hint always available on demand.
- **Timed drill** — timed, no upfront hints; wrong/slow answers show the relevant
  technique afterward. This is where adaptive leveling (advance after a strong
  streak, drop back after a slump) runs.
- **Mixed review** — pulls problems from every unlocked level across all four
  operations, weighted toward whatever's currently weak or slow.

## Data

Everything lives in `localStorage` under `mmt_levels_v1`, `mmt_attempts_v1`,
`mmt_sessions_v1` — nothing leaves the browser. Use the "Reset all data" link
on the Stats screen to start over.

## Tests

```
npm test
```
