# Changelog

## Unreleased

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

### Added
- `--no-open` (do not open the browser) and `--no-csp` (disable `Content-Security-Policy`).
- `/dx-lang` only accepts same-origin requests addressed to a trusted host name.
- Warnings for options that are ignored because the option they depend on is missing, and for `--dev` reachable from the network.
- Formatted `--help` with every option.
- Tests (`npm test`), `files` in `package.json`, `CHANGELOG.md`.

### Changed
- The version is read from `package.json` (it was duplicated in the code).
- `--prod` no longer injects the (empty) client script.
- `--version` prints only the version.
- The documentation (`README.md`) now describes what each option really does.
