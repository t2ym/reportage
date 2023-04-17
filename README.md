[![npm version](https://badge.fury.io/js/reportage.svg)](https://badge.fury.io/js/reportage)

# reportage

[scenarist](https://github.com/t2ym/scenarist)-wrapped mocha sessions on browsers to any reporters

<p align="center">
  <img width="80%" src="https://raw.githubusercontent.com/wiki/t2ym/reportage/reportage-components.svg?sanitize=true">
  <p align="center">Component Diagram</p>
</p>

## Table of Contents

- [reportage](#reportage)
  - [Table of Contents](#table-of-contents)
  - [Motivation](#motivation)
  - [Key Characteristics](#key-characteristics)
  - [Getting Started](#getting-started)
  - [Install](#install)
  - [Run](#run)
  - [Reports](#reports)
  - [Components](#components)
    - [Reporter Server](#reporter-server)
    - [App Server](#app-server)
    - [Browser](#browser)
    - [Reporter Page](#reporter-page)
    - [Mediator](#mediator)
      - [`mediator-worker.js`](#mediator-workerjs)
      - [`mediator-bridge.html`](#mediator-bridgehtml)
      - [`mediator-worker-client.js`](#mediator-worker-clientjs)
    - [App Pages](#app-pages)
    - [`driver.js`](#driverjs)
    - [`sandbox-global.js`](#sandbox-globaljs)
    - [`proxy-reporter.js`](#proxy-reporterjs)
    - [Extension](#extension)
    - [`reportage` CLI](#reportage-cli)
    - [`reportage.config.js`](#reportageconfigjs)
    - [Other Configuration Files](#other-configuration-files)
      - [`resolved-paths.js`](#resolved-pathsjs)
      - [`nyc.config.mjs`](#nycconfigmjs)
      - [`nginx.conf`](#nginxconf)
    - [Suites](#suites)
      - [`suites-loader.js`](#suites-loaderjs)
      - [`mocha-loader.js`](#mocha-loaderjs)
      - [`scenarist-loader.js`](#scenarist-loaderjs)
      - [`common-suite.js`](#common-suitejs)
      - [Test Suites](#test-suites)
      - [Test Phases](#test-phases)
  - [ToDos](#todos)
  - [License](#license)

## Motivation

`reportage` is a general-purpose e2e web test runner while the key design goals include applicability to fortified [`thin-hook`](https://github.com/t2ym/thin-hook) applications

`thin-hook` applications must run in a top frame and detects unexpected intrusion into DOM and the global object except for the built-in automation interface that was originally designed for cache bundle generation

## Key Characteristics

| Features     | `reportage`  | `playwright` | `cypress`    |
|:------------:|:-------------|:-------------|:-------------|
| CLI          | optional     | mandatory    | mandatory    |
| Test Scripts | browser      | automation   | browser      |
| Target Frame | top frame    | top frame    | iframe       |

The table shows key architectural characteristics of `reportage` compared with common e2e test frameworks.  The main focus here is how to satisfy the prerequisites for the motivation, not the rich features of `playwright` and `cypress`.

## Getting Started

Steps to perform tests on an example project

```sh
# clone the reportage project from GitHub
git clone https://github.com/t2ym/reportage
# example project directory, which is excluded in the reportage npm package
cd reportage/examples 
# select an example project
cd vite-lit-ts-app 
# install dependencies 
# Note: the reportage npm package is installed from the local sources at ../.. in examples
npm i
# start reporter server at port 3000 (customizable)
npm run reporter:start
# start dev server with coverage support at port 3001 (customizable)
npm run dev:coverage
# switch to another terminal as the vite dev server is running in foreground
# CLI test
npm test
# open mochawesome and coverage reports
google-chrome http://localhost:3000/test/mochawesome-report/mochawesome.html \
  http://localhost:3000/coverage/index.html
```

For GUI test, follow the example project's [README](examples/vite-lit-ts-app/README.md)

## Install

```sh
npm i --save-dev reportage
```

## Run

```sh
reportage [config...]
```
The default config is [`test/reportage.config.js`](#reportageconfigjs)

## Reports

- Typical report paths, which are visible from [`Reporter Server`](#reporter-server)
  - `test/mochawesome-report/mochawesome.html` - Test report
  - `coverage/index.html` - Coverage report

## Components

### Reporter Server

| Features | Supported Configurations              | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | any (typically `localhost`)     | `localhost` or bound local address           |
| Port     | any (e.g. `3000`)               | normally unprivileged ports                  |
| Protocol | `http/https` v1.1, v2, v3       | security requirements must be met            |
| CORS     | `Access-Control-Allow-Origin *` | injected scripts are fetched via CORS        |
| Root     | project root                    | reportage and test suites must be accessible |

- Reporter server is a static web server that serves
  - HTML mocha reporter page (`reportage/reporter.html`) and
  - scenarist-wrapped mocha suites to app pages via CORS
- Typically, `nginx` with a local configuration works fine
  - See `npm run reporter:start` script in [`examples/vite-lit-ts-app`](examples/vite-lit-ts-app/README.md)
- Mochawesome HTML reporter and istanbul coverage reporter can be retrieved via the reporter server if so configured

### App Server

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | any (typically 0.0.0.0)         | 127.0.0.* or *.testdomain for concurrency    |
| Port     | any (e.g. `3001`)               | normally unprivileged ports                  |
| Protocol | `http/https` v1.1, v2, v3       | security requirements must be met            |
| Root     | any                             | any dev or dist server                       |

- App server serves the target application
  - For concurrent test execution, each tab must have a unique origin
  - So multiple origins must be supported
    - with tricky multi-origin IPv4 loopback addresses
      - like `http://127.0.0.*:3001/` or
    - with wildcard host names
      - like `https://www{n}.testdomain:3001/`, resolving to the same (or different) IP address
- If the server is static, the reporter server can serve as the app server as well
- If the application is heavy, each origin can be served by a dedicated separate server

### Browser

| Features   | Supported Configurations       | Notes                                        |
|:----------:|:-------------------------------|:---------------------------------------------|
| Extension  | `node_modules/reportage/extension/chrome/` | see [Extension](#extension)       |
| Automation | `puppeteer`                     | `playwright` might be supported in the future|
| Popup blocking | `--disable-popup-blocking`  | prerequisite for opening tabs                |
| IPC flooding | `--disable-ipc-flooding-protection` | prerequisite for stability             |
| PushState  | `--disable-pushstate-throttle` | prerequisite for stability                    |
| Timer      | `--disable-background-timer-throttling` | prerequisite for performance         |

- Browser must support
  - extension that can
    - inject a script into target applications and
    - clean up browser storages
  - automation with `puppeteer`
  - disabling of
    - popup blocking
    - IPC flooding protection
    - pushState throttle
    - background timer throttling
  - discrete user profiles for testing
    - since the configurations are inappropriate for ordinary browsing
- Most of Chromium-based browsers can be used such as
  - Chrome
  - Microsoft Edge
- It is recommended to set the following alias for GUI test
```sh
alias chrome='google-chrome --disable-ipc-flooding-protection --disable-pushstate-throttle --disable-background-timer-throttling --disable-popup-blocking '
```
- The above options are automatically set for `puppeteer` in `reportage` CLI
  - Even with the options, concurrent test execution may become unstable partially because of Chromium's hard-coded limitation of [`6`](https://chromium.googlesource.com/chromium/src/net/+/master/socket/client_socket_pool_manager.cc#51) concurrent socket connections per host 
  - Cache-first service workers or aggresive caching policies should be able to mitigate the side effects of this limitation

### Reporter Page

| Features | Supported Configurations        | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |
| Path     | `/node_modules/reportage/reporter.html` | reportage package directory          |
| Hash     | `#/test/reportage.config.js`    | path to configuration has to be set          |
| Module   | `/node_modules/reportage/reporter.js` | main module for the page               |
| Module   | `/node_modules/reportage/proxy-reporter.js` | mocha proxy reporter |

- Typical URLs
  - `http://localhost:3000/node_modules/reportage/reporter.html#/test/reportage.config.js`
    - configuration file path is specified
  - `http://localhost:3000/node_modules/reportage/reporter.html#/test/reportage.config.js?scope=basic`
    - target scope is specified
- Reporter page controls
  - opening, closing, and navigation of tabs running target applications
  - cleanup of browser storages
  - dispatching of test suites to the tabs
  - collection of test results and code coverages
  - aggregation of the results and the coverages
  - redirection of the aggregated results to
    - HTML reporter in the reporter page and
    - optionally reportage CLI via puppeteer
- The page also has a control panel that filters
  - target scope and
  - target test class
  - with "Start ▶" button to run the targeted suites
- The hash of the reporter page contains
  - path to reportage configuration file (typically `#/test/reportage.config.js`) and
  - [optional] target scope (`?scope={scope name}`)
  - [optional] target test index (`&testIndex={number}`)
  - [optional] target test class (`&testClass={testClassName}`)
  - [optional] target test step in a test scenario (`&testStep={number}`)
  - [optional] and other additional information (in the future)
- The hash values are reflected to the control panel
- The control panel values are reflected to the hash when the "Start ▶" button is clicked
- "Replay ▶" buttons of test results in HTML reporter also change the hash values when they are clicked

### Mediator

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |

- Mediator bridges cross-origin communication between reporter tab and app tabs with these 3 components
  - [`mediator-worker.js`](#mediator-workerjs) SharedWorker script
  - [`mediator-bridge.html`](#mediator-bridgehtml) that loads
  - [`mediator-worker-client.js`](#mediator-worker-clientjs)

#### `mediator-worker.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path     | `/node_modules/reportage/mediator-worker.js` | SharedWorker                    |

- `mediator-worker.js` is a `SharedWorker` that forwards messages via `MessagePort`
- Each message has a target page ID to determine which tab receives the message

#### `mediator-bridge.html`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path     | `/node_modules/reportage/mediator-bridge.html` | opened by app tabs            |

- `mediator-bridge.html` is opened by each app tab to execute `mediator-worker-client.js` in the reporter origin
  - The tabs persist during test execution

#### `mediator-worker-client.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path     | `/node_modules/reportage/mediator-worker-client.js` | loaded by `mediator-bridge.html` |

- `mediator-worker-client.js`
  - loads `mediator-worker.js` and
  - transfer a `MessagePort` instance to each app page,
  - which is the opener of `mediator-bridge.html`

### App Pages

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | app server host(s)              |                                              |
| Port     | app server port                 | normally unprivileged ports                  |
| Protocol | app server protocol             | security requirements must be met            |
| Path     | any                             | no restriction on paths                      |
| Modules  | any                             | no restriction on modules and scripts        |

- Each app page runs in a separate browsing context with a dedicated process
  - `driver.js` CORS script has to be injected so that [Reporter Page](#reporter-page) can perform test suites on the app

### `driver.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |
| Path     | `/node_modules/reportage/driver.js` | injected CORS module script              |
| Hash     | `#/test/reportage.config.js`    | path to configuration has to be set          |

- `driver.js` is injected to each app page to perform test suites on the app
  - Typical CORS URL is
    - `http://localhost:3000/node_modules/reportage/driver.js#/test/reportage.config.js`
  - `driver.js` opens `mediator-bridge.html` tab to establish communication path to the reporter page

### `sandbox-global.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |
| Path     | `/node_modules/reportage/sandbox-global.js` |                                  |

- `sandbox-global.js` provides a sandbox object for `mocha` and `scenarist`
  - Functions and classes like `describe`, `it`, `Suite` are NOT exposed to global objects for target applications

### `proxy-reporter.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |
| Path     | `/node_modules/reportage/proxy-reporter.js` | imported by `reporter.js`, `driver.js`, and `cli.mjs` |

- `proxy-reporter.js` defines
  - `ProxyReporter` class that wraps and forwards mocha events to `Reporter Page` via `MessagePort`
  - `ReceiverRunner` class that receives aggregated mocha events and redirects them to a mocha reporter

### Extension

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Local Path | `node_modules/reportage/extension/chrome/` | for Chrome for now                |

- Test Helper browser extension performs these tasks
  - injection of `driver.js` module to each top frame page
  - cleanup of browser storages to set up clean test environments
  - collection of navigation URLs of target app
- Manual installation is required on GUI test
  - open `chrome://extensions/`
  - enable the Developer Mode
  - install the non-packaged extension from `node_modules/reportage/extension/chrome/`
- Automatically installed on each CLI test execution
- The extension is inappropriate for normal browsing
  - a dedicated user profile for testing has to be created
  - an ephemeral user profile is automatically created for each `puppeteer` session in `reportage` CLI
- Alternatively, `driver.js` script tag can be injected at [App Server](#app-server) or at build time
  - `Config.driverInjectionMethod` must be set other than `Extension` if the script is injected at the server

### `reportage` CLI

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Local Path | `node_modules/.bin/reportage` | symbolic link to `cli.mjs`                   |
| Module   | `node_modules/reportage/cli.mjs` |                                             |
| config arg | paths to `reportage.config.js` | multiple configs can be specified           |
| import arg | `--import {module}`            | import extra module(s) (optional)             |

- `reportage` CLI
  - takes config path(s) to load
    - `test/reportage.config.js` is the default config if omitted
  - opens `puppeteer` sessions to perform test suites by
    - opening [Reporter Page](#reporter-page)
    - clicking the "Start ▶" button
    - redirecting mocha events to console reporters
    - collecting coverage data to `.nyc_output/out.json`
      - `nyc report` command is NOT invoked
      - `posttest` npm script should run `npx nyc report` command
        - coverage instrumentation is NOT done by `reportage` CLI
          - instrumentation must be performed at
            - build time or
            - server middleware
  - optionally imports module(s) that can export these optional hooks
```js
  const { onConfig, onReady, onMochaEvent, onEnd } = await import("module path");
  async onConfig({ Config });
  async onReady({ Config, page, browser });
  onMochaEvent({ Config, page, browser, event });
  async onEnd({ Config, page, browser, event });
```

### `reportage.config.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:--------------------------------|:---------------------------------------------|
| Host     | reporter server host            |                                              |
| Port     | reporter server port            | normally unprivileged ports                  |
| Protocol | reporter server protocol        | security requirements must be met            |
| Path     | any (typically `/test/reportage.config.js`) | path to configuration            |
| Local Path | any (typically `test/reportage.config.js`) | local path to configuration     |

- `reportage.config.js` is loaded by `reportage` CLI as well as browser modules
  - `reporter.js` and `driver.js` are loaded with hash that contains a path to `reportage.config.js`

- example `test/reportage.config.js` from [`vite-lit-ts-app`](examples/vite-lit-ts-app/README.md)
  - properties starting with `_` are internal to `Config` object

```js
const Config = {
  configURL: import.meta.url,
  get testConfigPath() {
    return new URL(this.configURL).pathname;
  },
  _reporterWebRootRelativeToTestConfigPath: '../',
  get testConfigPathOnReporter() {
    if (new URL(this.configURL).protocol === 'file:') {
      const baseLength = (new URL(this._reporterWebRootRelativeToTestConfigPath, this.configURL).pathname).length;
      return (new URL(this.configURL)).pathname.substring(baseLength - 1);
    }
    else {
      return this.testConfigPath;
    }
  },
  _concurrency: 8,//typeof navigator === 'object' ? navigator.hardwareConcurrency : 1,
  get _targetAppHosts() {
    return [...function *() { for (let i = 1; i <= Config._concurrency; i++) yield `http://127.0.0.${i}`; }()];
  },
  get _targetAppPorts() {
    return [ 3001 ];
  },
  get targetAppTestBasePath() {
    let pathname = new URL(this.configURL).pathname.split('/');
    pathname[pathname.length - 1] = '';
    return pathname.join('/'); // /test/
  },
  targetOrigin(host, port) {
    // TODO: handle port=443 and '' properly
    return `${host}:${port}`;
  },
  targetApp(origin, path) {
    return new URL(path, origin).href;
  },
  * originGenerator() {
    for (let host of this._targetAppHosts) {
      for (let port of this._targetAppPorts) {
        yield this.targetOrigin(host, port);
      }  
    }
  },
  driverInjectionMethod: [
    'BuildTime',
    'ServerMiddleware',
    'Extension',
  ][2],
  get reporterOrigin() {
    return `http://localhost:3000`;
  },
  async importedBy(importerURL) {
    const _url = new URL(importerURL);
    let pathElements = _url.pathname.split('/');
    let reportagePackagePath;
    if (pathElements.length >= 3 &&
        pathElements[pathElements.length - 1].endsWith('.js') &&
        pathElements[pathElements.length - 2] === 'reportage' &&
        pathElements[pathElements.length - 3] === 'node_modules') {
      // */node_modules/reportage/*.js
      reportagePackagePath = _url.pathname.substring(0, _url.pathname.length - pathElements[pathElements.length - 1].length)
    }
    else if (pathElements.length === 2 &&
      pathElements[0] === '' &&
      pathElements[1].endsWith('.js')) {
      // /*.js
      reportagePackagePath = _url.pathname.substring(0, 1); // '/'
    }
    else if (_url.protocol === 'file:' &&
      (pathElements[pathElements.length - 1].endsWith('cli.mjs') || pathElements[pathElements.length - 1].endsWith('cli.js'))) {
      reportagePackagePath = _url.pathname.substring(0, _url.pathname.length - pathElements[pathElements.length - 1].length)
    }
    if (reportagePackagePath) {
      switch (pathElements[pathElements.length - 1]) {
      case 'reporter.js': // must be called from reporter.js in reporter.html
        this._pageType = 'reporter';
        break;
      case 'driver.js': // must be called from driver.js in target app pages
        this._pageType = 'driver';
        break;
      case 'cli.mjs':
      case 'reportage':
        this._pageType = 'reportage';
        break;
      case 'cli.js':
        this._pageType = 'reportage:instrumented';
        break;
      case 'mediator-worker.js':
      case 'mediator-worker-client.js':
        break;
      default:
        break;
      }
      if (this._pageType) {
        this.reportagePackagePath = reportagePackagePath;
      }
    }
    if (this.reportagePackagePath) {
      const { default: resolvedPaths } = await import(new URL('resolved-paths.js', new URL(this.reportagePackagePath, this.configURL)).pathname);
      this.resolvedPaths = resolvedPaths;
    }
    else {
      throw new Error(`${import.meta.url}: Unexpected call to Config.importedBy("${importerURL}")`);
    }
  },
  resolve(bareSpecifier) { // primitive simulation of import maps
    if (!this.reportagePackagePathOnTargetApp) {
      throw new Error(`${import.meta.url}: reportagePackagePathOnTargetApp is missing in calling Config.resolve("${bareSpecifier}")`);
    }
    if (!this.resolvedPaths) {
      throw new Error(`${import.meta.url}: resolvedPath is missing in calling Config.resolve("${bareSpecifier}")`);
    }
    if (!this.resolvedPaths[bareSpecifier]) {
      throw new Error(`${import.meta.url}: resolvedPath["${bareSpecifier}"] is missing in calling Config.resolve("${bareSpecifier}")`);
    }
    return new URL(this.resolvedPaths[bareSpecifier], new URL(this.reportagePackagePathOnTargetApp, this.configURL).href).pathname;
  },
  get reportagePackagePathOnReporter() {
    if (new URL(this.configURL).protocol === 'file:') {
      const baseLength = (new URL(this._reporterWebRootRelativeToTestConfigPath, this.configURL).pathname).length;
      return this.reportagePackagePath.substring(baseLength - 1);
    }
    else {
      return this.reportagePackagePath;
    }
  },
  get reportagePackagePathOnTargetApp() {
    return this.reportagePackagePath;
  },
  mediatorWorkerPathRelativeToReportage: './mediator-worker.js',
  _mediatorHtmlPathRelativeToReportage: './mediator.html',
  get mediatorHtmlURL() {
    return new URL(this._mediatorHtmlPathRelativeToReportage, new URL(this.reportagePackagePathOnReporter, this.reporterOrigin).href).href;
  },
  _reporterHtmlPathRelativeToReportage: 'reporter.html',
  get reporterURL() {
    return `${this.reporterOrigin}${this.reportagePackagePathOnReporter}${this._reporterHtmlPathRelativeToReportage}#${this.testConfigPathOnReporter}`;
  },
  get cleanupOptions() {
    const commonOptions = {
      RemovalOptions: {
        since: 0,
        origins: [Config.reporterOrigin, ...Config.originGenerator()], // chrome-only
        //hostnames: [], // firefox-only
      },
      dataToRemove: {
        start: { // only once per run; unnecessary for puppeteer sessions if a dedicated user profile is created for each session
          // non-filterable by origins/hostnames - Be aware that other apps with the same user profile are affected as well
          appcache: false, // [DEPRECATED FEATURE] Websites' appcaches.
          downloads: false, // [BASICALLY IRRELEVANT TO WEB TESTS] The browser's download list.
          history: false, // [Session history is reset on navigating to the bottom of the history stack] The browser's history, which is different from window.history object
          formData: true, // [Autofill feature should be disabled in the browser Configurations] The browser's stored form data.
          passwords: true, // [Autofill feature should be disabled in the browser Configurations] Stored passwords.
          // filterable by origins/hostnames
          cache: true, // The browser's cache.
        },
        end: { // only once per run
          // non-filterable by origins/hostnames - Be aware that other apps with the same user profile are affected as well
          appcache: false, // [DEPRECATED FEATURE] Websites' appcaches.
          downloads: false, // [BASICALLY IRRELEVANT TO WEB TESTS] The browser's download list.
          history: false, // [Session history is reset on navigating to the bottom of the history stack] The browser's history, which is different from window.history object
          formData: true, // [Autofill feature should be disabled in the browser Configurations] The browser's stored form data.
          passwords: true, // [Autofill feature should be disabled in the browser Configurations] Stored passwords.
          // filterable by origins/hostnames
          cookies: true, // The browser's cookies.
          cache: true, // The browser's cache.
          fileSystems: true, // Websites' file systems.; not on Firefox
          indexedDB: true, // Websites' IndexedDB data.
          localStorage: true, // Websites' local storage data.
          cacheStorage: true, // Cache storage
          serviceWorkers: true, // Service Workers.
          webSQL: false, // [DEPRECATED FEATURE] Websites' WebSQL data.
        },
        window: { // on each window.open(targetAppOrigin)
          // filterable by origins/hostnames
          cookies: true, // [If the feature is not used, it can be false] The browser's cookies.
          cache: false, // The browser's cache.
          fileSystems: true, // Websites' file systems.; not on Firefox
          indexedDB: true, // Websites' IndexedDB data.
          localStorage: true, // Websites' local storage data.
          cacheStorage: true, // Cache storage
          serviceWorkers: true, // Service Workers.
          webSQL: false, // [DEPRECATED FEATURE] Websites' WebSQL data.
        },
        suite: { // on each test scenario
          // filterable by origins/hostnames
          cookies: true, // [If the feature is not used, it can be false] The browser's cookies.
          cache: false, // [TESTS MAY BECOME FLAKY IF CACHE IS CLEANED ON EACH SUITE AND CONCURRENCY IS HIGH] The browser's cache.
          fileSystems: false, // [If the feature is not used, it can be false] Websites' file systems.; not on Firefox
          indexedDB: false, // [If the feature is not used, it can be false] Websites' IndexedDB data.
          localStorage: false, // [If the feature is not used, it can be false] Websites' local storage data.
          cacheStorage: false, // [In most cases, Service Workers and Cache storage can persist over multiple test scenarios] Cache storage for Service Workers
          serviceWorkers: false, // [In most cases, Service Workers and Cache storage can persist over multiple test scenarios] Service Workers. 
          webSQL: false, // [DEPRECATED FEATURE] Websites' WebSQL data.
          // not supported in the browsingData.remove() API
          sessionStorage: true, // cleanup by sessionStorage API itself at driver.js
        },
      },
      timeout: 10000,
    };
    return commonOptions;
  },
  _suitesLoaderScriptRelativeToConfig: './suites-loader.js',
  _scenaristLoaderScriptRelativeToReportage: './scenarist-loader.js',
  get suitesLoaderPath() {
    return new URL(this._suitesLoaderScriptRelativeToConfig + '#' + new URL(this.configURL).pathname, this.configURL).pathname;
  },
  get scenaristLoaderPath() {
    return new URL(this._scenaristLoaderScriptRelativeToReportage, new URL(this.reportagePackagePath, this.configURL).href).pathname;
  },
  importOnlyTargetScope: true, // for performance
  timeout: 5 * 1000, // 5sec
  readyTimeout: 5 * 1000, // 5sec
  readyTimeoutRetries: 2, // 2 retries
  mediatorPortTimeout: 1 * 1000, // 5sec
  beaconTimeout: 5 * 1000, // 5sec
  setupInjectionTimeout: 1000, // 1sec
  dispatcherStartInterval: 50, // 50ms - insert a wait between dispatcher start events
  suitesLoaderRetries: 1, // 2 retries
  windowTarget: '_blank',
  windowFeatures: 'noopener,noreferrer',
  mochaOptions: {
    ui: 'bdd',
    timeout: 60000,
    checkLeaks: true,
    cleanReferencesAfterRun: false, // References must not be cleaned until the proxy reporter completes transferring all events
    retries: -1,
  },
  consoleReporter: 'mochawesome',
  consoleReporterOptions: {
    reportDir: './test/mochawesome-report/',
    //reportFilename: '[status]_[datetime]-[name]-report',
    autoOpen: false,
    html: true,
    json: true,
    timeout: 5000,
    consoleReporter: 'list',
  },
  coverageOptions: {
    enabled: true,
  },
  get links() {
    return {
      mochawesome: new URL(this.consoleReporterOptions.reportDir + 'mochawesome.html', new URL(this._reporterWebRootRelativeToTestConfigPath, import.meta.url)).href,
      coverage: new URL('coverage/index.html', new URL(this._reporterWebRootRelativeToTestConfigPath, import.meta.url)).href,
    };
  },
  get _pathToChromeExtension() {
    return this.reportagePackagePath +
      (this.coverageOptions && this.coverageOptions.enabled && this._pageType === 'reportage:instrumented' ? 'test/instrumented/' : '') +
      'extension/chrome';
  },
  get puppeteerLaunchOptions() {
    return {
      headless: 'new', // 'new' for headless; false for windowed
      dumpio: false,
      devtools: false,
      defaultViewport: { // null for resizable viewport in a windowed mode
        width: 1280,
        height: 720,
        //deviceScaleFactor: 1,
        //hasTouch: false,
        //isLandscape: false,
        //isMobile: false,
      },
      args: [
        '--disable-gpu',
        //'--enable-logging=stderr',
        //'--auto-open-devtools-for-tabs',
        '--disable-ipc-flooding-protection',
        '--disable-pushstate-throttle',
        '--disable-background-timer-throttling',
        '--disable-popup-blocking',
        `--disable-extensions-except=${Config._pathToChromeExtension}`,
        `--load-extension=${Config._pathToChromeExtension}`,
        //'--user-data-dir=/home/t2ym/.config/google-chrome',
        //'--profile-directory=Profile 1', // Non-puppeteer windows must be closed when a profile is specified
      ],
      executablePath: '/usr/bin/google-chrome',
    };
  },
}
export default Config;
```

### Other Configuration Files

#### `resolved-paths.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| URL Path | `/node_modules/reportage/resolved-paths.js` | generated at postinstall     |

- `resolved-paths.js` is a naive hack to resolve node module paths for these modules for static [Reporter Server](#reporter-server)
  - `"scenarist/Suite.js"`
  - `"mocha/mocha.js"`
  - `"mocha/mocha.css"`
  - `"@esm-bundle/chai/esm/chai.js"`

#### `nyc.config.mjs`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Local Path | `nyc.config.mjs` (optional)   | local path to `nyc` configuration     |

#### `nginx.conf`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Local Path | `nginx.conf` (optional)       | local path to `nginx` configuration     |

### Suites

#### `suites-loader.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path | any (typically `/test/suites-loader.js`) | `Config._suitesLoaderScriptRelativeToConfig` |

- `suites-loader.js` is configured at `Config._suitesLoaderScriptRelativeToConfig` to set the loader for test suites
  - it typically loads `scenarist-loader.js` and test suites for scopes

#### `mocha-loader.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path | `/node_modules/reportage/mocha-loader.js` | loaded by `driver.js` and `reporter.js` |

- `mocha-loader.js`
  - fetches `mocha/mocha.js` script
  - patches the source code for `reportage` by
    - disabling `grep` search parameters
    - exporting an installer to `sandbox` object

#### `scenarist-loader.js`

| Features | Supported Configurations      | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path | `/node_modules/reportage/scenarist-loader.js` | loaded by `suites-loader.js` |

- `scenarist-loader.js`
  - imports `sandbox` from `sandbox-global.js`
  - fetches `scenarist` script version 1.1.10
  - patches the source code for `reportage`
    - use `sandbox` to get mocha functions such as `describe`, `it`, etc.
    - add mocha's `this` argument to call `operation`, `checkpoint`, `setup`, `teardown` calls
    - add `sandbox` argument to `run` calls
  - no global `Suite` variable
- the path is resolved by `resolved-paths.js`

#### `common-suite.js`

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path | any (typically `/test/common-suite.js`) | loaded by `suites-loader.js` |

- `common-suite.js` or any test suites can define common methods of test classes such as
  - [`Test Phases`](#test-phases)
  - utility functions, etc.

#### Test Suites

| Features | Supported Configurations       | Notes                                        |
|:--------:|:-------------------------------|:---------------------------------------------|
| Path | any (typically `/test/*-suite.js`) | loaded by `suites-loader.js` |

- `Test Suites` are defined in test classes with `scenarist` UI
  - they typically load `common-suite.js` and extend test classes
  - they are loaded by `suites-loader.js`

#### Test Phases

- For non-SPA applications, each test scenario has to handle page navigation
- `reportage` handles such test scenarios by introducing *Phase* concept
  - [`vite-lit-ts-app`](examples/vite-lit-ts-app/README.md) example shows how to handle page transitions in a test scenario
    - transition from `/` to `/external-navi-vite.html` by clicking the link and increment the `phase` number
- "Seeing is believing" in the example project but an awkward explanation follows:
  - `this.target` in test classes is originally designed for test fixtures
  - In E2E tests, test fixtures are whole pages in top frames
  - `this.target` is then reinterpreted as a container for parameters across a single test scenario with page transitions
  - `this.target.phase` contains the current phase number in a test scenario starting from `0`
  - `this.target.phase` is incremented before navigation to another page
    - the trick is to set `this.target.deferredNavigation()` function to be called AFTER the phase finishes for the current mocha session
      - to keep page navigations from destroying the running mocha test suites
  - the value of `this.target` object is transferred to `Reporter Page` on navigation as `suiteParameters` object
  - `Reporter Page` requests the incremented phase of the scenario with the stored `suiteParameters` object
    - `suiteParameters` can store any clonable objects
  - the test scenario can perform operations for the current phase and skip those not for the current phase

## ToDos

- [x] screenshot
- pause-before-replay option for debugging
- browser support
- TBD

## License

[BSD-2-Clause](LICENSE.md)
