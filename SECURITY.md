# Security Policy

## Supported versions

Only the latest published version of `dx-server-js` receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/okzgn/dx-server-js/security/advisories/new) instead of opening a public issue. Include the version, the command line used and the steps to reproduce.

## Threat model

* `--dev` is a development server. It exposes endpoints that write to disk (`/dx-lang`) and serves your sources without authentication. By default it binds to `::` (reachable from your local network, a warning is printed): use `--network 127.0.0.1` to restrict it to your machine. Never expose `--dev` to the internet.
* `--prod` serves static files only (plus your optional `dx-server.middleware.js`). Put it behind a reverse proxy with real certificates for public deployments.
* The live-reload token only stops other websites from using the event stream. It is not an authentication.
* By default the port is freed by killing whatever process is using it. Use `--no-kill` on shared machines.
* `dx-server.middleware.js` and `--watch-command` run your own code with your user permissions.
