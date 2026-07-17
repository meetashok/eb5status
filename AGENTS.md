# AGENTS.md

## Cursor Cloud specific instructions

This is a **static, client-side web app** (EB-5 Status Update Draft): plain `index.html`, `styles.css`, and `app.js` served from the repo root. There is **no backend, database, build step, package manager, or dependency install**.

### Run (development)
Serve the repo root over HTTP and open it in a browser:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`. See `README.md` for the same instructions and the field reference.

- Opening `index.html` via `file://` mostly works, but serving over HTTP is preferred because the clipboard copy uses `navigator.clipboard.writeText` (secure-context API); `localhost` counts as a secure context.

### Lint / test / build
- **No configured linter, test suite, or build system exists.** Do not expect `npm`/`pytest`/etc.
- For a quick JS syntax sanity check you can run: `node --check app.js`.
- The app is `app.js` wrapped in an IIFE with no exports, so it must be tested in the browser (fill the form, confirm the live preview updates, click "Copy to clipboard").
