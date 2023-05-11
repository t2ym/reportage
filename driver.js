/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { _globalThis, sandbox } from './sandbox-global.js';
import { mochaInstaller } from './mocha-loader.js';
import { reporterInstaller } from './proxy-reporter.js';
import {
  NAME_REPORTER,
  NAME_MEDIATOR,
  NAME_MEDIATOR_BRIDGE,

  TYPE_READY,
  TYPE_ERROR,
  TYPE_DISCONNECT,
  TYPE_TRANSFER_PORT,
  TYPE_REQUEST_SESSION,
  TYPE_START_SESSION,
  TYPE_END_SESSION,
  TYPE_NAVIGATE,
  TYPE_NAVIGATING,
  TYPE_CLOSING,
  TYPE_CLOSE,
  TYPE_COVERAGE,

  DRIVER_STATE_CLOSED,
  DRIVER_STATE_LOADING,
  DRIVER_STATE_DISCONNECTED,
  DRIVER_STATE_CONNECTING,
  DRIVER_STATE_CONNECTED,
  DRIVER_STATE_READY,
  DRIVER_STATE_STARTING0,
  DRIVER_STATE_RUNNING,
  DRIVER_STATE_STOPPING,
  DRIVER_STATE_STOPPED,
  DRIVER_STATE_ABORTING,
  DRIVER_STATE_CLOSING0,
  DRIVER_STATE_CLOSING1,
  DRIVER_STATE_CLOSING2,
  DRIVER_STATE_NAVIGATING0,
  DRIVER_STATE_NAVIGATING1,
  DRIVER_STATE_NAVIGATING2,
  DRIVER_STATE_NAVIGATING3,
  DRIVER_STATE_BEFOREUNLOAD,
  DRIVER_STATE_UNLOADING,
  DRIVER_STATE_ERROR,

  SESSION_STORAGE_DRIVER_NAVIGATING,

  // location
  NAVI_LOCATION_HREF,
  NAVI_LOCATION_RELOAD,
  NAVI_LOCATION_REPLACE,
  NAVI_LOCATION_ASSIGN,
  // history
  NAVI_HISTORY_GO,
  NAVI_HISTORY_BACK,
  NAVI_HISTORY_FORWARD,
  NAVI_HISTORY_REPLACE,
  NAVI_HISTORY_PUSH,
  // click link or programmatic
  NAVI_DEFERRED,

} from './constants.js';

try {
  /*
  {
    let w = window.open("about:blank"); // open a new window without user interaction
    //console.log(`window.open("about:blank") = `, w);
    if (w) {
      //console.log('closing the window');
      w.close();
      //launcherButton.click();
    }
    else {
      console.error(`Popup blocking on the target app host domain ${location.hostname} has to be disabled for the site to open mediator.html window` +
      `The instruction on how to allow pop-ups and redirects from a site is found at ` +
      `https://support.google.com/chrome/answer/95472?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Callow-pop-ups-and-redirects-from-a-site`);
      console.error(`The command line option --disable-popup-blocking is also effective if it is applied properly to Chrome browser processes`);
      throw new Error('popup blocking must be disabled for the host domain ' + location.hostname);
    }
  }
  */

  const driverURL = import.meta.url;
  //console.log(`driver.js: driverURL = ${driverURL}`);
  const testConfigPath = new URL(driverURL).hash.substring(1) || '/test/reportage.config.js';
  
  let Config;
  let success = false;
  let retryCount = 0;
  let maxRetries = 5;
  do {
    try {
      const { default: _Config } = await import(testConfigPath + (retryCount > 0 ? '#' + retryCount : ''));
      Config = _Config;
      Config.importedBy(driverURL);
      success = true;
    }
    catch (e) {
      console.error(e);
    }
    if (!success) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
      if (retryCount > maxRetries) {
        // no way to recover
        console.error(`driver.js: failed to load ${testConfigPath}`);
        window.close();
      }
    }
  }
  while (!success);
  //window.Config = Config; // for debugging
  
  let Suite;
  success = false;
  retryCount = 0;
  const SESSION_STORAGE_RELOADING = 'SessionStorage:reloading';
  do {
    if (Config.importOnlyTargetScope) break;
    try {
      const { default: _Suite } = await import(Config.suitesLoaderPath + (retryCount > 0 ? '#' + retryCount : ''));
      Suite = _Suite;
      success = true;
    }
    catch (e) {
      console.error(e);
    }
    if (!success) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
      if (retryCount > Config.suitesLoaderRetries) {
        const reloading = sessionStorage.getItem(SESSION_STORAGE_RELOADING);
        if (reloading) {
          sessionStorage.removeItem(SESSION_STORAGE_RELOADING);
          console.error(`driver.js: closing as loading suites failed`);
          window.close();
          throw new Error(`driver.js: loading suites failed`)
        }
        else {
          sessionStorage.setItem(SESSION_STORAGE_RELOADING, '1');
          console.error(`driver.js: reloading page to load suites`);
          history.go();
        }
      }
    }
  }
  while (!success);
  
  class Driver extends EventTarget {
    constructor() {
      super();
      this.reset();
      this.restore();
      this.setUpListeners();
    }
    reset() {
      this.state = DRIVER_STATE_LOADING;
      this.mediatorPort = null;
      this.pageId = '';
      this.sessionId = '';
      this.url = '';
      this.timeoutId = 0;
      this.reason = null;
    }
    restore() {
      const navigatingStateRaw = sessionStorage.getItem(SESSION_STORAGE_DRIVER_NAVIGATING);
      if (navigatingStateRaw) {
        sessionStorage.removeItem(SESSION_STORAGE_DRIVER_NAVIGATING);
        const navigatingState = JSON.parse(navigatingStateRaw);
        const { eventData, state, history: _history } = navigatingState;
        if (state >= 10) {
          return;
        }
        // navigation in progress
        //console.log(`driver.js:restore: navigating ${navigatingStateRaw}`);
        const event = {
          data: eventData,
        };
        this.navigating = event;
      }
    }
    setUpListeners() {
      this.addEventListener('start', (event) => { this.start(event); });
    }
    setUpMessageListener() {
      this._onMessage = (event) => { return this.onMessage(event); };
      this.mediatorPort.addEventListener('message', this._onMessage);
    }
    setUpListenerDelayed() {
      this._onBeforeUnload = (event) => { return this.onBeforeUnload(event); };
      window.addEventListener('beforeunload', this._onBeforeUnload);
    }
    start(event) {
      switch (this.state) {
      case DRIVER_STATE_LOADING:
        this.state = DRIVER_STATE_DISCONNECTED;
        this.connect();
        break;
      default:
        // TODO: error handling
        break;
      }
    }
    onBeforeUnload(event) {
      //console.log(`${this.constructor.name}.onBeforeUnload:`);
      if (this.__onBeforeUnload) {
        this.__onBeforeUnload(event);
      }
      if (globalThis.__coverage__) {
        let coverage = [ globalThis.__coverage__ ];
        if (Array.isArray(this.bridgeCoverage)) {
          coverage.splice(coverage.length, 0, ...this.bridgeCoverage);
        }
        this.sendCoverage(coverage);
      }
    }
    sendCoverage(_coverage) {
      if (this.mediatorPort && Array.isArray(_coverage) && _coverage.length > 0) {
        //console.log(`${this.constructor.name}.sendCoverage`);
        const message = {
          type: TYPE_COVERAGE,
          source: this.pageId,
          target: NAME_REPORTER,
          url: this.url,
          __coverage__: _coverage,
        };
        this.mediatorPort.postMessage(message);
      }
    }
    async connect() {
      switch (this.state) {
      case DRIVER_STATE_DISCONNECTED:
        try {
          this.doConnect();
        }
        catch (e) {
          if (typeof this.onTransferPortMessage.reject === 'function') {
            this.onTransferPortMessage.reject();
          }
          this.error(e);
        }
        break;
      default:
        // TODO: error handling
        break;
      }  
    }
    async doConnect() {
      // request port via mediator.html in a new _blank tab
      // popup blocking feature has to be disabled on the target app domain
      const This = this;
      this.onTransferPortMessage = function onTransferPortMessage (_event) {
        if (_event.origin === Config.reporterOrigin) {
          const { type, source, transfer } = _event.data;
          if (source === NAME_MEDIATOR_BRIDGE) {
            //window.removeEventListener('message', This._onTransferPortMessage);
            if (type === TYPE_TRANSFER_PORT) {
              if (Array.isArray(transfer) && transfer[0] instanceof MessagePort) {
                onTransferPortMessage.resolve(transfer[0]);
              }
              else {
                onTransferPortMessage.reject(new Error('transfer[0] is not a MessagePort in TYPE_TRANSFER_PORT message from mediator.html'));
              }
            }
            else if (type === TYPE_COVERAGE) {
              if (_event.data.__coverage__) {
                This.bridgeCoverage = This.bridgeCoverage || [];
                This.bridgeCoverage.splice(This.bridgeCoverage.length, 0, ..._event.data.__coverage__);
              }
            }
            else if (type === TYPE_ERROR) {
              onTransferPortMessage.reject(new Error('error from mediator.html', { cause: _event.data.errorMessage }));
            }
            else {
              onTransferPortMessage.reject(new Error('unexpected message type from mediator.html type: ' + type));
            }
          }
          /*
          else {
            console.warn('discarding an uninteresting message source from origin:type:source ' + _event.origin + ':' + type + ':' + source, _event);
          }
          */
        }
        /*
        else {
          console.warn('discarding an uninteresting message from origin ' + _event.origin, _event);
        }
        */
      }
      this.state = DRIVER_STATE_CONNECTING;
      while (!this.mediatorPort) {
        try {
          this.mediatorPort = await Promise.race([
            new Promise((resolve, reject) => {
              this.onTransferPortMessage.resolve = resolve;
              this.onTransferPortMessage.reject = reject;
              if (!this._onTransferPortMessage) {
                window.addEventListener('message', this._onTransferPortMessage = (event) => {
                  return this.onTransferPortMessage(event);
                });
              }
              this.mediatorWindow = window.open(Config.mediatorHtmlURL, NAME_MEDIATOR_BRIDGE);
            }),
            new Promise((resolve, reject) => {
              setTimeout(() => {
                if (this.mediatorPort) {
                  resolve(this.mediatorPort); // the resolved value is not used
                  return;
                }
                //window.removeEventListener('message', this._onTransferPortMessage);
                if (this.mediatorWindow) {
                  this.mediatorWindow.close();
                }
                reject(new Error(`${this.state}.timeout: timeout for receiving ready`));
              }, Config.mediatorPortTimeout || Config.timeout);
            })
          ]);
        }
        catch (error) {
          console.error(error);
        }
      }
      this.onTransferPortMessage.resolve = this.onTransferPortMessage.reject = () => null;
      this.mediatorPort.start();
      this.onConnect();
    }
    createPageId() {
      return crypto.randomUUID
              ? crypto.randomUUID()
              : (() => {
                  const hex = Array.prototype.map.call(
                    crypto.getRandomValues(new Uint16Array(8)),
                    (v) => v.toString(16).padStart(4, '0'));
                  return `${hex[0]}${hex[1]}-${hex[2]}-${hex[3]}-${hex[4]}-${hex[5]}${hex[6]}${hex[7]}`
                })();
    }
    onConnect() {
      switch (this.state) {
      case DRIVER_STATE_CONNECTING:
        this.state = DRIVER_STATE_CONNECTED;
        if (this.navigating) {
          this.setUpListenerDelayed();
          this.onNavigate(this.navigating);
          this.navigate();  
        }
        else {
          this.pageId = this.createPageId();
          this.setUpMessageListener();
          this.sendReady();
        }
        break;
      default:
        // TODO: error handling
        break;
      }
    }
    sendReady() {
      switch (this.state) {
      case DRIVER_STATE_CONNECTED:
      case DRIVER_STATE_STOPPED:
        this.url = location.href;
        // notify reporter of the ready status of this target app page
        const message = {
          type: TYPE_READY,
          source: this.pageId,
          target: NAME_REPORTER,
          url: this.url,
        };
        //console.log(`${this.state}.sendReady:`, message);
        this.mediatorPort.postMessage(message);
        this.state = DRIVER_STATE_READY;
        break;
      default:
        // TODO: error handling
        break;
      }  
    }
    onMessage(event) {
      //console.log(`Driver.onMessage: `, event.data);
      const { type } = event.data;
      switch (type) {
      case TYPE_ERROR:
        if (event.data.source === NAME_MEDIATOR && event.data.errorMessage === 'Error: source is blocked') {
          console.error(`Driver.onMessage: ${type} ${event.data.errorMessage}`);
          this.disconnect();
        }
        return;
      }
      switch (this.state) {
      case DRIVER_STATE_READY:
        switch (type) {
        case TYPE_REQUEST_SESSION:
          this.onRequestSession(event);
          break;
        case TYPE_NAVIGATE:
          this.onNavigate(event);
          break;
        case TYPE_CLOSE:
          this.sendClosing();
          break;
        default:
          break;
        }
        break;
      case DRIVER_STATE_ERROR:
        switch (type) {
        case TYPE_CLOSE:
          this.sendClosing();
          break;
        default:
          break;
        }
        break;
      default:
        // TODO: error handling
        break;
      }
    }
    onRequestSession(event) {
      this.state = DRIVER_STATE_STARTING0;
      const { sessionId, suite, suiteParameters } = event.data;
      this.sessionId = sessionId;
      this.suite = suite;
      this.suiteParameters = suiteParameters || { suite: { ...suite }, phase: 0 };
      //console.log('onRequestSession', event);
      this.startSession(event);
    }
    onNavigate(event) {
      let restoring = false;
      if (this.navigating === event) {
        restoring = true;
      }
      else {
        this.state = DRIVER_STATE_NAVIGATING0;
      }
      /*
      event.data = {
        type: TYPE_NAVIGATE,
        source: NAME_REPORTER,
        target: pageId,
        suite: suite,
        url: url,
        navigationType: navigationType,
      }
      */
      const { suite, url, navigationType } = event.data;
      this.suite = suite;
      this.url = url;
      switch (navigationType) {
      // location
      /*
      case NAVI_LOCATION_HREF:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            location.href = url;
          },
        };
        break;
      case NAVI_LOCATION_RELOAD:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            // TODO: check the current URL against the url parameter
            location.reload();
          },
        };
        break;
      case NAVI_LOCATION_REPLACE:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            if (location.href === url) {
              history.go();
            }
            else {
              window.addEventListener('popstate', (event) => {
                location.reload(); // hash-only URL changes need reloading to load the url
              });
              location.replace(url);  
            }
          },
        };
        break;
      case NAVI_LOCATION_ASSIGN:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            if (location.href === url) {
              history.go();
            }
            else {
              window.addEventListener('popstate', (event) => {
                location.reload(); // hash-only URL changes need reloading to load the url
              });
              location.replace(url);  
            }
          },
        };
        break;
      */
      case NAVI_HISTORY_GO: // navigate to the target via cleanup.html
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: async () => {
            const DUMMY_HISTORY_STACK_TOP_PATH = '/test/history-stack-top';
            const storeNavigatingState = (state) => {
              sessionStorage.setItem(SESSION_STORAGE_DRIVER_NAVIGATING, JSON.stringify({
                /*
                  event.data = {
                    type: TYPE_NAVIGATE,
                    source: NAME_REPORTER,
                    target: this.pageId,
                    suite: suite,
                    url: url,
                    navigationType: NAVI_HISTORY_GO,
                  }
                */
                eventData: event.data,
                history: {
                  length: history.length,
                  state: history.state,
                },
                state: state,
              }, null, 2));
            };
            const waitUntil = async (condition) => {
              if (!condition()) {
                await new Promise(resolve => {
                  const intervalId = setInterval(() => {
                    if (condition()) {
                      clearInterval(intervalId);
                      resolve();
                    }
                  }, 100);
                });  
              }
            };
            storeNavigatingState(0);
            //console.log(`pushState '${DUMMY_HISTORY_STACK_TOP_PATH}'`);
            history.pushState(null, '', DUMMY_HISTORY_STACK_TOP_PATH); // push a dummy state at the top of session stack
            storeNavigatingState(1);
            if (history.length > 1) {
              //console.log(`history.go(${1 - history.length}) when history.length = ${history.length}`);
              history.go(1 - history.length); // back to the bottom of the stack
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            storeNavigatingState(2);
            //console.log(`replaceState ${url}`);
            history.replaceState(null, '', url);
            storeNavigatingState(3);
            await waitUntil(() => location.href === url);
            storeNavigatingState(4);
            //console.log(`pushState ''`);
            history.pushState(null, '', DUMMY_HISTORY_STACK_TOP_PATH); // push a dummy state at the top of session stack to reset the history length to 2
            storeNavigatingState(5);
            await waitUntil(() => history.length === 2);
            storeNavigatingState(6);
            //console.log(`history.go(-1)`);
            history.go(-1); // back to the bottom of the stack
            storeNavigatingState(7);
            await waitUntil(() => location.href === url);
            storeNavigatingState(8);

            // partial cleanup
            const cleanupOptions = Config.cleanupOptions;
            const removalOptions_raw = cleanupOptions.RemovalOptions;
            const partialCleanupTargets_raw = cleanupOptions.dataToRemove.suite;
            const partialCleanupTargets = Object.assign({}, partialCleanupTargets_raw);
            const removalTimeout = cleanupOptions.timeout;
  
            //console.log(`cleanup.js: partial cleanup: ${JSON.stringify(partialCleanupTargets, null, 2)}`);
            const removalOptions = {
              since: removalOptions_raw.since || 0,
              origins: [new URL(import.meta.url).origin],
            };
            try {
              const cleanupStart = Date.now();
              let cleanupFinishedCallback;
              if (partialCleanupTargets.sessionStorage) {
                sessionStorage.clear();
              }
              delete partialCleanupTargets.sessionStorage;
              const result = await new Promise((resolve, reject) => {
                window.addEventListener('cleanup-finished', cleanupFinishedCallback = (event) => {
                  let cleanupFinished = Date.now();
                  window.removeEventListener('cleanup-finished', cleanupFinishedCallback);
                  //console.log(`cleanup finished in ${cleanupFinished - cleanupStart}ms removalOptions: ${JSON.stringify(removalOptions)}, dataToRemove: ${JSON.stringify(partialCleanupTargets_raw)}`);
                  resolve(event.detail);
                });
                window.dispatchEvent(new CustomEvent('cleanup', { detail: {
                  removalOptions: removalOptions,
                  dataToRemove: partialCleanupTargets,
                }}));
                setTimeout(() => { reject('timed out') }, removalTimeout);
              });
            }
            catch (e) {
              console.error(`driver.js: cleanup timeout`, e);
            }
            storeNavigatingState(9);
  
            this.__onBeforeUnload = (event) => {
              //console.log(`driver.js: beforeunload`);
              setTimeout(() => {
                console.warn(`driver.js: recalling history.go() 100ms after beforeunload`);
                history.go(); // recover from flaky history.go() calls
                storeNavigatingState(12);
              }, 100);
            };
            storeNavigatingState(10);
            //console.log(`driver.js: navigating to ${url}, location: ${location.href}`);
            history.go();
            storeNavigatingState(11);
          },
        };
        break;
      // history: TODO: handle properly
      /*
      case NAVI_HISTORY_BACK:
      case NAVI_HISTORY_FORWARD:
        break;
      case NAVI_HISTORY_REPLACE:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            history.replaceState(null, undefined, url);
            location.reload();
          },
        };
        break;
      case NAVI_HISTORY_PUSH:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            history.pushState(null, undefined, url);
            location.reload();
          },
        };
        break;
        // click link or programmatic
        //NAVI_DEFERRED,
      default:
        this.suiteParameters = {
          url: url,
          navigationType: navigationType,
          deferredNavigation: () => {
            location.href = url;
          },
        };
        break;
      */
      }
      if (!restoring) {
        this.sendNavigating();
      }
    }
    async startSession(event) {
      // start a new mocha session
      // (re-)install mocha and proxy reporter as disposed mocha cannot be reused
      // In a browser, globalThis.mocha object instance is created by mocha-es2018.js and new Mocha() cannot be used for instantiation
      //console.log('============ mochaInstaller');
      mochaInstaller(_globalThis /* , _globalThis, console */); // console logging facilities can be hooked with a custom one
      //console.log('============ reporterInstaller');
      reporterInstaller(_globalThis.Mocha, Config);
  
      //console.log('============ mocha.setup'); // TODO: hand parameters
      _globalThis.mocha.setup(Config.mochaOptions);

      let testDoneResolve;
      const testDonePromise = new Promise(resolve => {
        testDoneResolve = resolve;
      });
  
      //console.log('============ mocha.reporter');
      this.reporterOptions = {
        start: (runner, reporter) => {
          this.runner = runner;
          this.reporter = reporter;
          this.reporter.driver = this;
          this.sendStartSession();
          this.setUpListenerDelayed();
        },
        end: (err, proxy) => {
          testDonePromise.then(() => {
            this.onReporterPortClosed(err, proxy);
          });
        },
        port: event.data.transfer[0],
      };
      _globalThis.mocha.reporter('proxy-reporter', this.reporterOptions);
  
      //console.log('============ Suite.scopes[scope].run');
      const { scope, testIndex, file } = this.suite;
      if (!Suite) {
        if (file) {
          do {
            try {
              const { default: _Suite } = await import(file + (retryCount > 0 ? '#' + retryCount : ''));
              Suite = _Suite;
              success = true;
            }
            catch (e) {
              console.error(e);
            }
            if (!success) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              retryCount++;
              if (retryCount > Config.suitesLoaderRetries) {
                throw new Error(`failed to import ${file} for scope ${scope} with retryCount ${retryCount - 1}`);
              }
            }
          }
          while (!success);
        }
        else {
          throw new Error(`file property is not available for scope ${scope}`);
        }
      }
      Suite.scopes[scope].run(testIndex, this.suiteParameters, sandbox)
        .then(() => {})
        .catch(error => { throw error }); // use _globalThis.describe, etc.
  
      //console.log('============ mocha.run');
      _globalThis.mocha.run(() => {
        //console.log('mocha.run finished');
        testDoneResolve();
      });
    }
    sendStartSession() {
      const reporterOptions = Object.assign({}, this.reporterOptions);
      reporterOptions.start = reporterOptions.start.toString();
      reporterOptions.end = reporterOptions.end.toString();
      //reporterOptions.abort = reporterOptions.abort.toString();
      const message = {
        type: TYPE_START_SESSION,
        source: this.pageId,
        target: NAME_REPORTER,
        sessionId: this.sessionId,
        url: this.url,
        runner: {
          total: this.runner.total,
          stats: this.runner.stats,
        },
        options: { // TODO: send options in a clonable object
          reporterOptions: reporterOptions,
        },
      };
      //console.log(`${this.state}.sendStartSession:`, message);
      this.mediatorPort.postMessage(message);
      this.state = DRIVER_STATE_RUNNING;
    }
    onReporterPortClosed(err, proxy) {
      this.state = DRIVER_STATE_STOPPING;
      //console.log(`${this.state}.onReporterStreamClosed`);
      //console.log('============ mocha.dispose');
      try {
        _globalThis.mocha.dispose(); // mocha is disposed after the reporter stream is closed
      }
      catch (e) {
        console.error('In mocha.dispose():', e); // exception while disposal
      }
      //console.log('mocha-driver.js: done for suite ', this.suite);
      this.sendEndSession();
    }
    sendEndSession() {
      const message = {
        type: TYPE_END_SESSION,
        source: this.pageId,
        target: NAME_REPORTER,
        sessionId: this.sessionId,
        url: this.url,
      };
      //console.log(`${this.state}.sendEndSession:`, message);
      this.mediatorPort.postMessage(message);
      this.state = DRIVER_STATE_STOPPED;
      this.handleSuiteParameters();
    }
    handleSuiteParameters() {
      if (this.suiteParameters &&
          typeof this.suiteParameters.phase === 'number' &&
          this.suiteParameters.phase > 0 &&
          typeof this.suiteParameters.deferredNavigation === 'function') {
        // deferred navigation is set by the suite
        /*
          Format:
            this.suiteParameters = {
              suite: { ...suite },
              phase: phase, // in a positive integer
              navigationType: NAVI_DEFERRED, // TODO: support other types
              url: '*', // [optional]: url after deferredNavigation may not be specified
              deferredNavigation: function operationToNavigate() {
                // click a link, a button, etc.
              },
            }
        */
        this.suiteParameters.navigationType = NAVI_DEFERRED;
        if (!this.suiteParameters.url) {
          this.suiteParameters.url = '*'; // In general, url is unspecified on deferred navigation
        }
        this.sendNavigatingDeferred();
      }
      else {
        this.suite = null;
        this.suiteParameters = null;
        this.sessionId = null;
        this.sendReady();
      }
    }
    sendNavigating() {
      const clonableSuiteParameters = Object.assign({}, this.suiteParameters);
      clonableSuiteParameters.deferredNavigation = clonableSuiteParameters.deferredNavigation.toString();
      const { url, navigationType } = this.suiteParameters;
      const message = {
        type: TYPE_NAVIGATING,
        source: this.pageId,
        target: NAME_REPORTER,
        url: url,
        navigationType: navigationType,
        suite: this.suite,
        suiteParameters: clonableSuiteParameters,
        timestamp: Date.now(),
      };
      //console.log(`${this.state}.sendNavigating`, message);
      this.mediatorPort.postMessage(message);
      this.sendDisconnectForNavigation();
    }
    sendNavigatingDeferred() {
      const clonableSuiteParameters = Object.assign({}, this.suiteParameters);
      clonableSuiteParameters.deferredNavigation = clonableSuiteParameters.deferredNavigation.toString();
      const { url, navigationType } = this.suiteParameters;
      const message = {
        type: TYPE_NAVIGATING,
        source: this.pageId,
        target: NAME_REPORTER,
        url: url,
        navigationType: navigationType, // = NAVI_DEFERRED, // TODO: other types
        suite: this.suite,
        suiteParameters: clonableSuiteParameters,
        timestamp: Date.now(),
      };
      //console.log(`${this.state}.sendNavigatingDeferred`, message);
      this.mediatorPort.postMessage(message);
      this.state = DRIVER_STATE_NAVIGATING1;
      this.sendDisconnectForNavigation();
    }
    sendDisconnectForNavigation() {
      const message = {
        type: TYPE_DISCONNECT,
        source: this.pageId,
        target: NAME_MEDIATOR,
        url: this.url,
        coverageAvailable: !!globalThis.__coverage__,
      };
      //console.log(`${this.state}.sendDisconnectForNavigation`, message);
      this.mediatorPort.postMessage(message);
      this.state = DRIVER_STATE_NAVIGATING2;
      this.navigate();
    }
    navigate() {
      //console.log(`${this.state}.navigate: suiteParameters: `, this.suiteParameters);
      this.state = DRIVER_STATE_NAVIGATING3;
      //console.log(`${this.state}.navigate: deferredNavigation called`);
      this.suiteParameters.deferredNavigation();
    }
    error(e) {
      this.reason = reason || new Error(`${this.state}: Unknown Error`);
      this.state = DRIVER_STATE_ERROR;
      console.error(`Driver.error: `, this.reason);
      if (!(this.mediatorPort instanceof MessagePort && this.pageId)) {
        this.closeWindow();
      }
    }
    sendClosing() {
      this.state = DRIVER_STATE_CLOSING0;
      this.mediatorPort.postMessage({
        type: TYPE_CLOSING,
        source: this.pageId,
        target: NAME_REPORTER,
        url: this.url,
      });
      this.disconnect();
    }
    disconnect() {
      this.state = DRIVER_STATE_CLOSING1;
      this.mediatorPort.postMessage({
        type: TYPE_DISCONNECT,
        source: this.pageId,
        target: NAME_MEDIATOR,
        url: this.url,
        coverageAvailable: !!globalThis.__coverage__,
      });
      this.closeWindow();
    }
    closeWindow() {
      this.state = DRIVER_STATE_CLOSING2;
      console.warn('TODO: Driver.closeWindow() has to wait for cleanup');
      if (this.mediatorWindow) {
        this.mediatorWindow.close();
      }
      window.close();
    }
  }

  const driver = new Driver();
  driver.dispatchEvent(new CustomEvent('start'));

}
catch (e) {
  console.error('Fatal Exception:', e);
}
