# DX Server

**DX Server** is a lightweight development/production server and build tool designed for modern frontend applications. It provides essential developer experience (DX) features out of the box, including live-reload, Single Page Application (SPA) routing, automatic SSL generation, and a unique Build Ingestion system to monitor your build processes directly from the browser.

## Key Features

*   ⚡ **Live-Reload:** Automatic full-page browser refresh on file changes via Server-Sent Events (SSE). (It reloads the page; it is not a module-level HMR.)
*   🍦 **Vanilla / No-Bundler Mode:** Reload on any file edit (HTML, CSS, JS) without requiring a bundler, build step, or touching `index.html`.
*   🧭 **SPA Support:** Smart fallback routing. Serves `index.html` automatically for client-side routes requested by the browser (navigations that accept `text/html`).
*   🛠️ **Build Ingestion:** Pipe your bundler's `stdout` directly to DX Server. It analyzes the logs to detect build states (success, error) and reloads the browser accordingly. The piped output is still printed in your terminal.
*   🔒 **Zero-Config SSL:** Automatic self-signed SSL certificate generation using `mkcert` (valid for `localhost`, `127.0.0.1` and `::1`). A local CA file is generated too, so you can trust it and remove the browser warning.
*   🩹 **Frontend Patches:** Optional injection to wrap `console.error` (for better object inspection) and enforce global `fetch` timeouts (preventing browser freezes during reloads or infinite loops).
*   🌍 **Language Management:** Built-in same-origin endpoint (`/dx-lang`) to update translation JSON files dynamically.
*   🔄 **Watch Commands:** Execute custom CLI commands (like linters, bundlers, compilers) automatically when files change.
*   🚪 **Auto Port-Killing:** Automatically frees up the requested port if it's already in use.
*   🔌 **Custom Middleware Support:** Drop a `dx-server.middleware.js` file into your project root to handle custom HTTP headers, route rules, or API mocking, using Express syntax. Compatible with live-reload.

## Requirements

*   **Node.js:** v22.22.0 or higher.

## Installation

You can install DX Server via NPM: 

```bash
npm install dx-server-js

# or
# as a dev dependency in your project:

npm install -D dx-server-js
```

## Quick Start

Run the server from your project root (defaults to serving the `www` folder on port `80`):

```bash
npx dx-server-js --dev
```

---

## CLI Options & Configuration

Run `npx dx-server-js --help` to print the list of options. Invalid options print the same list and exit with code `1`.

### 🚀 Server Modes
| Flag | Description |
| :--- | :--- |
| `--dev` | **(Default)** Enables live-reload, caching disabled, custom middleware reload, and activates the `/dx-lang` endpoint. |
| `--prod` | Disables live-reload and lang endpoints. Enables gzip compression and static file caching. |
| `--built` | Enables **Build Ingestion** mode to monitor another process's `stdout` piped into DX Server. |
| `--ingest` | Enables *only* ingestion (does not start the HTTP server). Requires `--built`. Useful when combined with `--watch` and `--watch-command`. |
| `--no-bundler` | Enables **Vanilla / No-Bundler mode**. Reloads the browser immediately on any file change (HTML, CSS, JS) and supports multi-page websites. |

### ⚙️ General Settings
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--port <number>` | `80` / `443` | Set the server port (1-65535, otherwise the server exits with code `1`). Defaults to `443` if `--ssl` is enabled, otherwise `80`. An explicit port is always respected (for example `--ssl --port 80`). |
| `--root <path>` | `cwd()` | Set the project root directory. The `www`, `src`, `lang` and `dx-server` folders and `dx-server.middleware.js` are resolved from it. |
| `--public <path>` | `www` | Set the public folder to serve static files from. |
| `--lang <path>` | `lang` | Set the directory for saving translation JSON files. |
| `--network <ip>` | `::` | Bind to a specific network interface (e.g., `127.0.0.1` for this machine only, `0.0.0.0` for local network access). |
| `--cors <origins>` | any origin | Comma-separated list of origins allowed by CORS (e.g. `"http://localhost:3000, https://app.test"`). By default any origin is reflected. The internal `/dx-*` endpoints never send CORS headers. |
| `--silent` | `false` | Suppresses non-critical terminal logs (info/warn) and the passthrough of the piped output in `--built` mode. |
| `--no-kill` | `false` | Disables the automatic port-killing feature. Throws an error if the port is busy. |
| `--no-open` | `false` | Does not open the browser automatically. |
| `--no-csp` | `false` | Does not send the `Content-Security-Policy` header (the policy of `--prod` blocks inline scripts and external CDNs; the one of `--dev` blocks external CDN scripts and `eval`). See [Content-Security-Policy](#7-content-security-policy-and-security-headers). |
| `--cache <ms>` | `86400000` in `--prod`, `0` in `--dev` | Set `maxAge` (in ms) for static files caching (not for `index.html`). In `--dev` it is `0` to prevent stale assets, unless you set it explicitly. |
| `--fallback <path>` | `404.html` | Define a custom HTML fallback file to be served when no route or static file matches the request. It must be inside the public folder. The HTTP status is taken from the file name (see below). |
| `--version` | - | Prints the current DX Server version and exits. |
| `--help` | - | Prints the list of available server modes and options. |

### 🔒 SSL Configuration
| Flag | Description |
| :--- | :--- |
| `--no-ssl` | **(Default)** Runs the server over HTTP. |
| `--ssl` | Enables HTTPS. Automatically generates self-signed certificates using `mkcert` if custom certs are not provided. Generated certificates are renewed automatically when they are about to expire. |
| `--cert <path>` | Path to a custom SSL `.crt` file (Requires `--ssl`). |
| `--key <path>` | Path to a custom SSL `.key` file (Requires `--ssl`). |

Generated files live in `dx-server/self-signed-certificates/`. The certificate is signed by a local CA that is **not** installed in your system. Browsers will show a warning until you trust `ca.crt` (from that same folder) in your OS or browser.

### 👁️ Watcher & Commands
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--watch <path>` | - | Extra directory to observe for live-reload and command execution (a relative path is resolved from the current directory). Required by the other `--watch-*` options and by `--shell`. |
| `--watch-command <cmd>` | - | CLI command to execute when files in the watch folder change. Quoted arguments are supported (`"node build.js --name 'a b'"`). |
| `--watch-command-timeout <ms>`| `5000` | Debounce timeout (in ms) before executing the watch command. |
| `--watch-depth <number>` | `5` | Maximum subdirectory depth the watcher will traverse. |
| `--watch-ignore <string>` | `node_modules, .*`| Comma-separated list of regular expressions (matched against the full path) to ignore. The default ignores `node_modules` folders and dotfiles/dotfolders. |
| `--shell` | `false` | Executes the `--watch-command` in shell mode (pipelines, shell builtins and `.cmd` scripts such as `npm` on Windows). Requires `--watch-command`. |

The watch command is stopped (with all its child processes) and started again on every change. Options that need another option (for example `--watch-command` without `--watch`) print a warning and are ignored.

The watcher only runs in `--dev` and in `--built --ingest`. With `--prod` there is no watcher: `--watch` and `--watch-command` print a warning and are ignored.

### 🏗️ Build Ingestion Options (Requires `--built`)
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--built-confirm-keywords <str>`| - | Comma-separated keywords (case-insensitive, regular expressions allowed) to identify a successful build completion. |
| `--built-error-keywords <str>` | `ERROR, bundle generation failed` | Comma-separated keywords (case-insensitive, regular expressions allowed) to identify build errors. |
| `--ingest-limit <bytes>` | `1048576` (1MB)| Maximum byte limit of `stdout` retained in `dx-server/_built.tmp.stdout`. |

### 🩹 Frontend Patching
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--frontend` | `false` | Injects polyfills and patches `fetch` and `console.error` into the client (`--dev` only). |
| `--frontend-fetch-timeout <ms>`| `30000` | Timeout (in ms) for the injected `fetch` interceptor. Requires `--frontend`. |

---

## Advanced Usage Guide

### 1. Build Ingestion (Piping `stdout`)
DX Server can read the output of your bundler (Webpack, Vite, Esbuild, etc.) to understand the state of your build. If an error is detected, DX Server reports it in the terminal and shows the matched keyword in the browser while the entry point is unavailable.

**Example:**
```bash
# Pipe your bundler's watch mode into DX Server
npm run build:watch | npx dx-server-js --built --built-error-keywords "SyntaxError, Failed to compile"
```
*How it works:*
*   The piped output is printed in your terminal as it arrives (unless `--silent`).
*   Each new piece of output is scanned for the error and confirm keywords (plus a short tail of the previous output, so keywords split between two chunks are found). Old output is never analyzed again.
*   An error keyword sets the state to `error`, and it stays in `error` while the bundler keeps printing. After a quiet period of about 1.5 seconds, the next output is considered a new build cycle. A confirm keyword always sets the state to `built`.
*   Keywords are case-insensitive regular expressions: the default `ERROR` also matches text like "0 errors". Use `--built-confirm-keywords` (for example `"compiled successfully"`) or a stricter pattern such as `"\bERROR\b"` to avoid false positives.

**Ingestion only (no HTTP server)** is useful to run a command when your sources change:
```bash
npm run build:watch | npx dx-server-js --built --ingest --watch ./src --watch-command "npm run lint" --shell
```

### 2. Frontend Mode (`--frontend`)
When enabled (in `--dev`), DX Server injects a lightweight script into your pages that provides:
*   **Fetch Interceptor:** Automatically attaches an `AbortController` to global `fetch` calls. If a request exceeds `--frontend-fetch-timeout`, it is aborted. This prevents the browser from freezing during reloads or development if you accidentally create an infinite fetch loop. Calls that already have their own `signal` (or are made with a `Request` object) keep their own cancellation.
*   **Console Error Wrapper:** Enhances `console.error` to also print a JSON summary of error-like objects. This is highly useful for debugging on mobile devices or environments with limited object inspection capabilities.
*   **Polyfills:** Injects safe fallbacks for `Object.hasOwn` and `Promise.prototype.finally`. When `AbortController` is not available, timeouts are simply not applied.

### 3. Language Management Endpoint
In `--dev` mode, DX Server exposes a `POST /dx-lang` endpoint. This allows your frontend application (e.g., an admin panel or translation UI) to save JSON translation files directly to the disk.

**Frontend Fetch Example:**
```javascript
fetch('/dx-lang', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dir: 'en',          // Target language sub-folder
    code: 'navbar',     // Filename (will become "en/navbar.json")
    keys: {             // The JSON content to save
      "welcome": "Welcome to my app!"
    }
  })
});
```

**Rules and responses:**
*   New folders and files are created when they don't exist. Existing keys can be edited, and new keys can be added, but **no existing key can be removed**: a request with fewer keys than the file already has is rejected, so you don't accidentally delete translations.
*   Status codes: `200` saved, `400` invalid body or keys missing, `403` rejected request, `409` the existing file is not a valid JSON object, `500` write error. Errors are never reported as success.
*   Only `dir` and `code` names are used (no sub-paths): the file is always inside the lang folder. Names must be valid on every OS (no `<>:"/\|?*`, no trailing dot or space, no Windows reserved names such as `con` or `nul`), so the lang folder can be shared between platforms.
*   Writes are serialized (one at a time, a failed request never blocks the next ones) and atomic (temporary file + rename).
*   *Origin protection:* because it writes to disk, the endpoint only accepts same-origin requests (no cross-site `Origin`/`Sec-Fetch-Site`) addressed to `localhost`, an IP address or the machine name (this blocks DNS-rebinding). Call it from the page served by DX Server, using the same host you opened it with. Requests without an `Origin` header (scripts, `curl`) are only accepted from this machine; browsers always send it.
*   *Payload Limit:* the JSON body is limited to 1MB by default (equivalent to roughly 1,000 large key-value pairs).

### 4. SPA Routing Logic
DX Server is optimized for Single Page Applications with an in-memory cache for the entry point. 
When a `GET`/`HEAD` request hits the server, a middleware evaluates it before serving static files:
1. It checks the request path and the `Accept` header. Requests for assets (paths with extensions other than `.html`/`.htm`) and requests that don't explicitly accept `text/html` (for example `fetch` or XHR calls with `Accept: */*`) bypass the interceptor and continue static serving. If the asset is missing, it serves the `--fallback` file (e.g., `404.html`) with its status.
2. If the browser asks for an HTML document (a client-side route navigation), the middleware intercepts it. In `--dev`, existing `.html`/`.htm` files of the public folder are served with the hot-reload script injected; existing files without extension are served as normal static files.
3. Any other route gets `index.html`: it is read, the hot-reload script is injected (`--dev` only), and the result is **cached in memory**. It is served instantly on subsequent requests, and only re-read if its modification time changes.

### 5. Custom Server Middleware (`dx-server.middleware.js`)
DX Server allows you to extend its functionality by placing a `dx-server.middleware.js` file in your project root (or in the `--root` folder) using Express syntax. This is useful for adding custom HTTP response headers, CORS policies, request logging, or mocking API endpoints.

**Example `dx-server.middleware.js`:**
```javascript
module.exports = function customMiddleware(req, res, next) {
  // Add custom headers to specific API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('X-Custom-Header', 'MyValue');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // Always pass control to the next middleware/static handler
  next();
};
```

**Key Features of Custom Middleware:**
*   **Zero Configuration:** DX Server automatically detects and loads `dx-server.middleware.js`. In `--dev` the file is checked on every request (so you can create or remove it while running); in `--prod` it is detected at startup.
*   **Reloadable:** In `--dev` mode, Node's `require.cache` is cleared for this file on every request. You can modify your middleware on the fly without restarting `dx-server`. Other modules that your middleware requires stay cached.
*   **Protected Core:** Internal DX Server endpoints (`/dx-*` such as `/dx-update` or `/dx-client.js`) automatically bypass your custom middleware. This ensures that custom errors or unhandled redirects in user code will never break core features like Live-Reload.
*   **Safe Execution:** User middleware runs inside a `try...catch` boundary, and rejected promises of `async` middleware are handled too. Any exception is logged to the terminal without crashing the server process, and the request continues to the next handler.

### 6. Vanilla Development (`--no-bundler`)
If you are developing a traditional website with plain HTML, CSS, and JavaScript (without Webpack, Vite, or any build tool), use the `--no-bundler` flag.

**Example:**
```bash
npx dx-server-js --dev --no-bundler --port 3000
```

**How it works:**
*   **Universal Live-Reload:** Any change made to `.css`, `.js`, or sub-page `.html` files immediately triggers a browser refresh (unlike bundler mode, which waits for `index.html` modification).
*   **Multi-Page Injection:** DX Server automatically detects and injects the live-reload client script into all requested `.html` and `.htm` files (e.g., `/about.html`, `/contact.html`), not just the root `index.html`.

### 7. Content-Security-Policy and Security Headers
DX Server sends the security headers of [helmet](https://helmetjs.github.io/) in `--dev` and in `--prod`, including a `Content-Security-Policy` (CSP). **The policy is different in each mode**, and both are strict by default:

| Directive | `--prod` | `--dev` |
| :--- | :--- | :--- |
| `script-src` | `'self'` (no inline scripts, no external CDNs, no `eval`) | `'self' 'unsafe-inline'` (inline scripts allowed; external CDNs and `eval` blocked) |
| `style-src` | `'self' https: 'unsafe-inline'` (inline styles and external `https:` stylesheets allowed) | `'self' 'unsafe-inline'` (external stylesheets, such as the Google Fonts CSS, blocked) |
| `img-src` | `'self' data:` | `'self' data: blob:` |
| `font-src` | `'self' https: data:` | `'self' https: data:` |
| `connect-src` | `'self'` (inherited from `default-src`: `fetch`/XHR/WebSocket to another origin are blocked) | `'self' *` (any origin) |
| Other | `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`, `script-src-attr 'none'` (inline event handlers such as `onclick="..."` are blocked) | same |

`upgrade-insecure-requests` is only sent with `--ssl`, and `Strict-Transport-Security` only with `--prod --ssl`.

**Typical symptoms** of the policy (the browser console shows `Refused to ... because it violates the following Content Security Policy directive`):
*   A `<script src="https://cdn...">` or an inline `<script>` that does not load/run in `--prod`.
*   A bundle that fails in `--dev` because the bundler emits `eval` (for example Webpack with `devtool: 'eval'`): use another `devtool` (such as `source-map`) or `--no-csp`.
*   Calls from your frontend to an API on another origin (for example `http://localhost:4000`) that fail in `--prod`.
*   Images from other hosts, or `blob:` images in `--prod`, that are not shown.

**How to fix it:** adjust your application (move inline scripts to files served by the public folder) or use `--no-csp`, which removes only the `Content-Security-Policy` header. If you prefer a custom policy, `--no-csp` plus a `Content-Security-Policy` header set in `dx-server.middleware.js` works too.

The other helmet headers are always sent, also with `--no-csp`: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Origin-Agent-Cluster`. Note that `Cross-Origin-Resource-Policy: same-origin` prevents other origins from embedding your files with `<img>` or `<script>` (`fetch` with CORS is controlled by `--cors`). Your `dx-server.middleware.js` can override any of them with `res.setHeader`.

### 💡 Pro Tip: Smart HTTP Status Detection
DX Server includes an intelligent feature for custom fallbacks: **it automatically detects the HTTP status code from your filename.**

If you name your fallback file with a valid HTTP status code (e.g., `404.html`, `403.html`, or `500.html`) and pass it with `--fallback`, the server will parse that number and use it as the HTTP response status. This allows you to serve semantic error pages automatically without any extra configuration.
*   `404.html` → Server responds with `404 Not Found`.
*   `403.html` → Server responds with `403 Forbidden`.
*   `200.html` → Server responds with `200 OK` (useful for specific SPA configurations).

```bash
npx dx-server-js --prod --fallback 403.html
```

---

## Internal Architecture & Files

When running, DX Server creates a `dx-server` folder in your project root to manage its internal state:
*   `dx-server/self-signed-certificates/`: Stores the `cert.crt` and `cert.key` generated by `mkcert`, and the local CA (`ca.crt`) that signed them.
*   `dx-server/_built.tmp`: Tracks the current build state (`compilation`, `built`, `error`).
*   `dx-server/_built.tmp.stdout`: The latest retained output of the ingested process.
*   `dx-server/_error.tmp`: Stores the latest build error keyword to show in the browser.
*   `dx-server/_browserOpen.tmp`: Prevents opening multiple browser tabs on rapid restarts.
*   `dx-server.middleware.js`: Optional custom middleware in your project root.

These files are never served, even if the public folder contains them (for example `--public .`).

*Note: It is recommended to add `dx-server/` to your `.gitignore`.*

---

## ⚠️ Important Considerations

1. **Network Binding (`--network`):** By default, DX Server binds to `::` (IPv6 Unspecified), which usually covers both IPv4 and IPv6 on modern OS and makes the server reachable from your local network (a warning is printed in `--dev`). Use `--network 127.0.0.1` to restrict it to your machine. If you encounter network availability errors (`EADDRNOTAVAIL`), explicitly set it to IPv4 using `--network 0.0.0.0`.
2. **Root Directory:** DX Server automatically uses your terminal's current directory (`process.cwd()`) as the root. If you need to run it from a different folder, use the `--root ./path/to/project` argument to ensure the `www`, `src`, `lang` and `dx-server` folders and the custom middleware are resolved correctly.
3. **Ports 80 / 443:** Binding to standard web ports on Linux usually requires `sudo` privileges (and macOS on older versions). If you don't want to run as root, use a higher port (e.g., `--port 8080`).
4. **Port Killing:** By default, DX Server aggressively frees up the requested port. If you have a Docker container or a database unexpectedly running on port 80, DX Server will kill it. Use `--no-kill` if you want traditional safe behavior.
5. **Security:** CORS restrictions are disabled by default for your files (any origin is reflected; use `--cors` to restrict them), but never for the internal `/dx-*` endpoints. The `--dev` mode exposes endpoints that allow disk writes (`/dx-lang`, protected against cross-origin requests but not authenticated). The live-reload token only prevents other sites from using the event stream: it is not an authentication. **Never** use `--dev` in a publicly exposed network or a production environment. Always use `--prod` for deployments. See [SECURITY.md](SECURITY.md).
6. **Content-Security-Policy:** both `--prod` (default [helmet](https://helmetjs.github.io/) policy: blocks inline scripts and external scripts, API calls and images) and `--dev` (allows inline scripts, blocks external CDN scripts and `eval`) send a policy. Use `--no-csp` if your application needs more freedom. Without `--ssl`, `upgrade-insecure-requests` is removed from the policy (it would break a server that only listens on HTTP), and `Strict-Transport-Security` is only sent with `--prod --ssl` (in `--dev` it would force `localhost` to HTTPS on every port of your browser). Details: [Content-Security-Policy and Security Headers](#7-content-security-policy-and-security-headers).
7. **Errors:** request errors (invalid JSON bodies, failing custom middleware) are logged in the terminal and answered with their status code only, never with stack traces.
8. **Watch commands on Windows:** without `--shell`, the command is started directly, so scripts such as `npm` (`npm.cmd`) can't be launched. Use `--shell` for them.

---

## Development

```bash
npm install
npm run lint
npm test
```

The test suite (`test/`) uses the built-in Node.js test runner and starts real DX Server processes on free ports. Lint and tests run on every push and pull request (Linux, Windows and macOS, Node.js 22.22 and 24), and before publishing (`prepublishOnly`).

---

## License

MIT License.

Copyright © 2026 [OKZGN](https://okzgn.com)
