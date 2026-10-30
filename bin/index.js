#!/usr/bin/env node

/*
    DX Server
    A development server and build tool for frontend applications with hot-reloading and SPA support.

    License: MIT
    Copyright (c) 2026 OKZGN
*/

const DXServer = 'DX Server';
const DXServerVersion = require('../package.json').version;

const [major, minor] = process.versions ? process.versions.node.split('.').map(Number) : [0, 0];
// Checked before loading the dependencies: chalk and chokidar are ES modules that require Node.js 22.22 or higher.
if((major < 22) || (major === 22 && minor < 22)){
    console.error(DXServer, 'Not supported environment: Node.js 22.22.0 or higher is required (current: ' + (process.versions ? process.versions.node : 'unknown') + ').');
    process.exit(1);
}

const Console = {};
const chalk = require('chalk').default; // ES module loaded with "require": its default export.
setConsoleFunctions();

process.on('uncaughtException', function(e){
    console.error(chalk.red(DXServer), chalk.red('Uncaught exception.'));
    console.error(chalk.red('Error details:'), e.message);
    console.error(e);
    process.exit(1);
});

const devMode = '--dev';
const prodMode = '--prod';
const noSSLMode = '--no-ssl';
const SSLMode = '--ssl';
const builtMode = '--built';
const noKillMode = '--no-kill';
const silentMode = '--silent';
const ingestMode = '--ingest';
const shellMode = '--shell';
const frontendMode = '--frontend';
const noBundlerMode = '--no-bundler';
const noOpenMode = '--no-open';
const noCSPMode = '--no-csp';

let SSLModeON = false;
let devModeON = false;
let prodModeON = false;
let builtModeON = false;
let ingestModeON = false;
let killModeOFF = false;
let silentModeON = false;
let watchModeON = false;
let watchCommandModeON = false;
let shellModeON = false;
let frontendModeON = false;
let noBundlerModeON = false;
let noOpenModeON = false;
let noCSPModeON = false;

let port;
let protocol;
let server;
let serverMode;
let serverSSL;
let serverSSLCert;
let serverSSLKey;

let open;
const path = require('path');
const { parseArgs } = require('util');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const dxServerFolderName = 'dx-server';
const selfSignedCertificatesFolderName = 'self-signed-certificates';
const args = {};

let mainFolder = process.cwd();
const publicFolderName = 'www';
let publicFolder = path.join(mainFolder, publicFolderName);
const watchFolderName = 'src';
let watchFolder = path.join(mainFolder, watchFolderName);
const langFolderName = 'lang';
let langFolder = path.join(mainFolder, langFolderName);
let coreFolder = path.join(mainFolder, dxServerFolderName);
let certsFolder = path.join(mainFolder, dxServerFolderName, selfSignedCertificatesFolderName);
let builtIngestConfirmKeywordsDefaultList = [];
let builtIngestConfirmKeywordsList = [];
let builtIngestErrorKeywordsDefaultList = ['ERROR', 'bundle generation failed'];
let builtIngestErrorKeywordsList = [];

let minDXServerClientFetchTimeout = 1000;
let defaultDXServerClientFetchTimeout = 30000;
let DXServerClientFetchTimeout = defaultDXServerClientFetchTimeout;

const minWatchCommandTimeoutTime = 100;
const defaultWatchCommandTimeoutTime = 5000;
let watchCommandTimeoutTime = defaultWatchCommandTimeoutTime;

const minFileWatchingSubFoldersDepth = 1;
const defaultFileWatchingSubFoldersDepth = 5;
let fileWatchingSubFoldersDepth = defaultFileWatchingSubFoldersDepth;

const defaultIgnoredOnWatching = ['node_modules', /(^|[\\/])\.[^\\/]+$/];
let customIgnoredOnWatching = [];

const minIngestChunksLimit = 1024;
const defaultIngestChunksLimit = 1048576;
let ingestChunksLimit = defaultIngestChunksLimit;
const ingestOverlapLength = 256; // Tail of the previous data analyzed again, to detect keywords split between two chunks.
const ingestQuietGapTime = 1500; // Silence (ms) after which the next output is considered a new build cycle.
const ingestStdoutWriteDelay = 300;

const defaultLangJSONLimit = ((1024 * 1024) * 1); // JSON of 1000 keys (1 to 64 bytes) and values (2 to 256 bytes) = 330 Kb. max.
let langJSONLimit = defaultLangJSONLimit;

const defaultNetworkExposedTo = '::';
let networkExposedTo = defaultNetworkExposedTo;

let corsOrigins = []; // Empty: any origin is reflected.

const minMaxAgeCache = (1000 * 60);
const defaultMaxAgeCache = (minMaxAgeCache * 60 * 24 * 1);
let maxAgeCache = defaultMaxAgeCache;

const fallbackFileName = '404.html';
let fallbackStatus = 404;
let fallbackFilePath = path.join(publicFolder, fallbackFileName);

const fallbackCustomMiddlewareFileName = 'dx-server.middleware.js';
let customMiddlewareFileName = fallbackCustomMiddlewareFileName;
let customMiddlewareFilePath = path.join(mainFolder, fallbackCustomMiddlewareFileName);

// Keyed by client IP (partly sent by the client): maps without prototype, so keys like "__proto__" are plain keys.
let connectedWithHotReload = Object.create(null);

let tryToRedirect = Object.create(null);
let tryToRedirectIPsCount = 0;
let tryToRedirectOverflowIPsCount = 0;

const availableModesDescription = {};
availableModesDescription[devMode] = 'Turn ON hot-reload and lang endpoints.';
availableModesDescription[prodMode] = 'Turn OFF hot-reload and lang endpoints.';
availableModesDescription[noSSLMode] = 'DISABLE automatic self signed SSL certificates.';
availableModesDescription[SSLMode] = 'ENABLE automatic self signed SSL certificates.';
availableModesDescription[builtMode] = 'ENABLE ingestion for another process stdout, to know building states and use it for hot-reload.';
availableModesDescription[noKillMode] = 'DISABLE the default port-killing feature. If the port is busy, the server will throw an error instead of taking it over.';
availableModesDescription[silentMode] = 'ENABLE suppresses non-critical terminal logs and warnings.';
availableModesDescription[ingestMode] = 'ENABLE ONLY ingestion for another process stdout, without server listen (requires "--built"). Useful for "--watch-command".';
availableModesDescription[shellMode] = 'ENABLE "--watch-command" execution as shell mode.';
availableModesDescription[noBundlerMode] = 'ENABLE vanilla mode: reload the browser on any file change (HTML, CSS, JS) without a bundler.';
availableModesDescription[noOpenMode] = 'DISABLE opening the browser automatically.';
availableModesDescription[noCSPMode] = 'DISABLE the Content-Security-Policy header (useful in "--prod" for apps with inline scripts or external CDNs).';
availableModesDescription['--port <number>'] = 'Set the server port. Defaults to 80 (443 with "--ssl").';
availableModesDescription['--version'] = 'Print the DX Server version and exit.';
availableModesDescription['--help'] = 'Print this list and exit.';
availableModesDescription[frontendMode] = 'ENABLE some backwards compatibility and patches native frontend functions to implement global "fetch" timeouts and aborts (to avoid browser freeze with a lot of fetches) and ensure "console.error" outputs strings (for platforms with limited object inspection capabilities).';
availableModesDescription['--frontend-fetch-timeout <number>'] = 'Set the timeout in milliseconds for the client fetch interceptor. Defaults to ' + DXServerClientFetchTimeout + '.';
availableModesDescription['--ingest-limit <number>'] = 'Set the total bytes limit of chunks retained for analysis. Defaults to ' + defaultIngestChunksLimit + '.';
availableModesDescription['--built-confirm-keywords <string>'] = 'Set a comma-separated list of keywords used to identify and confirm a successful build ingestion process.';
availableModesDescription['--built-error-keywords <string>'] = 'Set a comma-separated list of keywords used to identify errors during the build ingestion process.';
availableModesDescription['--cert <file_path>'] = 'Set custom SSL cert file.';
availableModesDescription['--key <file_path>'] = 'Set custom SSL key file.';
availableModesDescription['--root <folder_path>'] = 'Set the project root directory. Defaults to "' + mainFolder + '".';
availableModesDescription['--public <folder_path>'] = 'Set custom public folder to serve.';
availableModesDescription['--lang <folder_path>'] = 'Set custom lang folder for saving.';
availableModesDescription['--watch <folder_path>'] = 'Add an extra directory for the hot-reload watcher to observe (required by the other "--watch-*" and "--shell" options).';
availableModesDescription['--watch-ignore <string>'] = 'Set a comma-separated list of regular expressions (matched against the full path) to be ignored on watching. Defaults to ['+ (defaultIgnoredOnWatching.map(function(element){ return (typeof element === 'string' ? '"' + element + '"' : String(element)); })).join(', ') + ']';
availableModesDescription['--watch-depth <number>'] = 'Set limits how many levels of subdirectories will be traversed for watching. Defaults to ' + defaultFileWatchingSubFoldersDepth + '.';
availableModesDescription['--watch-command <cli_command>'] = 'Set a CLI command to execute when the "--watch" folder has changed.';
availableModesDescription['--watch-command-timeout <number>'] = 'Set the debounce timeout in milliseconds for the "--watch-command" execution. Defaults ' + defaultWatchCommandTimeoutTime + '.';
availableModesDescription['--network <ip>'] = 'Set the network interface address (IPv4 or IPv6) that the server will bind to. Defaults to "' + defaultNetworkExposedTo + '".';
availableModesDescription['--cors <origins>'] = 'Set a comma-separated list of origins allowed by CORS (e.g. "http://localhost:3000, https://app.test"). Defaults to any origin (reflected). Internal "/dx-*" endpoints are always same-origin only.';
availableModesDescription['--cache <number>'] = 'Set the "maxAge" in milliseconds for static files caching (not for "index.html"). Defaults to "' + defaultMaxAgeCache + '" in "--prod" and 0 in "--dev" unless set explicitly.';
availableModesDescription['--fallback <file_path>'] = 'Define the fallback file to be served when no route or static file matches the request.';

let mkcert;
let chokidar;
const express = require('express');
const https = require('https');
const app = express();

const entryPointFileName = 'index.html';
let entryPointFilePath = path.join(publicFolder, entryPointFileName);

const localhost = 'localhost';
const localhostIP = '127.0.0.1';
const localhostIPv6 = '::1';
const versionReferenceFile = 'index.html';
let versionReferenceFilePath = path.join(publicFolder, versionReferenceFile);

const builtReferenceFile = '_built.tmp';
const builtReferenceFileStdoutExt = '.stdout';
let builtReferenceFilePath = path.join(coreFolder, builtReferenceFile);
const errorReferenceFile = '_error.tmp';
let errorReferenceFilePath = path.join(coreFolder, errorReferenceFile);
const browserOpenReferenceFile = '_browserOpen.tmp';
let browserOpenReferenceFilePath = path.join(coreFolder, browserOpenReferenceFile);

const updateStatusEndpoint = '/dx-update';
const startUpdatesStatusEndpoint = '/dx-start-update';
const langEndpoint = '/dx-lang';
const dxClientEndpointFileName = 'dx-client.js';
const dxClientEndpoint = '/' + dxClientEndpointFileName;

const certFileName = 'cert.crt';
const certKeyFileName = 'cert.key';
const certCAFileName = 'ca.crt';
const certRenewBeforeExpirationTime = (1000 * 60 * 60 * 24 * 7);

const pollingInterval = 2500;
const checkingTimeSinceDisconnection = 3000;
const recentTimeDefaultReference = 5000;
const builtStateDefaultTime = 5000;
const builtStateLongTime = 15000;
const entryPointConnectReloadInterval = 2000;
const entryPointStateTimeToUpdate = 2000;
const connectedIPsFromLimit = 1000;
const heartbeatIntervalTime = 60000;
const compilationState = 'compilation';
const builtState = 'built';
const errorState = 'error';
const updateState = 'update';
const startingState = 'starting';

let watcherInterval;
let executionLock = Promise.resolve();
let entryPointCache = '';
let cleanBuiltStateFilesTimeout;
let watchCommand = '';
let watchCommandTimeout;
let watchCommandReference;

const DXClient = 'DX Client';
const DXIPName = 'dx-ip';
const DXTokenName = 'dx-token';
const DXTokenValue = crypto.randomBytes(16).toString('hex');

async function setArgsAndDefaultConfig(){
    try {
        const { values } = parseArgs({
            options: {
                'built-confirm-keywords': {
                    type: 'string'
                },
                'built-error-keywords': {
                    type: 'string'
                },
                built: {
                    type: 'boolean'
                },
                ingest: {
                    type: 'boolean'
                },
                'ingest-limit': {
                    type: 'string'
                },
                prod: {
                    type: 'boolean'
                },
                ssl: {
                    type: 'boolean'
                },
                cert: {
                    type: 'string'
                },
                key: {
                    type: 'string'
                },
                'no-ssl': {
                    type: 'boolean',
                    default: true
                },
                dev: {
                    type: 'boolean',
                    default: true
                },
                port: {
                    type: 'string'
                },
                cors: {
                    type: 'string'
                },
                'no-kill': {
                    type: 'boolean'
                },
                silent: {
                    type: 'boolean'
                },
                'frontend-fetch-timeout': {
                    type: 'string'
                },
                root: {
                    type: 'string'
                },
                public: {
                    type: 'string'
                },
                lang: {
                    type: 'string'
                },
                watch: {
                    type: 'string'
                },
                'watch-command': {
                    type: 'string'
                },
                'watch-command-timeout': {
                    type: 'string'
                },
                'watch-depth': {
                    type: 'string'
                },
                'watch-ignore': {
                    type: 'string'
                },
                network: {
                    type: 'string'
                },
                cache: {
                    type: 'string'
                },
                fallback: {
                    type: 'string'
                },
                shell: {
                    type: 'boolean'
                },
                frontend: {
                    type: 'boolean'
                },
                'no-bundler': {
                    type: 'boolean'
                },
                'no-open': {
                    type: 'boolean'
                },
                'no-csp': {
                    type: 'boolean'
                },
                version: {
                    type: 'boolean'
                },
                help: {
                    type: 'boolean'
                }
            }
        });
        Object.assign(args, values);
    }
    catch(e){
        Console.blue(DXServer);
        Console.error('Args error:', e.message);
        printAvailableModes(false);
    }

    if(args.version){
        printVersion();
    }

    Console.blue(DXServer);

    if(args.help){
        printAvailableModes(true);
    }

    warnIgnoredArguments();

    if(args['built-confirm-keywords']){
        builtIngestConfirmKeywordsList = commaSeparatedKeywordsList(args['built-confirm-keywords']);
    }

    if(!builtIngestConfirmKeywordsList.length){
        builtIngestConfirmKeywordsList = builtIngestConfirmKeywordsDefaultList;
    }

    if(args['built-error-keywords']){
        builtIngestErrorKeywordsList = commaSeparatedKeywordsList(args['built-error-keywords']);
    }

    if(!builtIngestErrorKeywordsList.length){
        builtIngestErrorKeywordsList = builtIngestErrorKeywordsDefaultList;
    }

    if(args.dev){
        serverMode = devMode;
        devModeON = true;
        prodModeON = false;
    }

    if(args.prod){
        serverMode = prodMode;
        prodModeON = true;
        devModeON = false;
    }

    if(args.built){
        serverMode = builtMode;
        builtModeON = true;
    }

    if(args.ingest && builtModeON){
        ingestModeON = true;
    }

    if(args['ingest-limit'] && builtModeON){
        let newLimit = Number(args['ingest-limit']);
        ingestChunksLimit = correctNumberValue(newLimit, minIngestChunksLimit, (defaultIngestChunksLimit * 10), defaultIngestChunksLimit);
    }

    if(args['no-ssl']){
        serverSSL = noSSLMode;
        SSLModeON = false;
    }

    if(args.ssl){
        serverSSL = SSLMode;
        SSLModeON = true;
    }

    if(typeof args.port !== 'undefined'){
        // An explicit port is always respected (also 80 with "--ssl" or 443 without it).
        port = Number(args.port);
        if(!Number.isInteger(port) || port < 1 || port > 65535){
            Console.error('Invalid port:', args.port);
            process.exit(1);
        }
    }
    else {
        port = SSLModeON ? 443 : 80;
    }

    if(args.cert || args.key){
        if(SSLModeON){
            if(await fileExists(args.cert, true)){
                serverSSLCert = args.cert;
            }

            if(await fileExists(args.key, true)){
                serverSSLKey = args.key;
            }

            if(!serverSSLCert || !serverSSLKey){
                serverSSLCert = null;
                serverSSLKey = null;
                Console.error('Error trying to load your SSL certificates.');
            }
        }
        else {
            Console.warn('TURN ON SSL to use custom SSL cert and key.');
        }
    }

    if(args['no-kill']){
        killModeOFF = true;
    }

    if(args['silent']){
        silentModeON = true;
    }

    if(args.root){
        if(await folderExists(args.root, true)){
            mainFolder = path.resolve(args.root);
            coreFolder = path.join(mainFolder, dxServerFolderName);
            certsFolder = path.join(mainFolder, dxServerFolderName, selfSignedCertificatesFolderName);

            publicFolder = path.join(mainFolder, publicFolderName);
            watchFolder = path.join(mainFolder, watchFolderName);
            langFolder = path.join(mainFolder, langFolderName);

            builtReferenceFilePath = path.join(coreFolder, builtReferenceFile);
            errorReferenceFilePath = path.join(coreFolder, errorReferenceFile);
            browserOpenReferenceFilePath = path.join(coreFolder, browserOpenReferenceFile);
            customMiddlewareFilePath = path.join(mainFolder, customMiddlewareFileName);

            entryPointFilePath = path.join(publicFolder, entryPointFileName);
            versionReferenceFilePath = path.join(publicFolder, versionReferenceFile);
            fallbackFilePath = path.join(publicFolder, fallbackFileName);
        }
        else {
            Console.error('Cannot set ROOT/CWD folder.');
        }
    }

    if(args.public){
        if(await folderExists(args.public, true)){
            publicFolder = path.resolve(args.public);

            entryPointFilePath = path.join(publicFolder, entryPointFileName);
            versionReferenceFilePath = path.join(publicFolder, versionReferenceFile);
            fallbackFilePath = path.join(publicFolder, fallbackFileName);
        }
        else {
            Console.error('Cannot set PUBLIC folder.');
        }
    }

    if(args.lang){
        if(await folderExists(args.lang, true)){
            langFolder = path.resolve(args.lang);
        }
        else {
            Console.error('Cannot set LANG folder.');
        }
    }

    if(args.watch){
        watchFolder = path.resolve(args.watch);
        watchModeON = true;

        if(!await folderExists(args.watch, true)){
            Console.warn('WATCH folder doesn\'t exist, the watcher will start working when it is created.');
        }
    }

    if(args['watch-command'] && watchModeON){
        watchCommandModeON = true;
        watchCommand = args['watch-command'];
    }

    if(args['watch-command-timeout'] && watchModeON){
        let newTimeout = Number(args['watch-command-timeout']);
        watchCommandTimeoutTime = correctNumberValue(newTimeout, minWatchCommandTimeoutTime, (defaultWatchCommandTimeoutTime * 120), defaultWatchCommandTimeoutTime);
    }

    if(args['watch-depth'] && watchModeON){
        let newDepth = Number(args['watch-depth']);
        fileWatchingSubFoldersDepth = correctNumberValue(newDepth, minFileWatchingSubFoldersDepth, (defaultFileWatchingSubFoldersDepth * 5), defaultFileWatchingSubFoldersDepth);
    }

    if(args['watch-ignore'] && watchModeON){
        customIgnoredOnWatching = commaSeparatedKeywordsList(args['watch-ignore'], 'regexp');
    }

    if(args.network){
        networkExposedTo = net.isIP(args.network) !== 0 ? args.network : defaultNetworkExposedTo;
    }

    if(args.cors){
        corsOrigins = commaSeparatedKeywordsList(args.cors);
    }

    if(args.shell && watchCommandModeON){
        shellModeON = true;
    }

    if(args.frontend){
        frontendModeON = true;
    }

    if(args['frontend-fetch-timeout'] && frontendModeON){
        let newFetchTimeout = Number(args['frontend-fetch-timeout']);
        DXServerClientFetchTimeout = correctNumberValue(newFetchTimeout, minDXServerClientFetchTimeout, (defaultDXServerClientFetchTimeout * 100), defaultDXServerClientFetchTimeout);
    }

    if(!customIgnoredOnWatching.length){ customIgnoredOnWatching = defaultIgnoredOnWatching; }

    if(devModeON){ maxAgeCache = 0; }

    if(args.cache){
        let newValue = Number(args.cache);
        maxAgeCache = (newValue === 0 ? 0 : correctNumberValue(newValue, minMaxAgeCache, (defaultMaxAgeCache * 365 * 5), defaultMaxAgeCache));
    }

    if(args.fallback){
        let resolvedFallback = path.isAbsolute(args.fallback) ? path.resolve(path.normalize(args.fallback)) : path.resolve(publicFolder, path.normalize(args.fallback));

        if(await fileExists(resolvedFallback) && isInside(publicFolder, resolvedFallback)){
            let statusByBasename = Number(path.basename(resolvedFallback).split('.')[0]);
            if(Number.isInteger(statusByBasename) && statusByBasename > 199 && statusByBasename < 600){ fallbackStatus = statusByBasename; }
            fallbackFilePath = resolvedFallback;
        }
        else {
            Console.warn('Fallback file not found or outside of the public folder:', args.fallback);
            fallbackFilePath = '';
        }
    }
    else {
        if(!await fileExists(fallbackFilePath)){
            fallbackFilePath = '';
        }
    }

    if(args['no-bundler']){
        noBundlerModeON = true;
    }

    if(args['no-open']){
        noOpenModeON = true;
    }

    if(args['no-csp']){
        noCSPModeON = true;
    }
}

function warnIgnoredArguments(){
    const dependencies = [
        ['ingest', 'built'],
        ['ingest-limit', 'built'],
        ['watch-command', 'watch'],
        ['watch-command-timeout', 'watch'],
        ['watch-depth', 'watch'],
        ['watch-ignore', 'watch'],
        ['shell', 'watch-command'],
        ['frontend-fetch-timeout', 'frontend']
    ];

    for(const [flag, requires] of dependencies){
        if(typeof args[flag] !== 'undefined' && !args[requires]){
            Console.warn('"--' + flag + '" requires "--' + requires + '" and it will be ignored.');
        }
    }
}

(async function main(){

    await setArgsAndDefaultConfig();

    await createMainFolders();

    switch(serverMode){
        case builtMode:
            try {
                await cleanBuiltStateFiles();
                await writeFile(builtReferenceFilePath, compilationState);
                await writeFile(errorReferenceFilePath, '');

                startIngestion();
            }
            catch(e){
                Console.error('Ingestion error:', e.message);
            }

            if(!ingestModeON){
                await initDxServerModes();
            }
            else {
                startWatchCommandOnly();
            }
            break;

        case devMode:
        case prodMode:
            await initDxServerModes();
            break;
        default:
            Console.error('Server mode VALUES issue:');
            Console.warn('Dev/Prod mode:', serverMode);
            Console.warn('SSL off:', serverSSL);
            printAvailableModes(false);
    }

    const sigterm = 'SIGTERM';
    process.on(sigterm, function(){ shutdown(sigterm); });

    const sigint = 'SIGINT';
    process.on(sigint, function(){ shutdown(sigint); });

    async function shutdown(kind){
        Console.blue('Shutting down...');
        let endPrefix = 'END';

        stopWatchCommand();

        try {
            Console.info('Deleting temporary files...');
            await cleanBuiltStateFiles();
            if(!await dateInsideFileIsRecent(browserOpenReferenceFilePath)){ await deleteFile(browserOpenReferenceFilePath, true); }
        }
        catch(e){
            Console.error('Cleaning temporary files error:', e.message);
            Console.error(DXServer, endPrefix, kind);
            process.exit(1);
        }

        Console.green(DXServer, endPrefix, kind);
        process.exit(0);
    }

    process.on('unhandledRejection', function(reason, promise){
        Console.error(DXServer, 'Unhandled rejection:', reason);
        Console.error(DXServer, 'Unhandled promise:', promise);
    });

    process.on('exit', function(){
        Console.info('Exit');
    });

})();

function killProcessTree(child){
    if(!child || !child.pid || child.exitCode !== null || child.signalCode !== null){ return; }

    try {
        if(process.platform === 'win32'){
            const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            killer.on('error', function(){ child.kill(); });
        }
        else {
            process.kill(-child.pid, 'SIGTERM'); // The command runs detached, as leader of its own process group.
        }
    }
    catch(e){
        child.kill();
    }
}

function stopWatchCommand(){
    try {
        if(watchCommandReference){
            Console.info('Stopping watch command execution...');
            killProcessTree(watchCommandReference);
            watchCommandReference = undefined;
        }
    }
    catch(e){
        Console.error('Stopping watch command execution error:', e.message);
    }
}

function isInside(parent, child){
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative));
}

function escapeHTML(value){
    return String(value).replace(/[&<>"']/g, function(character){
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[character];
    });
}

const invalidFileNameCharacters = /[<>:"/\\|?*\u0000-\u001F]/;
const reservedFileNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

// Names valid on every OS (Windows is the strictest), so the lang folder can be shared between platforms.
function isPortableFileName(name){
    return typeof name === 'string' && name.length > 0 && name.length <= 200 && name !== '.' && name !== '..' &&
        !invalidFileNameCharacters.test(name) && !/[. ]$/.test(name) && !reservedFileNames.test(name);
}

function sendFallback(req, res){
    if(fallbackFilePath){
        setDefaultHeaders(res, 'text/html');
        return res.status(fallbackStatus).sendFile(fallbackFilePath);
    }
    return res.status(404).end();
}

function isLoopbackAddress(address){
    return address === localhost || address === localhostIPv6 || /^(::ffff:)?127\./.test(address);
}

function isTrustedHostHeader(hostHeader){
    if(typeof hostHeader !== 'string' || !hostHeader){ return false; }

    const hostname = (hostHeader.charAt(0) === '[' ? hostHeader.slice(1, hostHeader.indexOf(']')) : hostHeader.replace(/:\d+$/, '')).toLowerCase();
    const machineName = os.hostname().toLowerCase();

    return net.isIP(hostname) !== 0 || hostname === localhost || hostname.endsWith('.' + localhost) || hostname === machineName || hostname === machineName + '.local';
}

function isSameOriginRequest(req){
    if(req.headers['sec-fetch-site'] === 'cross-site'){ return false; }

    const origin = req.headers.origin;
    if(!origin){ return true; }

    try {
        return new URL(origin).host === req.headers.host;
    }
    catch(e){
        return false;
    }
}

function requestAcceptsHTMLDocument(req){
    const accept = String(req.headers.accept || '').toLowerCase();
    return accept.includes('text/html') || accept.includes('application/xhtml+xml');
}

async function openBrowser(localhostURL, bypass){
    if(noOpenModeON){ return; }

    try {
        const isBrowserOpen = await fileExists(browserOpenReferenceFilePath);
        if(bypass || (!isBrowserOpen && !await dateInsideFileIsRecent(browserOpenReferenceFilePath))){
            Console.info('Opening:', localhostURL);
            await open(localhostURL);
        }
    }
    catch(e){
        Console.error('Browser opening error:', e.message);
    }
}

function correctNumberValue(number, min, max, defaultNumber){
    return (!isNaN(number) && number >= (min || 0) && number <= (max || 104857601)) ? number : (defaultNumber || 0);
}

async function dateInsideFileIsRecent(file, time){
    let fileDateReference = ((await readFile(file, true)).toString() * 1);
    if(!isNaN(fileDateReference) && (Date.now() - fileDateReference) < (time || recentTimeDefaultReference)){
        return true;
    }

    return false;
}

async function isRecentFile(file, time){
    let fileDateReference = await stat(file);
    if(fileDateReference && (Date.now() - fileDateReference.mtimeMs) < (time || recentTimeDefaultReference)){
        return true;
    }

    return false;
}

function certificateIsExpiring(pem){
    try {
        const expiration = new Date(new crypto.X509Certificate(pem).validTo).getTime();
        return isNaN(expiration) || (expiration - Date.now()) < certRenewBeforeExpirationTime;
    }
    catch(e){
        return true;
    }
}

async function ensureCertificatesAndCA(force){
    if(!SSLModeON){
        Console.info('SSL disabled, skipping certificate generation.');
        return;
    }

    if(!mkcert){ mkcert = require('mkcert'); }

    const crtPath = path.join(certsFolder, certFileName);
    const keyPath = path.join(certsFolder, certKeyFileName);
    const caPath = path.join(certsFolder, certCAFileName);

    try {
        if(!force && await fileExists(keyPath) && await fileExists(crtPath)){
            Console.info('SSL certificates already exist. Skipping generation.');
            return;
        }

        Console.info('Generating SSL certificates...');

        if(!await fileExists(certsFolder)){
            await createFolder(certsFolder, { recursive: true });
        }

        Console.info('Deleting previous cert and key files.');
        await deleteFile(crtPath, true);
        await deleteFile(keyPath, true);

        const CA = await mkcert.createCA({
            organization: 'DX Server',
            countryCode: 'US',
            state: 'Local',
            locality: 'Local',
            validity: 365 * 3
        });

        Console.info('Local CA created (it is NOT installed in the system trust store).');

        const cert = await mkcert.createCert({
            domains: [localhost, localhostIP, localhostIPv6],
            validity: 365,
            ca: CA
        });

        Console.info('Certificate for "' + [localhost, localhostIP, localhostIPv6].join('", "') + '" generated.');

        await writeFile(crtPath, cert.cert);
        await writeFile(keyPath, cert.key);
        await writeFile(caPath, CA.cert);

        Console.log('Self signed SSL certificates generated.');
        Console.log('Cert path:', crtPath);
        Console.log('Key path:', keyPath);
        Console.log('CA path (trust this file in your OS/browser to remove the security warning):', caPath);

        return { key: cert.key, cert: cert.cert };
    }
    catch(e){
        Console.error('Error generating or installing SSL certificates with MKCERT:', e);
        return;
    }
}

async function stopPortProcess(){
    if(killModeOFF){ return; }

    Console.green('Ending process on port:', port);
    try {
        const killPort = require('kill-port');
        await killPort(port);
        await new Promise(function(resolve){ setTimeout(resolve, 1000); });
    }
    catch(e){
        Console.error('Cannot stop process on port:', port);
        process.exit(1);
    }
}

// Escalation levels of "writeSlowly", from the most severe. Each one is active once the counter exceeds "options[name]",
// runs "options[name + '_callback']" and prints "options[name + '_message']" the first time and then every "every" calls.
const writeSlowlyLevels = [
    { name: 'last', every: 12, type: 'error' },
    { name: 'very_slow', every: 10, type: 'error' },
    { name: 'slow', every: 8, type: 'warn' },
    { name: 'normal', every: 6, type: 'warn' },
    { name: 'fast', every: 4, type: 'info' },
    { name: 'first', every: 2, type: 'log', fromStart: true }
];

async function writeSlowly(options){
    options.counter = (options.counter || 0) + 1;

    for(const level of writeSlowlyLevels){
        const threshold = options[level.name];
        if(!threshold || (!level.fromStart && options.counter <= threshold)){ continue; }

        const callback = options[level.name + '_callback'];
        if(typeof callback === 'function'){ await callback(); }

        const doneKey = level.name + '_callback_done';
        options[doneKey] = options[doneKey] || 0;
        if((options.counter % level.every) === 0 || !options[doneKey]++){ Console[level.type](options.prefix, options[level.name + '_message']); }
        return;
    }

    if(options.always){
        if(typeof options.always_callback === 'function'){ await options.always_callback(options.counter); }
        if((options.counter % options.always) === 0){ Console[options.always_type || 'log'](options.prefix, options.always_message); }
    }
}

async function stat(_path){
    try {
        return await fs.promises.stat(_path);
    }
    catch(e){
        return false;
    }
}

async function folderExists(_path, notSilence){
    try {
        let _stat = await stat(_path);
        return _stat ? _stat.isDirectory() : false;
    }
    catch(e){
        if(notSilence){
            Console.error('Folder not found:', e.message);
        }
        return false;
    }
}

async function fileExists(_path, notSilence){
    try {
        await fs.promises.access(_path, fs.constants.F_OK);
        return true;
    }
    catch(e){
        if(notSilence){
            Console.error('File not found:', e.message);
        }
        return false;
    }
}

async function createFolder(_path, options){
    try {
        await fs.promises.mkdir(_path, options);
    }
    catch(e){
        Console.error('Cannot create directory:', _path);
        throw e;
    }
}

async function deleteFile(_path, silence){
    try {
        await fs.promises.unlink(_path);
    }
    catch(e){
        if(!silence){
            Console.error('Cannot delete file:', _path);
            throw e;
        }
    }
}

function executionLocked(asyncFn){
    const run = executionLock.then(asyncFn);
    // A failed execution must reach its own caller but never break the queue for the next ones.
    executionLock = run.catch(function(e){
        Console.error('Execution locked error:', e.message);
    });
    return run;
}

async function writeFile(_path, content, silence){
    try {
        await fs.promises.writeFile(_path, content);
    }
    catch(e){
        if(!silence){
            Console.error('Cannot write file:', _path);
            throw e;
        }
    }
}

async function readFile(_path, silence){
    try {
        return await fs.promises.readFile(_path, 'utf8');
    }
    catch(e){
        if(!silence){
            Console.error('Cannot read file:', _path);
            throw e;
        }
    }
    return '';
}

async function createMainFolders(){
    if(!await folderExists(coreFolder)){
        await createFolder(coreFolder);
    }
}

function paintArguments(args, color){
    const argsArray = Array.from(args);

    if(!chalk[color]){ return argsArray; }

    const paintedArgs = argsArray.map(function(arg){
        if(typeof arg === 'string'){
            return chalk[color](arg);
        }
        return arg;
    });

    return paintedArgs;
};

function setConsoleFunctions(){
    Console.log = function(){
        if(!silentModeON){ console.log(...paintArguments(arguments, 'white')); }
    };
    Console.info = function(){
        if(!silentModeON){ console.info(...paintArguments(arguments, 'cyan')); }
    };
    Console.warn = function(){
        if(!silentModeON){ console.warn(...paintArguments(arguments, 'yellow')); }
    };
    Console.error = function(){
        console.error(...paintArguments(arguments, 'red'));
    };
    Console.green = function(){
        console.log(...paintArguments(arguments, 'green'));
    };
    Console.blue = function(message){
        console.info(chalk.bold.rgb(0, 78, 155)(message));
    };
}

function printVersion(){
    Console.green(DXServerVersion);
    process.exit(0);
}

function printAvailableModes(isHelp){
    const flags = Object.keys(availableModesDescription);
    const width = Math.max(...flags.map(function(flag){ return flag.length; }));
    const lines = flags.map(function(flag){ return '  ' + flag.padEnd(width + 2) + availableModesDescription[flag]; });

    // Usage output is never silenced and goes to stderr when it is the result of an error.
    console[isHelp ? 'log' : 'error'](['Available server modes:'].concat(lines).join('\n'));
    process.exit(isHelp ? 0 : 1);
}

function closeConnectedWithHotReload(ip){
    if(Object.hasOwn(connectedWithHotReload, ip)){
        clearInterval(connectedWithHotReload[ip].messages_interval);
        clearInterval(connectedWithHotReload[ip].heartbeat_interval);
        writeToSubscribers(connectedWithHotReload[ip], 'update', false);
        delete connectedWithHotReload[ip];
    }
}

function initializeConnectedIP(object, req, defaultConfig){
    const token = Buffer.from(decodeB64(req.query[DXTokenName]));
    const expectedToken = Buffer.from(DXTokenValue);
    if(token.length !== expectedToken.length || !crypto.timingSafeEqual(token, expectedToken)){
        throw new Error('Request not authenticated.');
    }

    let ip = cleanIPFrom(decodeB64(req.query[DXIPName]));
    if(!Object.hasOwn(tryToRedirect, ip)){
        closeConnectedWithHotReload(ip);
        throw new Error('IP not registered or precached request: ' + ip);
    }
    object[ip] = object[ip] || Object.assign({}, defaultConfig);
    object[ip].time = Date.now();
    if(!object[ip].connections){
        object[ip].connections = new Set();
    }

    return ip;
}

function ignoredOnWatching(_path){
    if(_path === browserOpenReferenceFilePath){ return true; }

    const segments = String(_path).split(/[\\/]+/);
    for(const rule of customIgnoredOnWatching){
        if(rule instanceof RegExp){
            if(rule.test(_path)){ return true; }
        }
        else if(segments.includes(rule)){
            return true;
        }
    }

    return false;
}

function startWatching(targets, fn, options, error){
    let debounce;
    let watcher = chokidar.watch(targets, Object.assign({ depth: fileWatchingSubFoldersDepth, persistent: true, ignored: ignoredOnWatching }, options || {}));
    watcher.on('all', function(event, _path){
        clearTimeout(debounce);
        debounce = setTimeout(function(){
            fn(event, _path);
        }, 100);
    });
    if(typeof error === 'function'){
        watcher.on('error', function(){
            watcher.close();
            error(watcher);
        });
    }
}

function filesWatching(targets, fn, options){
    if(!chokidar){ chokidar = require('chokidar'); }
    startWatching(targets, fn, options, function(){
        Console.error('Default watcher failed. Retrying...');
        startWatching(targets, fn, options, function(){
            Console.error('Using polling instead. NOT AVAILABLE COMMANDS: "--watch", "--watch-command".');
            clearInterval(watcherInterval);
            watcherInterval = setInterval(function(){ fn(null, null); }, pollingInterval);
        });
    });
}

function normalizeClient(object){
    return ((object.ip === localhostIPv6 || object.ip === localhostIP || object.ip === localhost) ? localhost : object.ip || localhost);
}

function writeToAllSubscribers(subscribers, message, mode){
    for(let subscriber of Object.keys(subscribers)){
        writeToSubscribers(subscribers[subscriber], message, mode);
    }
}

function writeToSubscribers(subscribers, message, mode){
    if(subscribers.connections){
        subscribers.connections.forEach(function(connection){
            writeToSubscriber(connection, message, subscribers.connections, mode);
        });
    }
}

function writeToSubscriber(connection, message, connections, mode){
    if(connection.writableEnded || connection.destroyed){
        if(connections){ connections.delete(connection); }
        return false;
    }
    try {
        connection.write(`data: ` + String(message) + `\n\n`);
        if(mode !== false){ return true; }
    }
    catch(e){
        Console.warn('Write to connection error:', e.message);
    }

    if(connections){
        connection.end();
        connections.delete(connection);
    }

    return false;
}

async function loadOpen(){
    try {
        open = require('open').default;
    }
    catch(e){
        try {
            open = (await import('open')).default;
        }
        catch(e){
            open = function(url){ Console.error('Cannot be opened:', url); };
        }
    }
}

async function cleanBuiltStateFiles(){
    if(!silentModeON){
        clearTimeout(cleanBuiltStateFilesTimeout);
        cleanBuiltStateFilesTimeout = setTimeout(function(){ Console.info('Cleaning...'); }, 5000);
    }
    //await deleteFile(builtReferenceFilePath + builtReferenceFileStdoutExt, true);
    await deleteFile(builtReferenceFilePath, true);
    await deleteFile(errorReferenceFilePath, true);
}

async function deleteOldStateFiles(){
    if(!await isRecentFile(builtReferenceFilePath)){
        await deleteFile(builtReferenceFilePath + builtReferenceFileStdoutExt, true);
        await deleteFile(builtReferenceFilePath, true);
    }

    if(!await isRecentFile(errorReferenceFilePath)){
        await deleteFile(errorReferenceFilePath, true);
    }

    if(!await dateInsideFileIsRecent(browserOpenReferenceFilePath)){
        await deleteFile(browserOpenReferenceFilePath, true);
    }
}

function decodeB64(string){
    if(typeof string !== 'string'){ return ''; }
    return Buffer.from(string, 'base64').toString('utf8');
}

function encodeB64(string){
    return Buffer.from(String(string), 'utf8').toString('base64');
}

function cleanIPFrom(ip){
    return normalizeClient({ ip: (!ip ? localhost : String(ip).slice(0, 128).replace(/'/g, '')) });
}

function commaSeparatedKeywordsList(keywords, format){
    keywords = keywords.trim().replace(/^[\s,]+|[\s,]+$/g, '').split(/\s*,+\s*/).filter(Boolean);
    switch(format){
        case 'regexp':
            keywords.forEach(function(keyword, index){
                try {
                    keyword = new RegExp(keyword);
                    keywords[index] = keyword;
                }
                catch(e){
                    Console.warn('This watch ignore entry cannot be RegExp:', e.message);
                }
            });
            break;
    }
    return keywords;
}

function addSubscriberConnection(ip, res, connectionsMap){
    connectionsMap[ip].connections.add(res);
    res.on('error', function(e){
        Console.warn('Connection stream error:', e.message);
        connectionsMap[ip].connections.delete(res);
    });
}

async function initDxServerModes(){
    await loadOpen();
    await createMainFolders();
    await deleteOldStateFiles();

    Console.info('Server mode:', (prodModeON ? prodMode : devMode) + (builtModeON ? ' ' + builtMode : ''));

    const helmet = require('helmet');
    const cspDirectives = devModeON ? {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "*"]
    } : {};
    // Upgrading the requests to HTTPS breaks a server that only listens on HTTP (for example "--prod" on a LAN IP).
    if(!SSLModeON){ cspDirectives['upgrade-insecure-requests'] = null; }
    app.use(helmet({
        contentSecurityPolicy: noCSPModeON ? false : { directives: cspDirectives },
        // HSTS is remembered by the browser for the whole host ("localhost" on every port): only for real HTTPS deployments.
        strictTransportSecurity: (SSLModeON && prodModeON) ? {} : false
    }));

    // Compression must be registered before any handler that ends the response.
    if(prodModeON){
        const compression = require('compression');
        app.use(compression());
    }

    const cors = require('cors');
    const corsMiddleware = cors({ origin: (corsOrigins.length && !corsOrigins.includes('*')) ? corsOrigins : true, credentials: true });
    const internalEndpoints = [updateStatusEndpoint, startUpdatesStatusEndpoint, langEndpoint, dxClientEndpoint];
    app.use(function(req, res, next){
        // Internal endpoints are same-origin only: other sites must not read their responses (the client token).
        if(internalEndpoints.includes(req.path)){ return next(); }
        corsMiddleware(req, res, next);
    });
    app.use(express.json({ limit: langJSONLimit }));

    if(devModeON){
        let statusHandlerMessage = 'Connect to "' + localhost + '"';

        let statusHandlerWritesConfig = {
            prefix: chalk.bold('Notice:'),

            fast: 10,
            fast_message: statusHandlerMessage,

            always: 2,
            always_message: statusHandlerMessage,
            always_type: 'warn'
        };

        let statusWritesConfig = {
            prefix: startUpdatesStatusEndpoint,

            last: 40,
            last_message: 'Frontend build error.',
            last_callback: async function(){
                await writeFile(errorReferenceFilePath, Date.now() + '');
            },

            very_slow: 30,
            very_slow_message: 'Frontend cannot connect...',

            slow: 20,
            slow_message: 'Frontend connecting is taking extremely long...',

            normal: 10,
            normal_message: 'Frontend connecting is taking too long...',

            fast: 5,
            fast_message: 'Frontend connecting... Something slow...',

            first: 1,
            first_message: 'Frontend connecting...',
        };

        connectedWithHotReload[localhost] = {
            time: Date.now(),
            ...statusHandlerWritesConfig
        };

        app.get(startUpdatesStatusEndpoint, async function(req, res){
            let connectedIP;
            try {
                connectedIP = initializeConnectedIP(connectedWithHotReload, req, statusHandlerWritesConfig);
                addSubscriberConnection(connectedIP, res, connectedWithHotReload);
            }
            catch(e){
                Console.error(startUpdatesStatusEndpoint, 'error:', e.message);
                return res.status(400).end();
            }

            if(!connectedWithHotReload[connectedIP].heartbeat_interval){ writeSlowly(statusWritesConfig); }
            else { connectedWithHotReload[connectedIP].counter = 0; }

            await writeFile(browserOpenReferenceFilePath, Date.now() + '', true);
            res.status(200).end();
        });

        let lastInodeReference;
        let lastStatusReference;
        let firstErrorReference;
        let lastErrorReference;
        let lastMessageErrorReference;
        let builtErrorReference;

        async function disconnectionWatcher(watcherEvent){
            for(let ip of Object.keys(connectedWithHotReload)){
                let ipLastTimeConnected = connectedWithHotReload[ip].time;
                let timeDiffing = Date.now() - ipLastTimeConnected;
                let builtIndexFile = await fileExists(entryPointFilePath);
                let fromPollingCallback = (!watcherEvent && !builtIndexFile);
                let fromWatcherCallback = (watcherEvent && (timeDiffing > checkingTimeSinceDisconnection) && !builtIndexFile);

                if(fromPollingCallback || fromWatcherCallback){
                    if(typeof connectedWithHotReload[ip].fast_callback !== 'function'){
                        connectedWithHotReload[ip].fast_callback = function(){
                            if(connectedWithHotReload[ip].connections && connectedWithHotReload[ip].connections.size > 0){
                                writeToSubscribers(connectedWithHotReload[ip], updateState);
                            }
                            else {
                                openBrowser(getLocalhostURL(), true);
                                connectedWithHotReload[ip].time = Date.now();
                            }
                        };
                    }
                    if(fromPollingCallback){
                        writeSlowly(connectedWithHotReload[ip]);
                    }
                    else {
                        connectedWithHotReload[ip].messages_counter = 0;
                        clearInterval(connectedWithHotReload[ip].messages_interval);
                        connectedWithHotReload[ip].messages_interval = setInterval(function(){
                            if(connectedWithHotReload[ip].messages_counter++ > 10){
                                return clearInterval(connectedWithHotReload[ip].messages_interval);
                            }
                            writeSlowly(connectedWithHotReload[ip]);
                        }, pollingInterval);
                    }
                }
                else {
                    connectedWithHotReload[ip].counter = 0;
                    if(builtIndexFile){
                        connectedWithHotReload[ip].time = Date.now();
                        await cleanBuiltStateFiles();
                    }
                }
            }
        }

        async function buildingWatcher(watcherEvent, _path){
            try {
                if(noBundlerModeON && _path){
                    return writeToAllSubscribers(connectedWithHotReload, updateState);
                }

                let errorReference = await fileExists(errorReferenceFilePath);
                if(errorReference){
                    errorReference = (await readFile(errorReferenceFilePath)).toString();
                    if(errorReference){
                        throw new Error(errorReference);
                    }
                }

                let builtReference = await fileExists(builtReferenceFilePath);
                if(builtReference){
                    builtErrorReference = (await readFile(builtReferenceFilePath)).toString();
                    if(builtErrorReference === compilationState){
                        throw new Error('Building...');
                    }
                    else if(builtErrorReference !== builtState){
                        throw new Error('Build error.');
                    }
                    else {
                        Console.info('Build finished.');
                        await cleanBuiltStateFiles();
                    }
                }

                let indexReference = await stat(versionReferenceFilePath);
                if(indexReference){
                    let status = (lastInodeReference === indexReference.mtimeMs ? lastInodeReference : updateState);
                    lastStatusReference = status;
                    lastInodeReference = indexReference.mtimeMs;
                    writeToAllSubscribers(connectedWithHotReload, status);
                }
            }
            catch(e){
                let message = e.message;
                let secondSinceLastError = (lastErrorReference - firstErrorReference);

                switch(e.code){
                    case 'ENOENT':
                        message = e.message;
                        writeToAllSubscribers(connectedWithHotReload, 'file-missing');
                        break;
                    default:
                        writeToAllSubscribers(connectedWithHotReload, builtErrorReference || startingState);
                }

                let isSamePreviousMessage = (message === lastMessageErrorReference && builtErrorReference);
                if((!firstErrorReference || secondSinceLastError > (isSamePreviousMessage ? builtStateLongTime : builtStateDefaultTime))){
                    Console.warn(updateStatusEndpoint, message);
                    firstErrorReference = Date.now();
                }

                lastErrorReference = Date.now();
                lastMessageErrorReference = message;
            }
        }

        const filesAndFoldersToWatch = [coreFolder, publicFolder, entryPointFilePath, customMiddlewareFilePath];
        if (watchModeON) {
            filesAndFoldersToWatch.push(watchFolder);
        }

        filesWatching(filesAndFoldersToWatch, async function(watcherEvent, _path){
            executeWatchCommand(watcherEvent, _path);
            await disconnectionWatcher(watcherEvent);
            await buildingWatcher(watcherEvent, _path);
        });

        app.get(updateStatusEndpoint, async function(req, res){
            let connectedIP;
            try {
                connectedIP = initializeConnectedIP(connectedWithHotReload, req, statusHandlerWritesConfig);
                addSubscriberConnection(connectedIP, res, connectedWithHotReload);
            }
            catch(e){
                Console.error(updateStatusEndpoint, 'error:', e.message);
                return res.status(400).end();
            }

            setEventsHeaders(res);
            await writeFile(browserOpenReferenceFilePath, Date.now() + '', true);

            clearInterval(connectedWithHotReload[connectedIP].heartbeat_interval);
            connectedWithHotReload[connectedIP].heartbeat_interval = setInterval(function(){
                // Heartbeat for every open tab of this client (not only the last connection).
                writeToSubscribers(connectedWithHotReload[connectedIP], Date.now());
            }, heartbeatIntervalTime);

            writeToSubscribers(connectedWithHotReload[connectedIP], '1');

            req.on('close', async function(){
                if(lastStatusReference === updateState){
                    Console.info(updateStatusEndpoint, 'Frontend reloaded.');
                }
                else if(lastStatusReference){
                    Console.info(updateStatusEndpoint, 'Frontend interaction.');
                }
                Console.info(updateStatusEndpoint, 'Frontend reconnected.');
                connectedWithHotReload[connectedIP].connections.delete(res);
                res.end();
            });
        });

        app.post(langEndpoint, async function(req, res){
            // This endpoint writes to disk: only same-origin requests addressed to a trusted host name are accepted.
            // Browsers always send "Origin" on POST: requests without it (scripts, curl) are only accepted from this machine.
            const fromThisMachineOrBrowser = !!req.headers.origin || isLoopbackAddress(req.socket.remoteAddress);
            if(!fromThisMachineOrBrowser || !isSameOriginRequest(req) || !isTrustedHostHeader(req.headers.host)){
                Console.error(langEndpoint, 'Cross-origin request or untrusted host rejected.');
                return res.status(403).end();
            }

            const body = req.body;
            if(!body || typeof body !== 'object' || typeof body.dir !== 'string' || typeof body.code !== 'string' || !body.keys || typeof body.keys !== 'object' || Array.isArray(body.keys)){
                Console.error(langEndpoint, 'Body required: { dir: string, code: string, keys: object }.');
                return res.status(400).end();
            }

            const dirName = path.basename(path.normalize(body.dir));
            const codeName = path.basename(path.normalize(body.code));
            if(!isPortableFileName(dirName) || !isPortableFileName(codeName)){
                Console.error(langEndpoint, 'Invalid "dir" or "code".');
                return res.status(400).end();
            }

            const folderToSave = path.join(langFolder, dirName);
            const fileToSave = path.join(folderToSave, codeName + '.json');

            if(!isInside(langFolder, fileToSave)){
                Console.error(langEndpoint, 'Path outside of the lang folder rejected.');
                return res.status(403).end();
            }

            Console.log(langEndpoint, body.dir, body.code);

            try {
                const result = await executionLocked(async function(){
                    let previousKeys = {};

                    if(await fileExists(fileToSave)){
                        try {
                            previousKeys = JSON.parse((await readFile(fileToSave)).toString() || '{}');
                        }
                        catch(e){
                            return { status: 409, message: 'The existing file is not a valid JSON: ' + e.message };
                        }

                        if(!previousKeys || typeof previousKeys !== 'object' || Array.isArray(previousKeys)){
                            return { status: 409, message: 'The existing file is not a JSON object.' };
                        }
                    }

                    // Existing keys can be edited or kept, but never removed.
                    const missingKeys = Object.keys(previousKeys).filter(function(key){ return !Object.hasOwn(body.keys, key); });
                    if(missingKeys.length){
                        return { status: 400, message: 'Trying to save less keys than the original file. Missing keys: ' + missingKeys.length + '. Current total keys: ' + Object.keys(previousKeys).length + '.' };
                    }

                    if(!await folderExists(folderToSave)){
                        await createFolder(folderToSave, { recursive: true });
                    }

                    // Write to a temporary file and rename it: the target file is never left half written.
                    const temporaryFile = fileToSave + '.tmp';
                    try {
                        await writeFile(temporaryFile, JSON.stringify(body.keys));
                        await fs.promises.rename(temporaryFile, fileToSave);
                    }
                    catch(e){
                        await deleteFile(temporaryFile, true);
                        throw e;
                    }

                    return { status: 200, total: Object.keys(body.keys).length };
                });

                if(result.status !== 200){
                    Console.error(langEndpoint, result.message);
                    return res.status(result.status).end();
                }

                Console.info(langEndpoint, 'Saved keys:', result.total);
                return res.status(200).end();
            }
            catch(e){
                Console.error(langEndpoint, 'Error:', e.message);
                return res.status(500).end();
            }
        });
    }

    app.get(dxClientEndpoint, function(req, res){
        setDefaultHeaders(res, 'text/javascript');
        return res.status(200).send(prodModeON ? dxProdModeScript() : dxDevModeScript(req.ip));
    });

    const customMiddlewareFoundOnStart = await fileExists(customMiddlewareFilePath);
    if(customMiddlewareFoundOnStart){
        Console.info('Loading custom middleware from:', customMiddlewareFileName);
    }

    app.use(function(req, res, next){
        if(req.path.startsWith('/dx-')){
            return next();
        }

        // On DEV mode the file can be created, changed or removed without restarting the server.
        if(!(devModeON ? fs.existsSync(customMiddlewareFilePath) : customMiddlewareFoundOnStart)){
            return next();
        }

        let nextCalled = false;
        const safeNext = function(error){
            nextCalled = true;
            return next(error);
        };
        const recover = function(e){
            Console.error('Custom middleware error:', e.message);
            if(!nextCalled && !res.headersSent){
                nextCalled = true;
                next();
            }
        };

        try {
            // Clean cache to Hot-Reload the middleware if Dev mode is ON
            if(devModeON){
                delete require.cache[require.resolve(customMiddlewareFilePath)];
            }

            const userMiddleware = require(customMiddlewareFilePath);

            if(typeof userMiddleware !== 'function'){
                return next();
            }

            const result = userMiddleware(req, res, safeNext);
            if(result && typeof result.then === 'function'){
                result.then(undefined, recover);
            }
        }
        catch(e){
            recover(e);
        }
    });

    // When the public folder contains the project root (e.g. "--public ."), DX Server internal files are never served.
    if(isInside(publicFolder, coreFolder) || isInside(publicFolder, customMiddlewareFilePath)){
        app.use(function(req, res, next){
            if(req.method !== 'GET' && req.method !== 'HEAD'){ return next(); }

            let requestedPath;
            try {
                requestedPath = decodeURIComponent(req.path);
            }
            catch(e){
                return next();
            }

            const requestedFile = path.join(publicFolder, requestedPath);
            if(isInside(coreFolder, requestedFile) || isInside(customMiddlewareFilePath, requestedFile)){
                return sendFallback(req, res);
            }
            next();
        });
    }

    function clearIPFromControlMap(clearLimit){
        clearLimit = (clearLimit === true) ? 1 : (isNaN(clearLimit) ? (tryToRedirectOverflowIPsCount >= 2 ? Math.round(tryToRedirectOverflowIPsCount / 2) : 0) : clearLimit);
        let deletedIPs = 0;

        for(let ip in tryToRedirect){
            if(deletedIPs >= clearLimit){ break; }
            delete tryToRedirect[ip];
            tryToRedirectIPsCount--;
            deletedIPs++;
        }

        tryToRedirectOverflowIPsCount -= deletedIPs;
        tryToRedirectOverflowIPsCount = Math.max(0, tryToRedirectOverflowIPsCount);
        tryToRedirectIPsCount = Math.max(0, tryToRedirectIPsCount);
    }

    function entryPointUnavailablePage(ipFrom, errorReference){
        const attempts = tryToRedirect[ipFrom];
        const message = errorReference ? 'Build error: ' + escapeHTML(errorReference.slice(0, 64) + ' ...') : (attempts > 10 ? 'Connecting entry point (' + attempts + ') ...' : 'Trying to connect entry point (' + attempts + ') ...');
        return `
<!DOCTYPE html>
<html>
<head>
${dxDefaultHTMLHead(ipFrom)}
</head>
<body>${DXServer}<br>${message}<br><br>( ${escapeHTML(entryPointFilePath)} )</body>
</html>
`;
    }

    let entryPointTimestamp;
    app.use(async function(req, res, next){
        if(req.method !== 'GET' && req.method !== 'HEAD'){
            return next();
        }

        const ext = path.extname(req.path).toLowerCase();

        // Only browser navigations (explicit "text/html" in Accept) are routed to the entry point; "fetch" and "XHR" calls (Accept: */*) are not.
        // Assets never reach the IPs control below, so they are always served.
        const isHTML = ext === '' || ext === '.html' || ext === '.htm';
        if(!isHTML || !requestAcceptsHTMLDocument(req)){
            return next();
        }

        const ipFrom = cleanIPFrom(req.ip);

        if(tryToRedirectIPsCount > connectedIPsFromLimit){
            tryToRedirectOverflowIPsCount++;
            clearIPFromControlMap(true);
            return res.status(503).end();
        }

        if(!Object.hasOwn(tryToRedirect, ipFrom)){
            tryToRedirect[ipFrom] = 0;
            tryToRedirectIPsCount++;
        }

        if(req.path !== '/' && req.path !== '/' + entryPointFileName){
            let requestedPath;
            try {
                requestedPath = decodeURIComponent(req.path);
            }
            catch(e){
                return next();
            }

            const htmlFilePath = path.join(publicFolder, requestedPath);
            if(isInside(publicFolder, htmlFilePath)){
                const htmlFileStat = await stat(htmlFilePath);
                if(htmlFileStat && htmlFileStat.isFile()){
                    // Existing files without HTML extension, and any file on PROD (nothing to inject), go to the static handler.
                    if(ext === '' || prodModeON){
                        return next();
                    }

                    setDefaultHeaders(res, 'text/html');

                    const htmlContent = (await readFile(htmlFilePath)).toString();
                    return res.status(200).send(injectDxClientScript(htmlContent));
                }
            }
        }

        try {
            const currentEntryPointStat = await stat(entryPointFilePath);
            if(!currentEntryPointStat){ throw new Error('Cannot verify entry point stat.'); }
            setDefaultHeaders(res, 'text/html');
            if(!entryPointCache || (currentEntryPointStat.mtimeMs !== entryPointTimestamp)){
                entryPointTimestamp = currentEntryPointStat.mtimeMs;
                entryPointCache = injectDxClientScript((await readFile(entryPointFilePath)).toString());
                cleanBuiltStateFiles();
            }
            return res.status(200).send(entryPointCache);
        }
        catch(e){
            tryToRedirect[ipFrom]++;
            entryPointCache = '';
            entryPointTimestamp = 0;
            const errorReference = (await readFile(errorReferenceFilePath, true)).toString();
            return res.status(404).send(entryPointUnavailablePage(ipFrom, errorReference));
        }
    });

    // Client script cannot be injected on HTML Express statics, because of that goes after the injector middleware.
    app.use(express.static(publicFolder, prodModeON ? { maxAge: maxAgeCache, etag: true, lastModified: true } : { maxAge: maxAgeCache, etag: false }));

    app.use(sendFallback);

    // Errors (invalid JSON bodies, failing custom middleware...) are logged, never sent to the client with their stack trace.
    app.use(function(e, req, res, next){
        const errorStatus = Number(e.status || e.statusCode);
        const status = (Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus < 600) ? errorStatus : 500;
        Console[status >= 500 ? 'error' : 'warn']('Request error:', req.method, req.path, status, e.message);
        if(res.headersSent){ return next(e); }
        return res.status(status).end();
    });

    let certFile;
    let certKey;
    if(SSLModeON){
        const customCertificates = !!(serverSSLCert && serverSSLKey);

        try {
            certFile = await readFile(customCertificates ? path.join(serverSSLCert) : path.join(certsFolder, certFileName), true);
            certKey = await readFile(customCertificates ? path.join(serverSSLKey) : path.join(certsFolder, certKeyFileName), true);
            if(!certFile || !certKey){
                throw new Error('Cannot read certificate files.');
            }
        }
        catch(e){
            if(customCertificates){
                Console.error('Error trying to use your SSL certificates:', e.message);
                process.exit(1);
            }

            Console.error('SSL mode is ON but certificates was not found on:');
            Console.error('- Cert file expected path:', path.join(certsFolder, certFileName));
            Console.error('- Key file expected path:', path.join(certsFolder, certKeyFileName));

            certFile = '';
            certKey = '';
        }

        const renewCertificates = !customCertificates && !!certFile && certificateIsExpiring(certFile);
        if(renewCertificates){
            Console.warn('The self signed SSL certificate is expired or about to expire.');
        }

        if(!certFile || !certKey || renewCertificates){
            Console.info('Trying to create self signed certificates:');
            try {
                let certificates = await ensureCertificatesAndCA(renewCertificates);
                if(certificates){
                    certFile = certificates.cert;
                    certKey = certificates.key;
                }
                else {
                    throw new Error('Issue with MKCERT.');
                }
            }
            catch(e){
                Console.error('Error trying to create/use self signed certificates:', e.message);
                process.exit(1);
            }
        }
    }

    try {
        await stopPortProcess();

        protocol = SSLModeON ? 'https://' : 'http://';
        server = (SSLModeON ? https.createServer({ cert: certFile, key: certKey }, app) : app).listen(port, networkExposedTo, dxServerReadyOn);
    }
    catch(e){
        dxServerNotReady(e);
        process.exit(1);
    }

    server.on('error', function(e){
        let closeAndExit = true;

        if(e.code === 'EADDRINUSE'){
            Console.error('Server PORT IN USE.');
        }
        else if(e.code === 'EADDRNOTAVAIL'){
            Console.error('Server ADDRESS NOT AVAILABLE.');
        }
        else if(e.code === 'EACCES'){
            Console.error('Server PORT requires elevated privileges. Use a port above 1024 (e.g. "--port 8080").');
        }
        else {
            closeAndExit = false;
        }

        if(closeAndExit){
            server.close();
            process.exit(1);
        }

        Console.error('Server error detected:', e.message);
    });
}

function identifyPositionToInjectClient(html){
    let tag = '</html>';
    let position = html.lastIndexOf(tag);
    if(position === -1){
        tag = '</HTML>';
        position = html.lastIndexOf(tag);
    }
    if(position === -1){ return -1; }
    if(/\S/.test(html.slice(position + tag.length))){ return -1; }
    return { position, tag };
}

function injectDxClientScript(html){
    if(prodModeON){ return html; } // The client script only exists on DEV mode.

    let dxClientScript = "\n" + '<!--' + DXClient + ' Injected Script -->' + "\n" + '<script src="' + dxClientEndpoint + '"></script>' + "\n";
    let canInject = identifyPositionToInjectClient(html);
    return canInject === -1 ? (html + dxClientScript) : (html.slice(0, canInject.position) + dxClientScript + canInject.tag);
}

function setDefaultHeaders(res, contentType){
    if(devModeON){
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    if(contentType){ res.setHeader('Content-Type', contentType); }
}

const ingest = {
    buffer: '',
    lastDataTime: 0,
    errorKeyword: false,
    lastState: '',
    stdoutTimeout: undefined,
    writeQueue: Promise.resolve()
};

function ingestEnqueue(asyncFn){
    ingest.writeQueue = ingest.writeQueue.then(asyncFn).catch(function(e){
        Console.error('Ingesting error:', e.message);
    });
    return ingest.writeQueue;
}

function startIngestion(){
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function(chunk){
        if(!silentModeON){ process.stdout.write(chunk); } // The piped process output is not swallowed.
        ingestChunk(chunk);
    });

    process.stdin.on('end', function(){
        Console.info('Ingestion end.');
        flushIngestedStdout();
    });

    process.stdin.resume();
}

function flushIngestedStdout(){
    clearTimeout(ingest.stdoutTimeout);
    ingest.stdoutTimeout = undefined;
    const snapshot = ingest.buffer;
    return ingestEnqueue(function(){ return writeFile(builtReferenceFilePath + builtReferenceFileStdoutExt, snapshot); });
}

function ingestChunk(chunk){
    const now = Date.now();

    // Output after a quiet period belongs to a new build cycle: an old error must not stick forever.
    if((now - ingest.lastDataTime) > ingestQuietGapTime){
        ingest.errorKeyword = false;
    }
    ingest.lastDataTime = now;

    // Only the new data is analyzed (plus a short tail, so keywords split between two chunks are found).
    const tail = ingest.buffer.slice(-ingestOverlapLength);
    ingest.buffer += chunk;
    if(ingest.buffer.length > ingestChunksLimit){ ingest.buffer = ingest.buffer.slice(ingestChunksLimit * -1); }

    const analysis = analyzeChunks(tail + chunk, tail.length);

    if(analysis.confirm){
        ingest.errorKeyword = false;
    }
    else if(analysis.error){
        ingest.errorKeyword = analysis.error;
    }

    const state = ingest.errorKeyword ? errorState : builtState;
    const errorKeyword = ingest.errorKeyword;

    ingestEnqueue(async function(){
        await writeFile(builtReferenceFilePath, state);
        await writeFile(errorReferenceFilePath, errorKeyword || '');
    });

    clearTimeout(ingest.stdoutTimeout);
    ingest.stdoutTimeout = setTimeout(flushIngestedStdout, ingestStdoutWriteDelay);

    if(state !== ingest.lastState || analysis.error || analysis.confirm){
        ingest.lastState = state;
        Console.warn(DXServer, 'Build result:', state);
        if(state === errorState){
            Console.warn('Error keyword detected:', errorKeyword);
        }
        else if(analysis.confirm){
            Console.warn('Confirm keyword detected:', analysis.confirm);
        }
        else {
            Console.warn('NOT DETECTED error keywords.');
        }
    }
}

function searchInChunks(text, keyword, minEnd){
    let expression;
    try {
        expression = new RegExp(keyword, 'gi');
    }
    catch(e){
        expression = new RegExp(String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    }

    let match;
    while((match = expression.exec(text)) !== null){
        if(match[0] === ''){
            expression.lastIndex++;
            continue;
        }
        // Matches that end inside the already analyzed tail were detected before.
        if((match.index + match[0].length) > (minEnd || 0)){ return true; }
    }

    return false;
}

function analyzeChunks(text, analyzedLength){
    let error = false;
    for(let keyword of builtIngestErrorKeywordsList){
        if(searchInChunks(text, keyword, analyzedLength)){
            error = keyword;
            break;
        }
    }

    let confirm = false;
    for(let keyword of builtIngestConfirmKeywordsList){
        if(searchInChunks(text, keyword, analyzedLength)){
            confirm = keyword;
            break;
        }
    }

    return { error, confirm };
}

function splitCommand(command){
    const parts = [];
    const expression = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match;
    while((match = expression.exec(command)) !== null){
        parts.push(typeof match[1] !== 'undefined' ? match[1] : (typeof match[2] !== 'undefined' ? match[2] : match[3]));
    }
    return parts;
}

function startWatchCommandOnly(){
    if(!watchCommandModeON){
        if(watchModeON){ Console.warn('Ingest only mode: "--watch" has no effect without "--watch-command".'); }
        return;
    }

    Console.info('Watching (ingest only):', watchFolder);
    filesWatching([watchFolder], function(event, _path){
        executeWatchCommand(event, _path);
    });
}

function executeWatchCommand(event, _path){
    if(!watchCommandModeON || !event || !_path){ return; }

    if(isInside(watchFolder, _path)){
        clearTimeout(watchCommandTimeout);
        watchCommandTimeout = setTimeout(async function(){
            Console.info('Watch command execution START:', watchCommand);
            try {
                stopWatchCommand();
                let watchCommandArgs = splitCommand(watchCommand);
                if(!watchCommandArgs[0] || watchCommandArgs[0].length > 128){
                    throw new Error('Invalid resulting watch command: "' + watchCommandArgs[0] + '".');
                }

                // Detached (POSIX) makes the command the leader of its own process group, so it can be stopped with all its children.
                const spawnOptions = { detached: process.platform !== 'win32', windowsHide: true };
                const child = shellModeON ?
                    spawn(watchCommand, Object.assign({ shell: true }, spawnOptions)) :
                    spawn(watchCommandArgs[0], watchCommandArgs.slice(1), Object.assign({ shell: false }, spawnOptions));
                watchCommandReference = child;

                child.on('error', function(e){
                    Console.error('Watch command execution ERROR:', watchCommand, '>', e.message);
                    if(!shellModeON){
                        Console.warn('Use "--shell" for shell commands, pipelines, or scripts like "npm" on Windows.');
                    }
                });

                child.stderr.setEncoding('utf8');
                child.stderr.on('data', function(stderr){
                    Console.warn('Watch command stderr:', watchCommand, '>', (stderr.length > 128 ? stderr.slice(0, 125) + '...' : stderr));
                });

                child.stdout.setEncoding('utf8');
                child.stdout.on('data', function(stdout){
                    Console.info('Watch command stdout:', watchCommand, '>', (stdout.length > 128 ? stdout.slice(0, 125) + '...' : stdout));
                });

                child.on('close', function(){
                    Console.warn('Watch command execution END:', watchCommand);
                });
            }
            catch(e){
                Console.error('Watch command execution ERROR:', watchCommand, '>', e.message);
            }
        }, watchCommandTimeoutTime);
    }
}

function getLocalhostURL(){
    let portSuffix = (port === 80 || port === 443) ? '' : ':' + port;
    return protocol + localhost + portSuffix;
}

function dxDevModeConnector(){
    if(prodModeON){ return ''; }
    return `fetch('${startUpdatesStatusEndpoint}?${DXTokenName}=' + dxToken + '&${DXIPName}=' + dxIP, { method: 'HEAD', mode: 'same-origin', cache: 'no-store' });`;
}

function dxDefaultHTMLHead(ip){
    return `
    <meta http-equiv="refresh" content="${(Math.ceil(entryPointConnectReloadInterval/1000) * 2)}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: "Courier New", Courier, monospace; font-size: 0.9rem; font-weight: normal; }
        html, body { height: 100%; width: 100%; }
        body { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1rem; }
    </style>
    <script>
        /*
        ${DXClient}
        */
        ${dxSetAuthVariables(ip)}
        ${dxDevModeConnector()}
        var reloadTimeout;
        var reload = function(){ reloadTimeout = setTimeout(function(){ location.reload(); }, ${entryPointConnectReloadInterval}); };
        window.addEventListener('online', reload);
        window.addEventListener('offline', function(){ clearTimeout(reloadTimeout); });
        reload();
    </script>
`;
}

function dxDevFrontendMode(){
    if(!frontendModeON){ return ''; }

    return `
    /*
    ${DXClient} "${frontendMode}": ${availableModesDescription[frontendMode]}
    */

    // Object.hasOwn polyfill
    if(!Object.hasOwn){
        Object.hasOwn = function(obj, prop){
            return Object.prototype.hasOwnProperty.call(obj, prop);
        };
    }

    // Promise.prototype.finally polyfill
    if(typeof Promise !== 'undefined' && !Promise.prototype.finally){
        Promise.prototype.finally = function(callback){
            var P = this.constructor;
            return this.then(
                function(value){ return P.resolve(callback()).then(function(){ return value; }); },
                function(reason){ return P.resolve(callback()).then(function(){ throw reason; }); }
            );
        };
    }

    // AbortController fallback (a no-op controller when AbortController is not available)
    var abortControllerId = 0;
    var abortControllers = {};
    function createSafeAbortController(){
        var id = ++abortControllerId;
        if(typeof AbortController !== 'undefined'){
            var controller = new AbortController();
            abortControllers[id] = controller;
            return { controller: controller, id: id };
        }
        return { controller: { signal: undefined, abort: function(){} }, id: id };
    }

    console.info('${DXClient}', 'Console errors interceptor/wrapper.');

    var originalError = console.error;
    console.error = function(){
        var args = Array.prototype.slice.call(arguments);
        var firstArg = args[0];

        originalError.apply(console, args);

        if(firstArg && typeof firstArg === 'object'){
            var haveSomething = firstArg.name || firstArg.message || firstArg.code || firstArg.stack || null;
            if(haveSomething){
                var details = {
                    name: firstArg.name || 'unknown',
                    message: firstArg.message || 'no message',
                    code: firstArg.code || 'no code',
                    stack: firstArg.stack || 'no stack'
                };
                originalError.apply(console, ['${DXClient}', 'Interception details:', JSON.stringify(details)]);
            }
        }
    };

    console.info('${DXClient}', 'Fetch interceptor/wrapper.');

    var fetchMessageTimeout;
    var originalFetch = window.fetch;
    if(typeof originalFetch === 'function'){
        window.fetch = function(resource, options){
            // Requests that already have a signal (own options, or a Request object) keep their own cancellation.
            if((typeof Request !== 'undefined' && resource instanceof Request) || (options && typeof options.signal !== 'undefined')){
                return originalFetch(resource, options);
            }

            var init = {};
            if(options){ for(var key in options){ if(Object.hasOwn(options, key)){ init[key] = options[key]; } } }

            var safe = createSafeAbortController();
            if(safe.controller.signal){ init.signal = safe.controller.signal; }

            var timeoutId = setTimeout(function(){ safe.controller.abort(); }, ${DXServerClientFetchTimeout});
            var clearAbortAndTimeout = function(){
                clearTimeout(timeoutId);
                delete abortControllers[safe.id];
                clearTimeout(fetchMessageTimeout);
                fetchMessageTimeout = setTimeout(function(){ console.warn('${DXClient}', 'DEV mode: aborts fetches exceeding ${DXServerClientFetchTimeout}ms. Use a custom fetch signal to override this timeout.'); }, 5000);
            };

            var fetchPromise = originalFetch(resource, init);
            // Both handlers are given: the derived promise never rejects, so no extra "unhandledrejection" is produced.
            fetchPromise.then(clearAbortAndTimeout, clearAbortAndTimeout);

            return fetchPromise;
        };
    }

    beforeReloadFunctions.push(function(){
        console.info('${DXClient}', 'Aborting fetch requests...');
        for(var id in abortControllers){ if(Object.hasOwn(abortControllers, id)){ abortControllers[id].abort(); } }
        abortControllers = {};
    });

    /*
    ${DXClient} "${frontendMode}" END
    */
`;
}

function dxProdModeScript(){
    return `/*
${DXClient} PROD mode.
*/`;
}

function dxDevModeScript(ip){
    return `/*
${DXClient} DEV mode.
*/

(function DXClient(){

    if(typeof window !== 'object' || !window){ return; }

    if(typeof window['DXClient'] === 'function' && String(window['DXClient']) === String(DXClient)){
        console.error('${DXClient}', 'Already another instance running.');
        return;
    }

    try {
        window['DXClient'] = DXClient;
    }
    catch(e){
        console.warn('${DXClient}', 'Cannot set instance.');
    }

    var beforeReloadFunctions = [];
${dxDevFrontendMode()}
    ${dxSetAuthVariables(ip)}
    ${dxDevModeConnector()}
    var updateTimeout;
    var updateStatus = new EventSource('${updateStatusEndpoint}?${DXTokenName}=' + dxToken + '&${DXIPName}=' + dxIP);
    updateStatus.onmessage = function(event){
        var isNotNumeric = isNaN(Number(event.data));
        if(isNotNumeric){
            console.info('${DXClient}', 'Received:', event.data);
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(function(){
                var fn = beforeReloadFunctions.length;
                while(fn--){
                    if(typeof beforeReloadFunctions[fn] === 'function'){
                        beforeReloadFunctions[fn](event.data);
                    }
                }
                console.info('${DXClient}', 'Reloading...');
                window.location.reload();
            }, ${entryPointStateTimeToUpdate});
            return;
        }
        console.log('${DXClient}', 'Heartbeat:', event.data);
    };

})();`;
}

function dxSetAuthVariables(ip){
    return `var dxToken = '${encodeB64(DXTokenValue)}', dxIP = '${encodeB64(ip)}';`;
}

function setEventsHeaders(res){
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
}

function dxServerReadyOn(){
    Console.info('LISTENING on port:', port, 'exposed to the network:', '"' + networkExposedTo + '"');

    if(devModeON && !isLoopbackAddress(networkExposedTo)){
        Console.warn('DEV mode is reachable from the network: its endpoints can write files. Use "--network 127.0.0.1" to restrict it to this machine, or "--prod" for deployments.');
    }

    openBrowser(getLocalhostURL());
}

function dxServerNotReady(error){
    Console.error('NOT READY on port:', port);
    Console.error('Because:', error);
}
