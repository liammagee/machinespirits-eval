# Cast-layer reader-quality fixture

`matrix.json` is a compact, hand-authored test fixture for
`evaluate-cast-layer-reader-quality.js`. It is not a research artifact and must
not be cited as evidence for cast-layer quality.

The fixture holds one seven-turn public transcript and proof trajectory fixed
across three conditions:

- `S0`: no cast state;
- `S1`: static cast state;
- `S2`: the same cast state with one bounded reinvention at turn 7.

The test materializes the production three-file matrix layout in a temporary
directory, runs the real scorer, and deletes the directory afterward. This
keeps production defaults and historical ignored exports unchanged while
making the scorer contract executable in a clean checkout.
