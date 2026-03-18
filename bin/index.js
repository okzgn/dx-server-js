#!/usr/bin/env node

/*
    DX Server
    A development server and build tool for frontend applications with hot-reloading and SPA support.

    License: MIT
    Copyright (c) 2026 OKZGN
*/

const DXServer = 'DX Server';
const DXServerVersion = '2.2.0';

const [major, minor] = process.versions ? process.versions.node.split('.') : [0, 0];
if((major < 18) || (major == 18 && minor < 3)){
    console.error(DXServer, 'Not supported environment.');
    process.exit(1);
}

const Console = {};
const chalk = require('chalk');
setConsoleFunctions();

process.on('uncaughtException', function(e){
    console.error(chalk.red(DXServer), chalk.red('Uncaught exception.'));
    console.error(chalk.red('Error details:'), e.message);
    console.error(e);
    process.exit(1);
});

Console.blue(DXServer);

const availableModes = [
    '--dev',
    '--prod',
    '--no-ssl',
    '--ssl',
    '--built',
    '--no-kill',
    '--silent',
    '--ingest',
    '--shell',
    '--frontend',
];

const devMode = availableModes[0];
const prodMode = availableModes[1];
const noSSLMode = availableModes[2];
const SSLMode = availableModes[3];
const builtMode = availableModes[4];
const noKillMode = availableModes[5];
const silentMode = availableModes[6];
const ingestMode = availableModes[7];
const shellMode = availableModes[8];
const frontendMode = availableModes[9];

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

const defaultIgnoredOnWatching = ['node_modules', /^[\\\/]?\./];
let customIgnoredOnWatching = [];

const minIngestChunksLimit = 1024;
const defaultIngestChunksLimit = 1048576;
let ingestChunksLimit = defaultIngestChunksLimit;

const minLangJSONLimit = ((1024 * 5));
const defaultLangJSONLimit = ((1024 * 1024) * 1); // JSON of 1000 keys (1 to 64 bytes) and values (2 to 256 bytes) = 330 Kb. max.
let langJSONLimit = defaultLangJSONLimit;

const defaultNetworkExposedTo = '::';
let networkExposedTo = defaultNetworkExposedTo;

const minMaxAgeCache = (1000 * 60);
const defaultMaxAgeCache = (minMaxAgeCache * 60 * 24 * 1);
let maxAgeCache = defaultMaxAgeCache;

const fallbackFileName = '404.html';
let fallbackStatus = 404;
let fallbackFilePath = path.join(publicFolder, fallbackFileName);

let connectedWithHotReload = {};

let tryToRedirect = {};
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
availableModesDescription[ingestMode] = 'ENABLE ONLY ingestion for another process stdout, without server listen. Useful for "--watch-command".';
availableModesDescription[shellMode] = 'ENABLE "--watch-command" execution as shell mode.';
availableModesDescription[frontendMode] = 'ENABLE some backwards compatibility and patches native frontend functions to implement global "fetch" timeouts and aborts (to avoid browser freeze with a lot of fetches) and ensure "console.error" outputs strings (for platforms with limited object inspection capabilities).';
availableModesDescription['--frontend-fetch-timeout <number>'] = 'Set the timeout in milliseconds for the client fetch interceptor. Defaults to ' + DXServerClientFetchTimeout + '.';
availableModesDescription['--ingest-limit <number>'] = 'Set the total bytes limit of chunks retained for analysis. Defaults to ' + defaultIngestChunksLimit + '.';
availableModesDescription['--built-confirm-keywords <string>'] = 'Set a comma-separated list of keywords used to identify and confirm errors succesful build ingestion process.';
availableModesDescription['--built-error-keywords <string>'] = 'Set a comma-separated list of keywords used to identify errors during the build ingestion process.';
availableModesDescription['--cert <file_path>'] = 'Set custom SSL cert file.';
availableModesDescription['--key <file_path>'] = 'Set custom SSL key file.';
availableModesDescription['--root <folder_path>'] = 'Set the project root directory. Defaults to "' + mainFolder + '".';
availableModesDescription['--public <folder_path>'] = 'Set custom public folder to serve.';
availableModesDescription['--lang <folder_path>'] = 'Set custom lang folder for saving.';
availableModesDescription['--watch <folder_path>'] = 'Add an extra directory for the hot-reload watcher to observe.';
availableModesDescription['--watch-ignore <string>'] = 'Set a comma-separated list of files or folders to be ignored on watching. Defaults to [' + (defaultIgnoredOnWatching.map(function(element){ return (typeof element === 'string' ? '"' + element + '"' : String(element)) })).join(', ') + ']';
availableModesDescription['--watch-depth <number>'] = 'Set limits how many levels of subdirectories will be traversed for watching. Defaults to ' + defaultFileWatchingSubFoldersDepth + '.';
availableModesDescription['--watch-command <cli_command>'] = 'Set a CLI command to execute when the "--watch" folder has change.';
availableModesDescription['--watch-command-timeout <number>'] = 'Set the debounce timeout in milliseconds for the "--watch-command" execution. Defaults ' + defaultWatchCommandTimeoutTime + '.';
availableModesDescription['--network <ip>'] = 'Set the network interface address (IPv4 or IPv6) that the server will bind to. Defaults to "' + defaultNetworkExposedTo + '".';
availableModesDescription['--cache <number>'] = 'Set the "maxAge" in milliseconds for static files caching (not for "index.html"). Defaults to "' + defaultMaxAgeCache + '".';
availableModesDescription['--fallback <file_path>'] = 'Define the fallback file to be served when no route or static file matches the request.';

setArgsAndDefaultConfig();

let mkcert;
let chokidar;
const express = require('express');
const https = require('https');
const app = express();

const entryPointFileName = 'index.html';
const entryPointFilePath = path.join(publicFolder, entryPointFileName);

const localhost = 'localhost';
const localhostIP = '127.0.0.1';
const localhostIPv6 = '::1';
const versionReferenceFile = 'index.html';
const versionReferenceFilePath = path.join(publicFolder, versionReferenceFile);

const builtReferenceFile = '_built.tmp';
const builtReferenceFileStdoutExt = '.stdout';
const builtReferenceFilePath = path.join(coreFolder, builtReferenceFile);
const errorReferenceFile = '_error.tmp';
const errorReferenceFilePath = path.join(coreFolder, errorReferenceFile);
const browserOpenReferenceFile = '_browserOpen.tmp';
const browserOpenReferenceFilePath = path.join(coreFolder, browserOpenReferenceFile);

const updateStatusEndpoint = '/dx-update';
const startUpdatesStatusEndpoint = '/dx-start-update';
const langEndpoint = '/dx-lang';
const dxClientEndpointFileName = 'dx-client.js';
const dxClientEndpoint = '/' + dxClientEndpointFileName;

const certFileName = 'cert.crt';
const certKeyFileName = 'cert.key';

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

let executionLock = Promise.resolve();
let entryPointCache = '';
let cleanBuiltStateFilesTimeout;
let watchCommand = '';
let watchCommandTimeout;
let watchCommandReference;

const DXClient = 'DX Client';
const DXIPName = 'dx-ip';
const DXTokenName = 'dx-token';
const DXTokenValue = (Math.random() * Date.now()) + '';

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
                    type: 'string',
                    default: '80'
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
                    type: 'string',
                    default: fallbackFilePath
                },
                shell: {
                    type: 'boolean'
                },
                frontend: {
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
        Console.error('Args error:', e.message);
        printAvailableModes();
    }

    if(args.version){
        printVersion();
    }

    if(args.help){
         printAvailableModes(true);
    }

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

    if(args.port){
        port = Number(args.port);
        if(SSLModeON && port === 80){ port = 443; }
        if(!SSLModeON && port === 443){ port = 80; }
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
        }
        else {
            Console.error('Cannot set ROOT/CWD folder.');
        }
    }

    if(args.public){
        if(await folderExists(args.public, true)){
            publicFolder = path.resolve(args.public);
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
            Console.warn('WATCH folder doesn\'t exists, watcher will be trigger if created.');
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
        const net = require('net');
        networkExposedTo = net.isIP(args.network) != 0 ? args.network : defaultNetworkExposedTo;
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

        if(await fileExists(resolvedFallback) && resolvedFallback.startsWith(publicFolder)){
            let statusByBasename = Number(path.basename(resolvedFallback).split('.'));
            if(!isNaN(statusByBasename) && statusByBasename > 199 && statusByBasename < 600){ fallbackStatus = statusByBasename; }
            fallbackFilePath = resolvedFallback;
        }
        else {
            fallbackFilePath = '';
        }
    }
}

(async function main(){

await createMainFolders();

switch(serverMode){
    case builtMode:
        try {
            await cleanBuiltStateFiles();
            await writeFile(builtReferenceFilePath, compilationState);
            await writeFile(errorReferenceFilePath, '');
            
            process.stdin.setEncoding('utf8');

            let chunks = '';
            process.stdin.on('data', async function(chunk){
                chunks += chunk;
                if(chunks.length > ingestChunksLimit){ chunks = chunks.slice(ingestChunksLimit * -1); }

                Console.info('Ingesting data chunk...');
                await analizeChunks(chunks);
                chunks = chunks.slice(Math.round(ingestChunksLimit / 4) * -1); // Prevent data loss without concatenation of previous last string parts.
            });

            process.stdin.on('end', async function(){
                Console.info('Ingestion end.');
                await analizeChunks(chunks);
                chunks = '';
            });

            process.stdin.resume();
        }
        catch(e){
            Console.error('Ingestion error:', e.message);
        }

        if(!ingestModeON){
            await initDxServerModes();
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
        Console.green('Available modes:', availableModesDescription);
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

function stopWatchCommand(){
    try {
        if(watchCommandReference){
            Console.info('Stopping watch command execution...');
            watchCommandReference.kill();
        }
    }
    catch(e){
        Console.error('Stopping watch command execution error:', e.message);
    }
}

async function openBrowser(localhostURL, bypass){
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

async function ensureCertificatesAndCA(){
    if(!SSLModeON){
        Console.info('SSL disabled, skipping certificate generation.');
        return;
    }

    if(!mkcert){ mkcert = require('mkcert'); }

    const crtPath = path.join(certsFolder, certFileName);
    const keyPath = path.join(certsFolder, certKeyFileName);

    try {
        if(await fileExists(keyPath) && await fileExists(crtPath)){
            Console.info('SSL certificates already exist. Skipping generation.');
            return;
        }

        Console.info('Generating SSL certificates...');

        if(!await fileExists(certsFolder)){
            await createFolder(certsFolder, { recursive: true });
        }

        Console.info('Deleting previous cert and key files.')
        await deleteFile(crtPath, true);
        await deleteFile(keyPath, true);

        const CA = await mkcert.createCA({
            organization: 'OKZGN',
            countryCode: 'EC',
            state: 'Pichincha',
            locality: 'Quito',
            validityDays: 365 * 3
        });

        Console.info('MKCERT CA installation ensured.');

        const cert = await mkcert.createCert({
            domains: [localhost],
            validity: 365,
            ca: CA
        });

        Console.info('Certificate for "' + localhost + '" generated.');

        await writeFile(crtPath, cert.cert);
        await writeFile(keyPath, cert.key);

        Console.log('Self signed SSL certificates generated.');
        Console.log('Cert path:', keyPath);
        Console.log('Key path:', crtPath);

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

async function writeSlowly(options){
    if(typeof options.counter === 'undefined'){
        options.counter = 0;
    }

    options.counter++

    let isTimeToConsoleInfoAlways = (options.counter % (options.always || 1)) === 0;
    let isTimeToConsoleInfoFirst = (options.counter % 2) === 0;
    let isTimeToConsoleInfoFast = (options.counter % 4) === 0;
    let isTimeToConsoleInfoNormal = (options.counter % 6) === 0;
    let isTimeToConsoleInfoSlow = (options.counter % 8) === 0;
    let isTimeToConsoleInfoVerySlow = (options.counter % 10) === 0;
    let isTimeToConsoleInfoLast = (options.counter % 12) === 0;
    
    if(options.last && options.counter > options.last){
        if(typeof options.last_callback === 'function'){ await options.last_callback(); }
        if(typeof options.last_callback_done === 'undefined'){ options.last_callback_done = 0; }
        if(isTimeToConsoleInfoLast || !options.last_callback_done++){ Console.error(options.prefix, options.last_message); }
    }
    else if(options.very_slow && options.counter > options.very_slow){
        if(typeof options.very_slow_callback === 'function'){ await options.very_slow_callback(); }
        if(typeof options.very_slow_callback_done === 'undefined'){ options.very_slow_callback_done = 0; }
        if(isTimeToConsoleInfoVerySlow || !options.very_slow_callback_done++){ Console.error(options.prefix, options.very_slow_message); }
    }
    else if(options.slow && options.counter > options.slow){
        if(typeof options.slow_callback === 'function'){ await options.slow_callback(); }
        if(typeof options.slow_callback_done === 'undefined'){ options.slow_callback_done = 0; }
        if(isTimeToConsoleInfoSlow || !options.slow_callback_done++){ Console.warn(options.prefix, options.slow_message); }
    }
    else if(options.normal && options.counter > options.normal){
        if(typeof options.normal_callback === 'function'){ await options.normal_callback(); }
        if(typeof options.normal_callback_done === 'undefined'){ options.normal_callback_done = 0; }
        if(isTimeToConsoleInfoNormal || !options.normal_callback_done++){ Console.warn(options.prefix, options.normal_message); }
    }
    else if(options.fast && options.counter > options.fast){
        if(typeof options.fast_callback === 'function'){ await options.fast_callback(); }
        if(typeof options.fast_callback_done === 'undefined'){ options.fast_callback_done = 0; }
        if(isTimeToConsoleInfoFast || !options.fast_callback_done++){ Console.info(options.prefix, options.fast_message); }
    }
    else if(options.first && options.counter){
        if(typeof options.first_callback === 'function'){ await options.first_callback(); }
        if(typeof options.first_callback_done === 'undefined'){ options.first_callback_done = 0; }
        if(isTimeToConsoleInfoFirst || !options.first_callback_done++){ Console.log(options.prefix, options.first_message); }
    }
    else if(options.always){
        if(typeof options.always_callback === 'function'){ await options.always_callback(options.counter); }
        if(isTimeToConsoleInfoAlways){ Console[options.always_type || 'log'](options.prefix, options.always_message); }
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
    executionLock = executionLock.then(async function(){
        try {
            await asyncFn();
        }
        catch(e){
            Console.error('Execution locked error:', e.message);
            throw e;
        }
    });
    return executionLock;
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

async function createMainSubFolders(){
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

function printAvailableModes(mode){
    let _mode = mode === false;
    Console[_mode ? 'warn' : 'info']('Available server modes:', availableModesDescription);
    process.exit(_mode ? 1 : 0);
}

function closeConnectedWithHotReload(ip){
    if(ip in connectedWithHotReload){
        clearInterval(connectedWithHotReload[ip].messages_interval);
        clearInterval(connectedWithHotReload[ip].heartbeat_interval);
        writeToSuscribers(connectedWithHotReload[ip], 'update', false);
        delete connectedWithHotReload[ip];
    }
}

function initializeConnectedIP(object, req, defaultConfig){
    let token = decodeB64(req.query[DXTokenName]);
    if(!token || (token !== DXTokenValue)){
        throw new Error('Request not authenticated.');
    }

    let ip = cleanIPFrom(decodeB64(req.query[DXIPName]));
    if(!(ip in tryToRedirect)){
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

function filesWatching(targets, fn, options){
    if(!chokidar){ chokidar = require('chokidar'); }
    let debounce;
    let watcher = chokidar.watch(targets, Object.assign({ depth: fileWatchingSubFoldersDepth, persistent: true }, options || { ignored: customIgnoredOnWatching }));
    
    watcher.on('all', function(event, _path){
        clearTimeout(debounce);
        debounce = setTimeout(function(){
            fn(event, _path);
        }, 100);
    });

    let watcherInterval;
    watcher.on('error', function(){
        watcher.close();
        Console.error('Default watcher failed, using polling instead. NOT AVAILABLE COMMANDS: "--watch", "--watch-command".');
        clearInterval(watcherInterval);
        watcherInterval = setInterval(function(){ fn(null, null); }, pollingInterval);
    });
}

function normalizeClient(object){
    return ((object.ip === localhostIPv6 || object.ip === localhostIP || object.ip === localhost) ? localhost : object.ip || localhost);
}

function writeToAllSuscribers(suscribers, message, mode){
    for(let suscriber of Object.keys(suscribers)){
        writeToSuscribers(suscribers[suscriber], message, mode);
    }
}

function writeToSuscribers(suscribers, message, mode){
    if(suscribers.connections){
        suscribers.connections.forEach(function(connection){
            writeToSuscriber(connection, message, suscribers.connections, mode);
        });
    }
}

function writeToSuscriber(connection, message, connections, mode){
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
            open = function(url){ Console.error('Cannot be opened:', url); }
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
    return Buffer.from(string, 'base64').toString('utf8')
}

function encodeB64(string){
    return Buffer.from(String(string), 'utf8').toString('base64');
}

function cleanIPFrom(ip, mode){
    return normalizeClient({ ip: (!ip ? localhost : String(ip).slice(0, 128).replace(/'/g, '')) });
}

function commaSeparatedKeywordsList(keywords, format){
    keywords = keywords.replace(/^,+\s*|\s*,+$/, '').split(/\s*,+\s*/);
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

async function initDxServerModes(){
    await loadOpen();
    await createMainSubFolders();
    await deleteOldStateFiles();

    Console.info('Server mode:', serverMode);

    const helmet = require('helmet');
    const helmetConfig = {};
    if(devModeON){
        helmetConfig.contentSecurityPolicy = {
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "'unsafe-inline'"],
                "style-src": ["'self'", "'unsafe-inline'"],
                "img-src": ["'self'", "data:", "blob:"],
                "connect-src": ["'self'", "*"]
            }
        };
    }
    app.use(helmet(helmetConfig));

    const cors = require('cors');
    app.use(cors({ origin: true, credentials: true }));

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

        filesWatching(entryPointFilePath, async function(watcherEvent){
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
                                writeToSuscribers(connectedWithHotReload[ip], updateState);
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
        });

        connectedWithHotReload[localhost] = {
            time: Date.now(),
            ...statusHandlerWritesConfig
        }

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

        app.get(startUpdatesStatusEndpoint, async function(req, res){
            let connectedIP;
            try {
                connectedIP = initializeConnectedIP(connectedWithHotReload, req, statusHandlerWritesConfig);
                connectedWithHotReload[connectedIP].connections.add(res);
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
        let foldersToWatch = [coreFolder, publicFolder, watchFolder];
        filesWatching(foldersToWatch, async function(event, _path){
            executeWatchCommand(event, _path);

            try {
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
                    writeToAllSuscribers(connectedWithHotReload, status);
                }
            }
            catch(e){
                let message = e.message;
                let secondSinceLastError = (lastErrorReference - firstErrorReference);

                switch(e.code){
                    case 'ENOENT':
                        message = e.message;
                        writeToAllSuscribers(connectedWithHotReload, 'file-missing');
                    break;
                    default:
                        writeToAllSuscribers(connectedWithHotReload, builtErrorReference || startingState);
                }

                let isSamePreviousMessage = (message === lastMessageErrorReference && builtErrorReference);
                if((!firstErrorReference || secondSinceLastError > (isSamePreviousMessage ? builtStateLongTime : builtStateDefaultTime))){
                    Console.warn(updateStatusEndpoint, message);
                    firstErrorReference = Date.now();
                }

                lastErrorReference = Date.now();
                lastMessageErrorReference = message;
            }
        }, { ignored: [browserOpenReferenceFilePath, ...customIgnoredOnWatching ] });

        app.get(updateStatusEndpoint, async function(req, res){
            let connectedIP;
            try {
                connectedIP = initializeConnectedIP(connectedWithHotReload, req, statusHandlerWritesConfig);
                connectedWithHotReload[connectedIP].connections.add(res);
            }
            catch(e){
                Console.error(updateStatusEndpoint, 'error:', e.message);
                return res.status(400).end();
            }

            setEventsHeaders(res);
            await writeFile(browserOpenReferenceFilePath, Date.now() + '', true);

            clearInterval(connectedWithHotReload[connectedIP].heartbeat_interval);
            connectedWithHotReload[connectedIP].heartbeat_interval = setInterval(function(){
                writeToSuscriber(res, Date.now());
            }, heartbeatIntervalTime);

            writeToSuscribers(connectedWithHotReload[connectedIP], '1');

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
            if(!req.body){
                res.status(400).end();
                Console.error(langEndpoint, 'Body required.');
                return;
            }

            Console.log(langEndpoint, req.body.dir, req.body.code);

            try {
                let folderToSave = path.join(langFolder, path.basename(path.normalize(req.body.dir)));
                let fileToSave = path.join(folderToSave, path.basename(path.normalize(req.body.code)) + '.json');
                
                if(!fileToSave.startsWith(path.resolve(langFolder))){
                    res.status(403).end();
                    return;
                }

                await executionLocked(async function(){
                    let previousKeys = (await readFile(fileToSave)).toString() || '{}';
                    if(previousKeys){
                        try {
                            previousKeys = JSON.parse(previousKeys);
                            let totalPreviousKeys = Object.keys(previousKeys).length;
                            let newTargetKeys = Object.keys(req.body.keys);
                            let totalTargetKeys = newTargetKeys.length;

                            if(totalTargetKeys < totalPreviousKeys){
                                res.status(400).end();
                                throw new Error('Trying to save less keys than the original file:', totalTargetKeys + '.', 'Current total keys:', totalPreviousKeys);
                            }
                            else {
                                let keysDifference = totalTargetKeys - totalPreviousKeys;
                                let existentKeys = 0;

                                for(let newKey of newTargetKeys){
                                    if(req.body.keys[newKey] === previousKeys[newKey]){
                                        existentKeys++;
                                    }
                                }

                                let realDifference = totalTargetKeys - existentKeys;
                                let errorDifference = keysDifference - realDifference;
                                if(keysDifference !== realDifference){
                                    throw new Error('Target keys and original keys was compared and "' + errorDifference + '" doesn\'t match.');
                                }

                                if(!await folderExists(folderToSave)){
                                    await createFolder(folderToSave, { recursive: true });
                                }

                                if(!await fileExists(fileToSave)){
                                    await writeFile(fileToSave, '{}');
                                }

                                await writeFile(fileToSave, JSON.stringify(req.body.keys));
                                Console.info(langEndpoint, 'Saved keys:', newTargetKeys.length);
                            }
                        }
                        catch(e){
                            Console.error(langEndpoint, 'JSON file parse error:', e.message);
                        }
                    }
                });
            }
            catch(e){
                Console.error(langEndpoint, 'Error:', e.message);
            }

            res.status(200).end();
        });
    }

    app.get(dxClientEndpoint, async function(req, res){
        setDefaultHeaders(res, 'text/javascript');

        if(prodModeON){
            return res.status(200).send(dxProdModeScript(req.ip));
        }

        return res.status(200).send(dxDevModeScript(req.ip));
    });

    function clearIPFromControlMap(clearLimit){
        clearLimit = (clearLimit === true) ? 1 : (isNaN(clearLimit) ? (tryToRedirectOverflowIPsCount >= 2 ? Math.round(tryToRedirectOverflowIPsCount / 2) : 0) : clearLimit);
        let deletedIPs = 0;

        for(let ip in tryToRedirect){
            if(Object.hasOwn(tryToRedirect, ip)){
                if(deletedIPs >= clearLimit){ break; }
                delete tryToRedirect[ip];
                tryToRedirectIPsCount--;
                deletedIPs++;
            }
        }

        tryToRedirectOverflowIPsCount -= deletedIPs;
        tryToRedirectOverflowIPsCount = Math.max(0, tryToRedirectOverflowIPsCount);
        tryToRedirectIPsCount = Math.max(0, tryToRedirectIPsCount);
    }

    let entryPointTimestamp;
    let currentEntryPointStat;
    app.use(async function(req, res, next){
        let ipFrom = cleanIPFrom(req.ip);

        if(tryToRedirectIPsCount > connectedIPsFromLimit){
            tryToRedirectOverflowIPsCount++;
            clearIPFromControlMap(true);
            return res.status(503).end();
        }

        if(typeof tryToRedirect[ipFrom] === 'undefined'){
            tryToRedirect[ipFrom] = 0;
            tryToRedirectIPsCount++;
        }

        let acceptsHTML = req.accepts('html');
        let acceptsResource = req.accepts(['image/*', 'css', 'js', 'json']);
        if(req.path !== '/' && req.path !== '/' + entryPointFileName && (acceptsResource || !acceptsHTML)){
            return next();
        }

        try {
            currentEntryPointStat = await stat(entryPointFilePath);
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
            let errorReference = (await readFile(errorReferenceFilePath, true)).toString();
            if(errorReference || tryToRedirect[ipFrom] > 10){
                return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
${dxDefaultHTMLHead(ipFrom)}
</head>
<body>${DXServer}<br>${ errorReference ? 'Build error: ' + (errorReference.slice(0, 64) + ' ...') : 'Connecting entry point (' + tryToRedirect[ipFrom] + ') ...' }<br><br>( ${entryPointFilePath} )</body>
</html>
`);
            }

            return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
${dxDefaultHTMLHead(ipFrom)}
</head>
<body>${DXServer}<br>Trying to connect entry point (${tryToRedirect[ipFrom]}) ...<br><br>( ${entryPointFilePath} )</body>
</html>
`);
        }
    });

    // Client script cannot be injected on HTML Express statics, because of that goes after the injector middleware.
    app.use(express.static(publicFolder, prodModeON ? { maxAge: maxAgeCache, etag: true, lastModified: true } : { maxAge: maxAgeCache, etag: false }));

    app.use(function(req, res){
        // 404 Fallback
        if(fallbackFilePath){
            setDefaultHeaders(res, 'text/html');
            return res.status(fallbackStatus).sendFile(fallbackFilePath);
        }
        return res.status(404).end();
    });

    if(prodModeON){
        const compression = require('compression');
        app.use(compression());
    }

    let certFile;
    let certKey;
    if(SSLModeON){
        try {
            certFile = await readFile(serverSSLCert ? path.join(serverSSLCert) : path.join(certsFolder, certFileName), true);
            certKey = await readFile(serverSSLKey ? path.join(serverSSLKey) : path.join(certsFolder, certKeyFileName), true);
            if(!certFile || !certKey){
                throw new Error('Cannot read certificate files.');
            }
        }
        catch(e){
            if(serverSSLCert && serverSSLKey){
                Console.error('Error trying to use your SSL certificates:', e.message);
                process.exit(1);
            }

            Console.error('SSL mode is ON but certificates was not found on:');
            Console.error('- Cert file expected path:', path.join(certsFolder, certFileName));
            Console.error('- Key file expected path:', path.join(certsFolder, certKeyFileName));

            Console.info('Trying to create self signed certificates:');
            try {
                let certificates = await ensureCertificatesAndCA();
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

        try {
            await stopPortProcess(port);

            protocol = 'https://';
            const httpsOptions = { cert: certFile, key: certKey };
            server = https.createServer(httpsOptions, app).listen(port, networkExposedTo, function(){
                dxServerReadyOn(port);
            });
        }
        catch(e){
            dxServerNotReady(e);
        }
    }
    else {
        try {
            await stopPortProcess(port);

            protocol = 'http://';
            server = app.listen(port, networkExposedTo, function(){
                dxServerReadyOn(port);
            });
        }
        catch(e){
            dxServerNotReady(e);
        }
    }

    server.on('error', function(e){
        let closeAndExit = true;

        if(e.code === 'EADDRINUSE'){
            Console.error('Server PORT IN USE.');
        }
        else if(e.code === 'EADDRNOTAVAIL'){
            Console.error('Server ADDRESS NOT AVAILABLE.');
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

function searchInChunks(chunks, keyword){
    try { keyword = new RegExp(keyword, 'i'); }
    catch(e){ }
    return chunks.search(keyword) !== -1;
}

async function analizeChunks(chunks){
    let _error = false;
    let _error_keywords = [];
    for(let keyword of builtIngestErrorKeywordsList){
        if(searchInChunks(chunks, keyword)){
            _error = keyword;
            break;
        }
        _error_keywords.push(keyword);
    }

    let _confirm = false;
    if(builtIngestConfirmKeywordsList.length){
        for(let keyword of builtIngestConfirmKeywordsList){
            if(searchInChunks(chunks, keyword)){
                _confirm = keyword;
                break;
            }
        }
    }

    let _state = (!_confirm && _error ? errorState : builtState);
    try {
        await writeFile(builtReferenceFilePath + builtReferenceFileStdoutExt, chunks);
        await writeFile(builtReferenceFilePath, _state);
        if(_error){
            await writeFile(errorReferenceFilePath, _error);
        }
    }
    catch(e){
        Console.error('Ingesting end error:', e.message);
    }

    Console.warn(DXServer, 'Build result:', _state);
    switch(_state){
        case errorState:
            Console.warn('Error keyword detected:', _error);
        break;
        case builtState:
            if(_confirm){
                Console.warn('Confirm keyword detected:', _confirm);
            }
            else {
                Console.warn('NOT DETECTED error keywords.');
            }
        break;
    }
}

function executeWatchCommand(event, _path){
    if(!_path || !watchCommandModeON){ return; }

    let absolutePathChanged = path.resolve(_path);
    let isInsideWatchFolder = absolutePathChanged.startsWith(path.resolve(watchFolder));

    if(isInsideWatchFolder){
        clearTimeout(watchCommandTimeout);
        watchCommandTimeout = setTimeout(async function(){
            Console.info('Watch command execution START:', watchCommand);
            try {
                stopWatchCommand();
                let watchCommandArgs = watchCommand.trim().split(/\s+/);
                if(!watchCommandArgs[0] || watchCommandArgs[0].length > 128){
                    throw new Error('Invalid resulting watch command: "' + watchCommandArgs[0] + '".');
                }

                if(shellModeON){
                    watchCommandReference = spawn(watchCommand, undefined, { shell: true });
                }
                else {
                    watchCommandReference = spawn(watchCommandArgs[0], (watchCommandArgs.length > 1 ? watchCommandArgs.slice(1) : undefined), { shell: false });
                }

                watchCommandReference.stderr.setEncoding('utf8');
                watchCommandReference.stderr.on('data', function(stderr){
                   Console.warn('Watch command stderr:', watchCommand, '>', (stderr.length > 128 ? stderr.slice(0, 125) + '...' : stderr));
                });

                watchCommandReference.stdout.setEncoding('utf8');
                watchCommandReference.stdout.on('data', function(stdout){
                    Console.info('Watch command stdout:', watchCommand, '>', (stdout.length > 128 ? stdout.slice(0, 125) + '...' : stdout));
                });

                watchCommandReference.on('close', function(){
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

    // AbortController polyfill
    var abortControllerId = 0;
    var abortControllers = {};
    function createSafeAbortController(){
        if(typeof AbortController !== 'undefined'){
            var id = ++abortControllerId;
            abortControllers[id] = new AbortController();
            return { controller: abortControllers[id], id: id };
        }
        // Fallback
        return { controller: { signal: undefined, abort: function(){} } };
    }

    console.info('${DXClient}', 'Console errors interceptor/wrapper.');

    var originalError = console.error;
    console.error = function(){
        var args = Array.prototype.slice.call(arguments);
        var firstArg = args[0];
        var haveSomething = firstArg.name || firstArg.message || firstArg.code || firstArg.stack || null;
        var details = {
            name: firstArg.name || 'unknown',
            message: firstArg.message || 'no message',
            code: firstArg.code || 'no code',
            stack: firstArg.stack || 'no stack'
        };

        originalError.apply(console, args);
        if(haveSomething){
            originalError.apply(console, ['${DXClient}', 'Interception details:', JSON.stringify(details)]);
        }
    };

    console.info('${DXClient}', 'Fetch interceptor/wrapper.');

    var fetchMessageTimeout;
    var originalFetch = window.fetch;
    window.fetch = function(URL, options){
        options = options || {};
        var timeoutId;
        var requestAbortController;
        var clearAbortAndTimeout = function(){};
        if(typeof options.signal === 'undefined'){
            requestAbortController = createSafeAbortController().controller;
            options.signal = requestAbortController.signal;
            timeoutId = setTimeout(requestAbortController.abort, ${DXServerClientFetchTimeout});
            clearAbortAndTimeout = function(){
                clearTimeout(timeoutId);
                delete abortControllers[requestAbortController.id];
                clearTimeout(fetchMessageTimeout);
                fetchMessageTimeout = setTimeout(function(){ console.warn('${DXClient}', 'DEV mode: aborts fetches exceeding ${DXServerClientFetchTimeout}ms. Use a custom fetch signal to override this timeout.'); }, 5000);
            };
        }

        var fetchPromise = originalFetch(URL, options);
        fetchPromise.finally(function(){ clearAbortAndTimeout(); });

        if(requestAbortController && requestAbortController.id && requestAbortController.signal.aborted){
            clearAbortAndTimeout();
        }

        return fetchPromise;
    }.bind(window);

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

function dxProdModeScript(ip){
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
    openBrowser(getLocalhostURL());
}

function dxServerNotReady(error){
    Console.error('NOT READY on port:', port);
    Console.error('Because:', error);
}