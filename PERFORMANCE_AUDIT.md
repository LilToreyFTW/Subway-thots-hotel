# Runtime performance audit

Fresh production build audit on 2026-08-12:

- Vite build: passed.
- Client JavaScript: 833,449 bytes raw / 232,208 bytes gzip.
- Client CSS: 33,497 bytes raw / 7,961 bytes gzip.
- Browser smoke: Microsoft Edge headless rendered the title screen at 1440×900 with the story selector, start action, local-world status, and responsive visual shell present.
- Automated coverage: 40 JavaScript tests, 19 Python host tests, and 3 desktop updater tests passed.

The renderer keeps quality tiers and bounded world generation controls; the remaining optimization opportunity is code-splitting the main Three.js bundle if download size becomes a production concern.
