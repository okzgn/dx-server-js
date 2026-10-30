'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'bin', 'index.js');
const version = require('../package.json').version;
const baseArgs = ['--no-kill', '--no-open', '--network', '127.0.0.1'];

const sleep = function(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); };

async function waitFor(check, timeout, step){
    const limit = Date.now() + (timeout || 8000);
    while(Date.now() < limit){
        const result = await check();
        if(result){ return result; }
        await sleep(step || 50);
    }
    return false;
}

function freePort(){
    return new Promise(function(resolve, reject){
        const probe = net.createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', function(){
            const { port } = probe.address();
            probe.close(function(){ resolve(port); });
        });
    });
}

function makeProject(){
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dx-server-test-'));
    fs.mkdirSync(path.join(root, 'www'));
    fs.mkdirSync(path.join(root, 'www-secret'));
    fs.mkdirSync(path.join(root, 'lang', 'en'), { recursive: true });
    fs.writeFileSync(path.join(root, 'www', 'index.html'), '<!DOCTYPE html><html><body>home</body></html>');
    fs.writeFileSync(path.join(root, 'www', '403.html'), '<html><body>forbidden</body></html>');
    fs.writeFileSync(path.join(root, 'www', 'big.txt'), 'lorem ipsum dolor sit amet '.repeat(2000));
    fs.writeFileSync(path.join(root, 'www', 'data'), 'plain extensionless file');
    fs.writeFileSync(path.join(root, 'www-secret', 'a.html'), '<html><body>SECRET</body></html>');
    fs.writeFileSync(path.join(root, 'lang', 'en', 'nav.json'), JSON.stringify({ a: '1' }));
    return root;
}

function startServer(root, args){
    return new Promise(function(resolve, reject){
        freePort().then(function(port){
            const child = spawn(process.execPath, [bin, '--port', String(port)].concat(baseArgs, args || []), { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
            let output = '';
            const onData = function(data){
                output += data;
                if(output.includes('LISTENING')){ resolve({ child, port, output: function(){ return output; } }); }
            };
            child.stdout.on('data', onData);
            child.stderr.on('data', onData);
            child.once('exit', function(code){ reject(new Error('Server exited (' + code + '):\n' + output)); });
            setTimeout(function(){ reject(new Error('Server start timeout:\n' + output)); }, 15000);
        }, reject);
    });
}

function stopServer(server){
    return new Promise(function(resolve){
        if(!server || !server.child || server.child.exitCode !== null){ return resolve(); }
        server.child.removeAllListeners('exit');
        server.child.once('exit', function(){ resolve(); });
        server.child.kill();
        setTimeout(resolve, 3000);
    });
}

function removeDir(dir){
    // On Windows a folder cannot be removed while a just stopped process still holds it as its working directory.
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch(e){ /* temporary files: the OS cleans them up */ }
}

function request(port, options){
    return new Promise(function(resolve, reject){
        const req = http.request({ host: '127.0.0.1', port, method: options.method || 'GET', path: options.path, headers: options.headers || {} }, function(res){
            const chunks = [];
            res.on('data', function(chunk){ chunks.push(chunk); });
            res.on('end', function(){ resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }); });
        });
        req.on('error', reject);
        if(options.body){ req.write(options.body); }
        req.end();
    });
}

const browser = { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

// Opens the live-reload event stream like the injected client does, and collects the received messages.
async function openLiveReload(port, ip){
    await request(port, { path: '/', headers: browser }); // A navigation registers the client IP.
    const script = (await request(port, { path: '/dx-client.js' })).body;
    const token = /dxToken = '([^']+)'/.exec(script)[1];
    const dxIP = ip ? Buffer.from(ip).toString('base64') : /dxIP = '([^']*)'/.exec(script)[1];
    const stream = { messages: [], status: 0 };
    return new Promise(function(resolve){
        stream.request = http.get({ host: '127.0.0.1', port, path: '/dx-update?dx-token=' + encodeURIComponent(token) + '&dx-ip=' + encodeURIComponent(dxIP) }, function(res){
            stream.status = res.statusCode;
            res.setEncoding('utf8');
            let pending = '';
            res.on('data', function(chunk){
                pending += chunk;
                const events = pending.split('\n\n');
                pending = events.pop();
                for(const event of events){ stream.messages.push(event.replace(/^data: /, '')); }
            });
            res.on('error', function(){});
            resolve(stream);
        });
        stream.request.on('error', function(){});
    });
}

function run(root, args){
    return spawnSync(process.execPath, [bin].concat(args), { cwd: root, encoding: 'utf8', timeout: 15000 });
}

describe('command line', function(){
    let root;
    before(function(){ root = makeProject(); });
    after(function(){ removeDir(root); });

    it('--version prints only the package version', function(){
        const result = run(root, ['--version']);
        assert.equal(result.status, 0);
        assert.equal(result.stdout.trim(), version);
    });

    it('--help lists the options and exits with 0', function(){
        const result = run(root, ['--help']);
        assert.equal(result.status, 0);
        assert.match(result.stdout, /--port <number>/);
        assert.match(result.stdout, /--no-bundler/);
    });

    it('an unknown option exits with 1', function(){
        const result = run(root, ['--bogus']);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Args error/);
    });

    it('an invalid port exits with 1', function(){
        const result = run(root, ['--port', 'abc', '--no-open']);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Invalid port/);
    });
});

describe('--prod', function(){
    let root;
    let server;
    before(async function(){
        root = makeProject();
        server = await startServer(root, ['--prod', '--fallback', '403.html']);
    });
    after(async function(){ await stopServer(server); removeDir(root); });

    it('compresses static files', async function(){
        const res = await request(server.port, { path: '/big.txt', headers: { 'Accept-Encoding': 'gzip' } });
        assert.equal(res.status, 200);
        assert.equal(res.headers['content-encoding'], 'gzip');
    });

    it('uses the status code from the fallback file name', async function(){
        const res = await request(server.port, { path: '/missing.png' });
        assert.equal(res.status, 403);
        assert.match(res.body, /forbidden/);
    });

    it('does not inject the client script', async function(){
        const res = await request(server.port, { path: '/', headers: browser });
        assert.equal(res.status, 200);
        assert.doesNotMatch(res.body, /dx-client\.js/);
    });

    it('does not serve folders that only share the prefix of the public folder', async function(){
        const res = await request(server.port, { path: '/../www-secret/a.html', headers: browser });
        assert.doesNotMatch(res.body, /SECRET/);
    });

    it('serves extensionless files as static files, not as HTML', async function(){
        const res = await request(server.port, { path: '/data', headers: browser });
        assert.equal(res.status, 200);
        assert.equal(res.body, 'plain extensionless file');
        assert.doesNotMatch(res.headers['content-type'], /text\/html/);
    });
});

describe('--dev', function(){
    let root;
    let server;
    before(async function(){
        root = makeProject();
        server = await startServer(root, ['--dev']);
    });
    after(async function(){ await stopServer(server); removeDir(root); });

    const post = function(body, headers){
        return request(server.port, { method: 'POST', path: '/dx-lang', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: typeof body === 'string' ? body : JSON.stringify(body) });
    };
    const langFile = function(dir, code){ return path.join(root, 'lang', dir, code + '.json'); };

    it('injects the client script on browser navigations (SPA routes)', async function(){
        for(const route of ['/', '/some/client/route']){
            const res = await request(server.port, { path: route, headers: browser });
            assert.equal(res.status, 200);
            assert.match(res.body, /home/);
            assert.match(res.body, /dx-client\.js/);
        }
    });

    it('does not answer fetch/XHR calls (Accept: */*) with the entry point', async function(){
        const res = await request(server.port, { path: '/api/users', headers: { Accept: '*/*' } });
        assert.equal(res.status, 404);
    });

    it('does not serve folders that only share the prefix of the public folder', async function(){
        const res = await request(server.port, { path: '/../www-secret/a.html', headers: browser });
        assert.doesNotMatch(res.body, /SECRET/);
    });

    it('/dx-lang adds keys and edits values of existing keys', async function(){
        assert.equal((await post({ dir: 'en', code: 'nav', keys: { a: '1', b: '2' } })).status, 200);
        assert.equal((await post({ dir: 'en', code: 'nav', keys: { a: 'CHANGED', b: '2' } })).status, 200);
        assert.deepEqual(JSON.parse(fs.readFileSync(langFile('en', 'nav'), 'utf8')), { a: 'CHANGED', b: '2' });
    });

    it('/dx-lang never removes existing keys', async function(){
        const res = await post({ dir: 'en', code: 'nav', keys: { a: 'CHANGED' } });
        assert.equal(res.status, 400);
        assert.deepEqual(JSON.parse(fs.readFileSync(langFile('en', 'nav'), 'utf8')), { a: 'CHANGED', b: '2' });
    });

    it('/dx-lang creates new language files and folders', async function(){
        const res = await post({ dir: 'es', code: 'home', keys: { hola: 'mundo' } });
        assert.equal(res.status, 200);
        assert.deepEqual(JSON.parse(fs.readFileSync(langFile('es', 'home'), 'utf8')), { hola: 'mundo' });
    });

    it('/dx-lang keeps working after a failed request', async function(){
        fs.writeFileSync(langFile('en', 'broken'), '{ not json');
        assert.equal((await post({ dir: 'en', code: 'broken', keys: { a: '1' } })).status, 409);
        assert.equal((await post({ dir: 'en', code: 'nav', keys: { a: 'again', b: '2', c: '3' } })).status, 200);
        assert.equal(JSON.parse(fs.readFileSync(langFile('en', 'nav'), 'utf8')).c, '3');
    });

    it('/dx-lang rejects invalid bodies and path traversal', async function(){
        assert.equal((await post('{"dir":"en"}')).status, 400);
        assert.equal((await post({ dir: '..', code: 'nav', keys: { a: '1' } })).status, 400);
        assert.equal((await post({ dir: 'en', code: '..', keys: { a: '1' } })).status, 400);
        assert.equal(fs.existsSync(path.join(root, 'nav.json')), false);
    });

    it('/dx-lang rejects cross-origin requests', async function(){
        const res = await post({ dir: 'en', code: 'nav', keys: { a: 'x', b: '2', c: '3' } }, { Origin: 'http://evil.example' });
        assert.equal(res.status, 403);
        assert.notEqual(JSON.parse(fs.readFileSync(langFile('en', 'nav'), 'utf8')).a, 'x');
    });

    it('/dx-lang rejects untrusted host names (DNS rebinding)', async function(){
        const res = await post({ dir: 'en', code: 'nav', keys: { a: 'x', b: '2', c: '3' } }, { Host: 'attacker.example' });
        assert.equal(res.status, 403);
    });

    it('--frontend patches are served without the known problems', async function(){
        const framed = await startServer(root, ['--dev', '--frontend']);
        try {
            const res = await request(framed.port, { path: '/dx-client.js' });
            assert.equal(res.status, 200);
            assert.doesNotMatch(res.body, /setTimeout\(requestAbortController\.abort/);
            assert.match(res.body, /fetchPromise\.then\(clearAbortAndTimeout, clearAbortAndTimeout\)/);
            assert.doesNotThrow(function(){ new Function(res.body); });
        }
        finally {
            await stopServer(framed);
        }
    });
});

describe('--root', function(){
    let root;
    let elsewhere;
    before(function(){
        root = makeProject();
        elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'dx-server-cwd-'));
    });
    after(function(){
        removeDir(root);
        removeDir(elsewhere);
    });

    it('keeps the state files and the custom middleware inside the root folder', async function(){
        fs.writeFileSync(path.join(root, 'dx-server.middleware.js'), 'module.exports = function(req, res, next){ if(req.path === "/hello"){ return res.end("from middleware"); } next(); };');
        const server = await startServer(elsewhere, ['--dev', '--root', root]);
        try {
            const res = await request(server.port, { path: '/hello', headers: { Accept: '*/*' } });
            assert.equal(res.body, 'from middleware');
            assert.equal(fs.existsSync(path.join(elsewhere, 'dx-server')), false);
        }
        finally {
            await stopServer(server);
        }
    });
});

describe('--built (build ingestion)', function(){
    let root;
    let server;
    before(async function(){
        root = makeProject();
        server = await startServer(root, ['--built', '--dev']);
    });
    after(async function(){ await stopServer(server); removeDir(root); });

    const state = function(){
        const file = path.join(root, 'dx-server', '_built.tmp');
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    };

    it('detects errors, and an old error does not stick to the next build', async function(){
        server.child.stdin.write('Compiling...\nERROR in ./src/main.js\n');
        assert.ok(await waitFor(function(){ return state() === 'error'; }), 'error state expected, got: ' + state());

        await sleep(2000); // Quiet period: the next output is a new build cycle.

        server.child.stdin.write('Compiled successfully.\n');
        assert.ok(await waitFor(function(){ return state() === 'built'; }), 'built state expected, got: ' + state());
    });

    it('finds a keyword split between two chunks', async function(){
        await sleep(2000);
        server.child.stdin.write('Build failed: ER');
        server.child.stdin.write('ROR in module\n');
        assert.ok(await waitFor(function(){ return state() === 'error'; }), 'error state expected, got: ' + state());
    });
});

describe('--built --ingest with --watch-command', function(){
    let root;
    before(function(){ root = makeProject(); });
    after(function(){ removeDir(root); });

    it('runs the watch command when the watched folder changes', async function(){
        const watched = path.join(root, 'src');
        fs.mkdirSync(watched);
        fs.writeFileSync(path.join(root, 'marker.js'), 'require("fs").writeFileSync("marker.txt", "ran");');
        fs.writeFileSync(path.join(watched, 'a.js'), '// a');

        const child = spawn(process.execPath, [bin, '--built', '--ingest', '--no-open', '--watch', watched, '--watch-command', 'node marker.js', '--watch-command-timeout', '100'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
        try {
            const created = await waitFor(function(){ return fs.existsSync(path.join(root, 'marker.txt')); }, 10000);
            assert.ok(created, 'the watch command was not executed');
        }
        finally {
            await stopServer({ child });
        }
    });
});

describe('security', function(){
    let root;
    let server;
    before(async function(){
        root = makeProject();
        server = await startServer(root, ['--dev']);
    });
    after(async function(){ await stopServer(server); removeDir(root); });

    it('rejects a client IP that is not a plain key ("__proto__")', async function(){
        const stream = await openLiveReload(server.port, '__proto__');
        stream.request.destroy();
        assert.equal(stream.status, 400);
    });

    it('rejects the live-reload stream without a valid token', async function(){
        const res = await request(server.port, { path: '/dx-update?dx-token=bad&dx-ip=bad' });
        assert.equal(res.status, 400);
    });

    it('internal endpoints are not readable by other origins, static files keep the default CORS', async function(){
        const internal = await request(server.port, { path: '/dx-client.js', headers: { Origin: 'http://evil.example' } });
        assert.equal(internal.headers['access-control-allow-origin'], undefined);

        const asset = await request(server.port, { path: '/big.txt', headers: { Origin: 'http://other.example' } });
        assert.equal(asset.headers['access-control-allow-origin'], 'http://other.example');
    });

    it('errors are answered without stack traces', async function(){
        const res = await request(server.port, { method: 'POST', path: '/anything', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
        assert.equal(res.status, 400);
        assert.equal(res.body, '');
    });

    it('does not send HSTS nor "upgrade-insecure-requests" over HTTP', async function(){
        const res = await request(server.port, { path: '/', headers: browser });
        assert.equal(res.headers['strict-transport-security'], undefined);
        assert.doesNotMatch(res.headers['content-security-policy'], /upgrade-insecure-requests/);
    });

    it('/dx-lang rejects names that are not valid on every OS', async function(){
        for(const body of [{ dir: 'con', code: 'nav' }, { dir: 'en', code: 'a|b' }, { dir: 'en', code: '<b>' }, { dir: 'en', code: 'nav.' }]){
            const res = await request(server.port, { method: 'POST', path: '/dx-lang', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ keys: { a: '1' } }, body)) });
            assert.equal(res.status, 400, JSON.stringify(body));
        }
    });

    it('--cors restricts the allowed origins', async function(){
        const restricted = await startServer(root, ['--dev', '--cors', 'http://allowed.example']);
        try {
            const allowed = await request(restricted.port, { path: '/big.txt', headers: { Origin: 'http://allowed.example' } });
            assert.equal(allowed.headers['access-control-allow-origin'], 'http://allowed.example');
            const other = await request(restricted.port, { path: '/big.txt', headers: { Origin: 'http://other.example' } });
            assert.equal(other.headers['access-control-allow-origin'], undefined);
        }
        finally {
            await stopServer(restricted);
        }
    });

    it('--public pointing to the project root never serves DX Server internal files', async function(){
        fs.writeFileSync(path.join(root, 'dx-server.middleware.js'), 'module.exports = function(req, res, next){ next(); };');
        fs.writeFileSync(path.join(root, 'index.html'), '<html><body>root</body></html>');
        const exposed = await startServer(root, ['--prod', '--public', root]);
        try {
            fs.writeFileSync(path.join(root, 'dx-server', 'private.txt'), 'private');
            assert.equal((await request(exposed.port, { path: '/index.html' })).status, 200);
            assert.equal((await request(exposed.port, { path: '/dx-server.middleware.js' })).status, 404);
            assert.equal((await request(exposed.port, { path: '/dx-server/private.txt' })).status, 404);
        }
        finally {
            await stopServer(exposed);
            fs.rmSync(path.join(root, 'dx-server.middleware.js'));
        }
    });
});

describe('live-reload', function(){
    let root;
    before(function(){ root = makeProject(); });
    after(function(){ removeDir(root); });

    it('sends "update" to the open tabs when the entry point changes', async function(){
        const server = await startServer(root, ['--dev']);
        let stream;
        try {
            stream = await openLiveReload(server.port);
            assert.equal(stream.status, 200);
            assert.ok(await waitFor(function(){ return stream.messages.includes('1'); }), 'connection message expected');

            await sleep(500);
            stream.messages.length = 0;
            const later = new Date(Date.now() + 5000);
            fs.writeFileSync(path.join(root, 'www', 'index.html'), '<!DOCTYPE html><html><body>changed</body></html>');
            fs.utimesSync(path.join(root, 'www', 'index.html'), later, later);

            assert.ok(await waitFor(function(){ return stream.messages.includes('update'); }), 'update expected, got: ' + stream.messages.join(','));
        }
        finally {
            if(stream){ stream.request.destroy(); }
            await stopServer(server);
        }
    });

    it('--no-bundler sends "update" on any file change', async function(){
        const server = await startServer(root, ['--dev', '--no-bundler']);
        let stream;
        try {
            stream = await openLiveReload(server.port);
            assert.ok(await waitFor(function(){ return stream.messages.includes('1'); }), 'connection message expected');

            await sleep(500);
            stream.messages.length = 0;
            fs.writeFileSync(path.join(root, 'www', 'style.css'), 'body { color: red; }');

            assert.ok(await waitFor(function(){ return stream.messages.includes('update'); }), 'update expected, got: ' + stream.messages.join(','));
        }
        finally {
            if(stream){ stream.request.destroy(); }
            await stopServer(server);
        }
    });
});

describe('--ssl', function(){
    let root;
    before(function(){ root = makeProject(); });
    after(function(){ removeDir(root); });

    it('generates self signed certificates and serves over HTTPS', async function(){
        const server = await startServer(root, ['--dev', '--ssl']);
        try {
            const res = await new Promise(function(resolve, reject){
                https.get({ host: '127.0.0.1', port: server.port, path: '/', headers: browser, rejectUnauthorized: false }, function(response){
                    response.resume();
                    response.on('end', function(){ resolve(response); });
                }).on('error', reject);
            });
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['strict-transport-security'], undefined); // Never pinned to HTTPS on DEV.
            for(const file of ['cert.crt', 'cert.key', 'ca.crt']){
                assert.ok(fs.existsSync(path.join(root, 'dx-server', 'self-signed-certificates', file)), file);
            }
        }
        finally {
            await stopServer(server);
        }
    });
});
