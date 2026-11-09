# Changelog

## 2.3.6

### Added
- GitHub Actions (`.github/workflows/ci.yml`): lint and tests on every push and pull request (Linux, Windows and macOS; Node.js 22.22 and 24).
- Warning when `--watch` or `--watch-command` is used with `--prod`: the watcher only runs in `--dev` and in `--built --ingest`, so they were silently ignored.

### Changed
- The documentation (`README.md`) describes the `Content-Security-Policy` and the other security headers sent in `--dev` and in `--prod`, and that the watcher does not run in `--prod`.
- Corrected the documentation of the requirements: Node.js 22.22.0 or higher (no mention of 20.19), and the CI matrix.
- `globals` (development dependency) updated to 17.14.0.

## 2.3.5

### Requirements
- Node.js **22.22.0** or higher is required (it was 20.19.0, which reached its end of life in April 2026), because of `chalk` 6 and `chokidar` 6. Options and behaviour are unchanged.

### Fixed
- `--prod`: gzip compression was never applied (the middleware was registered after the handlers that end the response).
- `--fallback`: the HTTP status taken from the file name (`403.html`, `200.html`...) never worked.
- `/dx-lang`: new files and folders can be created; a failed request no longer blocks all later ones; real HTTP status codes are returned (they were always `200`); existing keys can be edited (only removing keys is rejected); writes are atomic.
- Invalid arguments exit with code `1` (they exited with `0`); invalid ports are rejected.
- `--root`: state files (`dx-server/_*.tmp`) and `dx-server.middleware.js` are now resolved from the root folder.
- Path checks used a plain `startsWith`, so sibling folders like `www-secret` could be read when the public folder was `www`.
- Existing files without extension were served as `text/html`; `fetch`/XHR calls (`Accept: */*`) received `index.html`; non-GET requests were answered with the entry point.
- `--frontend`: the fetch timeout never aborted anything (unbound `abort`), the derived `finally` promise produced extra `unhandledrejection` events, abort controllers were never released, `console.error()` threw with no or `null` arguments, and `Request` objects lost their own signal.
- Build ingestion: old errors stuck forever in the retained buffer, keywords were detected again on every chunk, `stdout` was swallowed, a 1 MB file was rewritten per chunk and concurrent writes could interleave. Invalid regular expressions in keywords no longer throw.
- `--ingest` with `--watch-command` never started the watcher.
- Watch command: quoted arguments, `spawn` errors no longer crash the server (hint to use `--shell`), the whole process tree is stopped.
- Heartbeat now reaches every open tab; SSL: CA validity option was misspelled, certificates cover `127.0.0.1` and `::1`, expired certificates are regenerated, `Cert path`/`Key path` labels were swapped, the CA is saved as `ca.crt`, and the certificate no longer carries a fixed personal organization.
- `--watch-ignore` defaults now really ignore dotfiles (the regular expression only matched relative paths).
- `EACCES` on the port exits with an explanation instead of leaving a server that is not listening.
- Custom middleware: created/removed in `--dev` without restarting, `async` rejections handled, `next()` is never called twice.
- Build error text and paths are HTML-escaped in the connecting page.
- Security: a client could pollute `Object.prototype` through the `dx-ip` parameter of `/dx-update` and `/dx-start-update` (for example with `__proto__`). The client maps have no prototype now and the token is compared in constant time.
- Security: the internal `/dx-*` endpoints were readable by any website through the reflected CORS headers (including the live-reload token).
- Security: request errors (for example an invalid JSON body) were answered with the stack trace and the paths of the server.
- `Strict-Transport-Security` was sent in `--dev` and over HTTP (it can force `localhost` to HTTPS on every port of the browser), and `upgrade-insecure-requests` broke `--prod` served over HTTP on a LAN address. Now HSTS is only sent with `--prod --ssl`, and `upgrade-insecure-requests` only with `--ssl`.
- An explicit `--port 80` with `--ssl` (or `--port 443` without it) was silently changed to the other port.
- With a public folder that contains the project root (`--public .`), the `dx-server/` folder (including the certificate key) and `dx-server.middleware.js` were served.
- Static assets were answered with `503` when more than 1000 client IPs were registered: only HTML navigations are counted and limited now.
- `/dx-lang`: names that are not valid on every OS (`<>:"|?*`, trailing dot or space, `con`, `nul`...) are rejected, the temporary file is removed when a write fails, and requests without `Origin` (non-browser clients) are only accepted from this machine.
- The `Server mode` log shows the real mode (`--dev`/`--prod`) also with `--built`.

### Added
- `--cors <origins>` to restrict the origins allowed by CORS (by default any origin is still reflected).
- Tests (`npm test`) for live-reload, `--no-bundler`, `--ssl`, `--cors` and the security fixes; ESLint (`npm run lint`); `prepublishOnly` runs lint and tests; `SECURITY.md`; `files` in `package.json`; `CHANGELOG.md`.
- `--no-open` (do not open the browser) and `--no-csp` (disable `Content-Security-Policy`).
- `/dx-lang` only accepts same-origin requests addressed to a trusted host name.
- Warnings for options that are ignored because the option they depend on is missing and for `--dev` reachable from the network.
- Formatted `--help` with every option.

### Changed
- The version is read from `package.json` (it was duplicated in the code).
- `--prod` no longer injects the (empty) client script.
- `--version` prints only the version.
- The documentation (`README.md`) now describes what each option really does.
- `express` 5.3, `helmet` 8.3, `chalk` 6 and `chokidar` 6.
- Code style unified (ESLint), unused code removed, and the connecting-messages logic simplified (same messages and timing).
- `CHANGELOG.md` is included in the published package.
