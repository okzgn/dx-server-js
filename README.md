# DX Server

**DX Server** is a high-performance, lightweight development/production server and build tool designed for modern frontend applications. It provides essential developer experience (DX) features out of the box, including hot-reloading, Single Page Application (SPA) routing, automatic SSL generation, and a unique Build Ingestion system to monitor your build processes directly from the browser.

## Key Features

*   ⚡ **Hot-Reloading:** Automatic browser refresh on file changes via Server-Sent Events (SSE).
*   🧭 **SPA Support:** Smart fallback routing. Serves `index.html` automatically for client-side non static asset routes.
*   🛠️ **Build Ingestion:** Pipe your bundler's `stdout` directly to DX Server. It analyzes the logs to show real-time build states (compiling, success, error) in the browser.
*   🔒 **Zero-Config SSL:** Automatic self-signed SSL certificate generation using `mkcert`.
*   🩹 **Frontend Patches:** Optional injection to wrap `console.error` (for better object inspection) and enforce global `fetch` timeouts (preventing browser freezes during reloads or infinite loops).
*   🌍 **Language Management:** Built-in secure endpoint (`/dx-lang`) to update translation JSON files dynamically.
*   🔄 **Watch Commands:** Execute custom CLI commands (like linters, bundlers, compilers) automatically when files change.
*   🚪 **Auto Port-Killing:** Automatically frees up the requested port if it's already in use.

## Requirements

*   **Node.js:** v20.19.0 or higher.

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

### 🚀 Server Modes
| Flag | Description |
| :--- | :--- |
| `--dev` | **(Default)** Enables hot-reload, caching disabled, and activates the `/dx-lang` endpoint. |
| `--prod` | Disables hot-reload and lang endpoints. Enables gzip compression and static file caching. |
| `--built` | Enables **Build Ingestion** mode to monitor another process's `stdout` piped into DX Server. |
| `--ingest` | Enables *only* ingestion (does not start the HTTP server). Useful when combined with `--watch-command`. |

### ⚙️ General Settings
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--port <number>` | `80` / `443` | Set the server port. Defaults to `443` if `--ssl` is enabled, otherwise `80`. |
| `--root <path>` | `cwd()` | Set the project root directory. |
| `--public <path>` | `www` | Set the public folder to serve static files from. |
| `--lang <path>` | `lang` | Set the directory for saving translation JSON files. |
| `--network <ip>` | `::` | Bind to a specific network interface (e.g., `0.0.0.0` for local network access). |
| `--silent` | `false` | Suppresses non-critical terminal logs (info/warn). |
| `--no-kill` | `false` | Disables the automatic port-killing feature. Throws an error if the port is busy. |
| `--cache <ms>` | `86400000` | Set `maxAge` (in ms) for static files caching. **Note:** This is automatically forced to `0` in `--dev` mode to prevent stale assets. |
| `--fallback <path>` | `404.html` | Define a custom HTML fallback file to be served (with a 404 status) when a static asset is not found. By default it is served from the public folder. |
| `--version` | - | Prints the current DX Server version and exits. |
| `--help` | - | Prints the list of available server modes and options. |

### 🔒 SSL Configuration
| Flag | Description |
| :--- | :--- |
| `--no-ssl` | **(Default)** Runs the server over HTTP. |
| `--ssl` | Enables HTTPS. Automatically generates self-signed certificates using `mkcert` if custom certs are not provided. |
| `--cert <path>` | Path to a custom SSL `.crt` file (Requires `--ssl`). |
| `--key <path>` | Path to a custom SSL `.key` file (Requires `--ssl`). |

### 👁️ Watcher & Commands
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--watch <path>` | `src` | Directory to observe for hot-reloading and command execution. |
| `--watch-command <cmd>` | - | CLI command to execute when files in the watch folder change. |
| `--watch-command-timeout <ms>`| `5000` | Debounce timeout (in ms) before executing the watch command. |
| `--watch-depth <number>` | `5` | Maximum subdirectory depth the watcher will traverse. |
| `--watch-ignore <string>` | `node_modules, .*`| Comma-separated list of files/folders/regex to ignore. |
| `--shell` | `false` | Executes the `--watch-command` in shell mode. |

### 🏗️ Build Ingestion Options (Requires `--built`)
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--built-confirm-keywords <str>`| - | Comma-separated keywords to identify a successful build completion. |
| `--built-error-keywords <str>` | `ERROR, bundle generation failed` | Comma-separated keywords to identify build errors. |
| `--ingest-limit <bytes>` | `1048576` (1MB)| Maximum byte limit of `stdout` chunks retained for analysis. |

### 🩹 Frontend Patching
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--frontend` | `false` | Injects polyfills and patches `fetch` and `console.error` into the client. |
| `--frontend-fetch-timeout <ms>`| `30000` | Timeout (in ms) for the injected `fetch` interceptor. |

---

## Advanced Usage Guide

### 1. Build Ingestion (Piping `stdout`)
DX Server can read the output of your bundler (Webpack, Vite, Esbuild, etc.) to understand the state of your build. If an error occurs during compilation, DX Server will catch it via regex/keywords and display an error overlay directly in your browser.

**Example:**
```bash
# Pipe your bundler's watch mode into DX Server
npm run build:watch | npx dx-server-js --built --built-error-keywords "SyntaxError, Failed to compile"
```
*How it works:* The server buffers the `stdin` up to the `--ingest-limit`. It scans for error keywords. If found, it updates the internal state to `error` and notifies the connected browsers via SSE.

### 2. Frontend Mode (`--frontend`)
When enabled, DX Server injects a lightweight script into your `index.html` that provides:
*   **Fetch Interceptor:** Automatically attaches an `AbortController` to all global `fetch` requests. If a request exceeds `--frontend-fetch-timeout`, it is aborted. This prevents the browser from freezing during browser reloads or development if you accidentally create an infinite fetch loop.
*   **Console Error Wrapper:** Enhances `console.error` to stringify complex objects. This is highly useful for debugging on mobile devices or environments with limited object inspection capabilities.
*   **Polyfills:** Injects safe fallbacks for `Object.hasOwn`, `Promise.prototype.finally`, and `AbortController`.

### 3. Language Management Endpoint
In `--dev` mode, DX Server exposes a `POST /dx-lang` endpoint. This allows your frontend application (e.g., an admin panel or translation UI) to save JSON translation files directly to the disk.

**Security Mechanism:**
To prevent accidental data loss, the server compares the incoming JSON with the existing file. It will **reject (400 Bad Request)** the update if the new JSON contains fewer keys than the original file, ensuring you don't accidentally overwrite and delete translations.

**Frontend Fetch Example:**
```javascript
fetch('http://localhost/dx-lang', {
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
*Additional Note:* This endpoint features strict Path-Traversal protection. It also implements an asynchronous Mutex lock to prevent Race Conditions if multiple keys are saved simultaneously, guaranteeing zero data corruption.

*Payload Limit:* To prevent memory abuse, the JSON body payload is strictly limited to 1MB by default (equivalent to roughly 1,000 large key-value pairs).

### 4. SPA Routing Logic
DX Server is optimized for Single Page Applications with a highly performant in-memory cache system. 
When a request hits the server, a custom middleware evaluates it before serving static files:
1. It checks the request path and the `Accept` header.
2. If the request is looking for an asset (`image/*`, `css`, `js`, `json`), it bypasses the interceptor and continues to `express.static`. If the asset is missing, it serves the `--fallback` file (e.g., `404.html`) with a `404 Not Found` status.
3. If the request accepts `html` (a client-side route navigation), it intercepts the request.
4. It reads `index.html`, injects the hot-reload script, and **caches the result in memory**. It will serve this cached version instantly on subsequent requests, only re-reading the file if its modification time changes.

### 💡 Pro Tip: Smart HTTP Status Detection
DX Server includes an intelligent feature for custom fallbacks: **it automatically detects the HTTP status code from your filename.**

If you name your fallback file with a valid HTTP status code (e.g., `404.html`, `403.html`, or `500.html`), the server will parse that number and use it as the HTTP response status. This allows you to serve semantic error pages automatically without any extra configuration.
*   `404.html` → Server responds with `404 Not Found`.
*   `403.html` → Server responds with `403 Forbidden`.
*   `200.html` → Server responds with `200 OK` (useful for specific SPA configurations).

---

## Internal Architecture & Files

When running, DX Server creates a `dx-server` folder in your project root to manage its internal state:
*   `dx-server/self-signed-certificates/`: Stores the `cert.crt` and `cert.key` generated by `mkcert`.
*   `dx-server/_built.tmp`: Tracks the current build state (`compilation`, `built`, `error`).
*   `dx-server/_error.tmp`: Stores the latest build error message to serve to the browser.
*   `dx-server/_browserOpen.tmp`: Prevents opening multiple browser tabs on rapid restarts.

*Note: It is recommended to add `dx-server/` to your `.gitignore`.*

---

## ⚠️ Important Considerations

1. **Network Binding (`--network`):** By default, DX Server binds to `::` (IPv6 Unspecified), which usually covers both IPv4 and IPv6 on modern OS. If you encounter network availability errors (`EADDRNOTAVAIL`), explicitly set it to IPv4 using `--network 0.0.0.0`.
2. **Root Directory:** DX Server automatically uses your terminal's current directory (`process.cwd()`) as the root. If you need to run it from a different folder, use the `--root ./path/to/project` argument to ensure the `www`, `src`, and `lang` folders are resolved correctly.
3. **Ports 80 / 443:** Binding to standard web ports on macOS and Linux usually requires `sudo` privileges. If you don't want to run as root, use a higher port (e.g., `--port 8080`).
4. **Port Killing:** By default, DX Server aggressively frees up the requested port. If you have a Docker container or a database unexpectedly running on port 80, DX Server will kill it. Use `--no-kill` if you want traditional safe behavior.
5. **Security:** CORS restrictions are disabled by default. The `--dev` mode exposes endpoints that allow disk writes (`/dx-lang`). **Never** use `--dev` in a publicly exposed network or a production environment. Always use `--prod` for deployments.
 
---

## License

MIT License.

Copyright © 2026 [OKZGN](https://okzgn.com)