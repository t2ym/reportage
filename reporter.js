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
  TYPE_CONNECT,
  TYPE_DISCONNECT,
  TYPE_DETACH,
  TYPE_TRANSFER_PORT,
  TYPE_REQUEST_SESSION,
  TYPE_START_SESSION,
  TYPE_END_SESSION,
  TYPE_CLOSE,
  TYPE_CLOSING,
  TYPE_NAVIGATE,
  TYPE_COVERAGE,
  TYPE_COLLECT_COVERAGE,

  DISPATCHER_STATE_CLOSED,
  DISPATCHER_STATE_NAVIGATING0,
  DISPATCHER_STATE_NAVIGATING1,
  DISPATCHER_STATE_READY0,
  DISPATCHER_STATE_READY1,
  DISPATCHER_STATE_STARTING0,
  DISPATCHER_STATE_STARTING1,
  DISPATCHER_STATE_RUNNING,
  DISPATCHER_STATE_STOPPED,
  DISPATCHER_STATE_CLOSING,
  DISPATCHER_STATE_ERROR,

  SESSION_PHASE_STATE_INITIAL,
  SESSION_PHASE_STATE_CONTINUING,
  SESSION_PHASE_STATE_FINAL,

  AGGREGATION_EVENT_PHASE_CONTINUING,
  AGGREGATION_EVENT_PHASE_FINAL,
  AGGREGATION_EVENT_SCOPE_CONTINUING,
  AGGREGATION_EVENT_SCOPE_FINAL,
  AGGREGATION_EVENT_RUN_CONTINUING,
  AGGREGATION_EVENT_RUN_FINAL,

  TEST_UI_SCENARIST,
  //TEST_UI_BDD, // not implemented (low priority)
  //TEST_UI_TDD, // not implemented (low priority)

  SUITE_COMMON,
  SUITE_HTML,
  TYPE_NAVIGATING,
  NAVI_LOCATION_HREF,
  NAVI_LOCATION_ASSIGN,
  NAVI_LOCATION_REPLACE,
  NAVI_HISTORY_REPLACE,
  NAVI_HISTORY_PUSH,
  NAVI_DEFERRED,
  NAVI_WINDOW_OPEN,

  NAVI_HISTORY_GO,

} from './constants.js';
//import { MochaConsoleBuffer, MochaConsole, MochaConsoleFlush } from './mocha-console.js';

try {
  const reporterURL = new URL(location.href);
  const testConfigPath = (reporterURL.hash.substring(1) || '/test/reportage.config.js').split('?')[0];

  const { default: Config } = await import(testConfigPath);

  await Config.importedBy(import.meta.url);
  window.Config = Config; // for debugging

  const { default: Suite } = await import(Config.suitesLoaderPath);

  mochaInstaller(_globalThis, _globalThis, console);
  const { ReceiverRunner } = reporterInstaller(_globalThis.Mocha, Config);

  const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
    EVENT_HOOK_BEGIN,
    EVENT_TEST_PASS,
    EVENT_TEST_FAIL,
    EVENT_TEST_PENDING,
    STATE_IDLE,
    STATE_RUNNING,
    STATE_STOPPED,
  } = _globalThis.Mocha.Runner.constants;

  const startButton = document.getElementById('start-button');

  {
    let w = window.open("about:blank"); // open a new window without user interaction
    if (w) {
      w.close();
    }
    else {
      console.error(`Popup blocking on the reporter host domain ${location.hostname} has to be disabled for the site to open target apps!` +
      `The instruction on how to allow pop-ups and redirects from a site is found at ` +
      `https://support.google.com/chrome/answer/95472?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Callow-pop-ups-and-redirects-from-a-site`);
      console.error(`The command line option --disable-popup-blocking is also effective if it is applied properly to Chrome browser processes`);
      throw new Error('popup blocking must be disabled for the reporter and app origins ' + [Config.reporterOrigin, ...Config.originGenerator()].join(' '));
    }
  }
  {
    let listener;
    let timerResolve;
    let timerPromise = new Promise((resolve) => {
      timerResolve = resolve;
    });
    let blurReceived = false;
    window.addEventListener('blur', listener = (event) => {
      blurReceived = true;
      window.removeEventListener('blur', listener);
      setTimeout(() => {
        const start = Date.now();
        let counter = 0;
        let intervalId = setInterval(() => {
          if (counter < 2) {
            counter++;
          }
          else {
            clearInterval(intervalId);
            const now = Date.now();
            timerResolve(now - start);
          }
        }, 1);
      }, 1);
    });
    const w = window.open('about:blank', '_checktimer');
    setTimeout(() => {
      if (!blurReceived) {
        timerResolve(1); // It seems the blur event is not fired in puppeteer
      }
    }, 500);
    let duration = await timerPromise;
    console.log(`duration ${duration}`);
    w.close();
    if (duration > 500) {
      console.error(`The Chrome command line option --disable-background-timer-throttling is required to run tests in background windows/tabs`);
      console.warn(`For stable tests, please confirm these options are configured for Chrome:\n\t--disable-background-timer-throttling\n\t--disable-ipc-flooding-protection\n\t--disable-pushstate-throttle`);
      throw new Error(`The Chrome command line option --disable-background-timer-throttling is required to run tests in background windows/tabs`);
    }
  }

  const worker = new SharedWorker(Config.mediatorWorkerPathRelativeToReportage, { /* type: 'module', */name: NAME_MEDIATOR });
  const mediatorPort = await new Promise((resolve, reject) => {
    // TODO: timeout error handling
    worker.port.onmessage = (event) => {
      const { type, transfer } = event.data;
      const port = transfer[0];
      if (type === TYPE_TRANSFER_PORT) {
        port.addEventListener('message', function onMessage (_event) {
          console.log('reporter.js: received message', _event.data);
          const { type, source, target } = _event.data;
          if (type === TYPE_READY) {
            if (source === NAME_REPORTER && target === NAME_REPORTER) {
              console.log('reporter.js: ready');
              port.removeEventListener('message', onMessage);
              resolve(port);
            }
            else {
              console.error('reporter.js: unexpected ready message received', _event);
              reject(new Error(_event.data.errorMessage));
            }
          }
          else if (type === TYPE_ERROR) {
            console.error('reporter.js: error message received', _event);
            reject(new Error(_event.data.errorMessage));
          }
        });
        port.start();
        port.postMessage({
          type: TYPE_READY,
          source: NAME_REPORTER,
          target: NAME_REPORTER, // expecting a mirror response
        });    
      }
      else {
        reject(new Error(`unknown message type ${type} from mediator-worker.js`));
      }
    }
    worker.port.postMessage({
      type: TYPE_CONNECT,
    }, []);
  });

  class ReportageHTML extends _globalThis.Mocha.reporters.HTML {
    constructor(runner, options) {
      super(runner, options);
    }
    suiteURL(suite) {
      let url;
      if (Array.isArray(suite.context)) {
        for (let { title, value } of suite.context) {
          if (title === 'suiteURL') {
            url = value;
            break;
          }
        }
      }
      if (!url) {
        const reporterURL = new URL(Config.reporterURL);
        const configPath = (reporterURL.hash.substring(1) || '/test/reportage.config.js').split('?')[0];
        url = `${reporterURL.origin}${reporterURL.pathname}${reporterURL.search}#${configPath}`;
      }
      return url;
    }
    testURL(test) {
      let url;
      if (Array.isArray(test.context)) {
        for (let { title, value } of test.context) {
          if (title === 'testURL') {
            url = value;
            break;
          }
        }
        /*
        if (url && test.state === 'failed' && typeof test.err.stack === 'string') {
          let stack = test.err.stack.split('\n');
          if (stack[1]) {
            let match = stack[1].match(/^[ ]*at [^\(]*\(([^\)]*)\)/);
            if (match && match[1]) {
              url += `&breakpoint=${encodeURIComponent(match[1])}`
            }
          } 
        }
        */
      }
      if (!url) {
        const reporterURL = new URL(Config.reporterURL);
        const configPath = (reporterURL.hash.substring(1) || '/test/reportage.config.js').split('?')[0];
        url = `${reporterURL.origin}${reporterURL.pathname}${reporterURL.search}#${configPath}`;
      }
      return url;
    }
    addCodeToggle(el, contents) {
      super.addCodeToggle(el, contents);
      const a = el.querySelector('a');
      a.addEventListener('click', (event) => {
        event.stopPropagation(); // clicking the replay button does not toggle the show/hide status of the code
      });
    }
  }

  const suiteGenerator_Scenarist = function* suiteGenerator_Scenarist(Suite) {
    let suiteIndex = 0;
    const pseudoSearchParamsInHash = new URL(location.hash.substring(1), Config.reporterOrigin).searchParams;
    const targetScope = pseudoSearchParamsInHash.get('scope');
    const targetTestIndexRaw = pseudoSearchParamsInHash.get('testIndex');
    const targetTestIndex = targetTestIndexRaw ? parseInt(targetTestIndexRaw) : -1;
    const targetTestClass = pseudoSearchParamsInHash.get('testClass');
    for (let scope in Suite.scopes) {
      if (Suite.scopes[scope][SUITE_HTML] === SUITE_COMMON) {
        continue; // skip running common suites
      }
      if (targetScope && scope !== targetScope) {
        continue; // skip non-target scope
      }
      const testList = Suite.scopes[scope].test;
      for (let index = 0; index < testList.length; index++) {
        const tests = testList[index];
        const classList = tests.split(',');
        let testFound = false;
        for (let i = 0; i < classList.length; i++) {
          const _class = Suite.scopes[scope].classes[classList[i]];
          if (_class && (_class.prototype.operation || _class.prototype.checkpoint)) {
            testFound = true;
            break;
          }
        }
        if (!testFound) {
          continue; // skip empty tests
        }
        if (targetTestIndexRaw) {
          if (index !== targetTestIndex) {
            continue; // skip non-target testClass index
          }
        }
        console.log(`[${suiteIndex}] Suite.scopes['${scope}'].test[${index}] = '${tests}'`)
        const suite = {
          suiteIndex: suiteIndex,
          ui: TEST_UI_SCENARIST,
          scope: scope,
          testIndex: index,
          lastInScope: index + 1 == testList.length,
          tests: tests,
          testClass: targetTestClass,
          [SUITE_HTML]: Suite.scopes[scope][SUITE_HTML],
        };
        yield suite;
        suiteIndex++;
      }
    }
  }

  class AggregationBuffer extends Array {
    constructor() {
      super();
      this.current = this.top;
      this.done = this.current;
    }
    get size() {
      return this.length;
    }
    get top() {
      return this.size - 1;
    }
    isEmpty() {
      return this.size === 0;
    }
    cleanup() {
      console.log(`before cleanup`, this);
      if (this[this.current].type === EVENT_SUITE_END) {
        let suiteBeginIndex = this.findSuiteBegin();
        if (suiteBeginIndex > 0) {
          // cleanup suite
          this.splice(suiteBeginIndex, this.current - suiteBeginIndex + 1);
          this.current = suiteBeginIndex - 1;
          this.done = this.current;
        }
        else {
          throw new Error(`${this.constructor.name}.cleanup: cannot find ${EVENT_SUITE_BEGIN} for __mocha_id__ (${this[this.current].arg.__mocha_id__})`);
        }
      }
      else if (this[this.current].type === EVENT_RUN_END) {
        let startIndex = this.findStart();
        if (startIndex >= 0) {
          // cleanup start - end
          this.splice(startIndex, this.current - startIndex + 1);
          this.current = startIndex - 1;
          this.done = this.current;
        }
        else {
          throw new Error(`${this.constructor.name}.cleanup: cannot find ${EVENT_RUN_BEGIN}`);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.cleanup: current.type (${this[this.current].type}) is not ${EVENT_SUITE_END}`);
      }
      console.log(`after cleanup`, this);
    }
    findSuiteBegin() {
      for (let index = this.current - 1; index >= 0; index--) {
        if (this[index].type === EVENT_SUITE_BEGIN &&
            this[this.current].arg.__mocha_id__ === this[index].arg.__mocha_id__) {
          return index;
        }
      }
      return -1;
    }
    findStart() {
      for (let index = this.current - 1; index >= 0; index--) {
        if (this[index].type === EVENT_RUN_BEGIN) {
          return index;
        }
      }
      return -1;
    }
    findAncestors(aggregator) {
      //console.log(`${this.constructor.name}.findAncestors`, this.map(e => ({ type: e.type, id: e.arg.__mocha_id__, parent: (e.arg.parent ? e.arg.parent.__mocha_id__ : ''), alias: aggregator.alias[e.arg.__mocha_id__] })));
      let index = this.current;
      let ancestors = [];
      FIND_IMMEDIATE_PARENT_SWITCH:
      switch (this[index].type) {
      case EVENT_SUITE_BEGIN:
        break; // already at the immediate parent
      case EVENT_TEST_FAIL:
      case EVENT_TEST_PENDING:
      case EVENT_TEST_PASS:
      case EVENT_HOOK_BEGIN:
        {
          const child = this[index];
          for (; index >= 0; index--) {
            if (this[index].type === EVENT_SUITE_BEGIN &&
                (this[index].arg.__mocha_id__ === child.arg.parent.__mocha_id__ ||
                 aggregator.alias[this[index].arg.__mocha_id__] === child.arg.parent.__mocha_id__)) {
              break FIND_IMMEDIATE_PARENT_SWITCH; // the immediate parent is found
            }
          }
        }
      default:
        console.error(`Session.findAncestors: cannot find the immediate parent of ${this[this.current].type}`);
        return ancestors;
      }
      ancestors.push(this[index]);
      //console.log(`${this.constructor.name}.findAncestors: ancestors.push ${this[index].type} id: ${this[index].arg.__mocha_id__} parent: ${this[index].arg.parent ? this[index].arg.parent.__mocha_id__ : ''} alias: ${aggregator.alias[this[index].arg.__mocha_id__]}`);
      let child;
      while (index > 0 && this[index].arg && this[index].arg.parent) {
        child = this[index];
        index--;
        for (; index >= 0; index--) {
          if (this[index].type === EVENT_SUITE_BEGIN &&
              (this[index].arg.__mocha_id__ === child.arg.parent.__mocha_id__ ||
               aggregator.alias[this[index].arg.__mocha_id__] === child.arg.parent.__mocha_id__)) {
            ancestors.push(this[index]);
            //console.log(`${this.constructor.name}.findAncestors: ancestors.push ${this[index].type} id: ${this[index].arg.__mocha_id__} parent: ${this[index].arg.parent ? this[index].arg.parent.__mocha_id__ : ''} alias: ${aggregator.alias[this[index].arg.__mocha_id__]}`);
            break;
          }
        }
      }
      if (index == 1 && this[index].arg && this[index].arg.root) {
        // find start
        index--;
        if (this[index].type === EVENT_RUN_BEGIN) {
          ancestors.push(this[index]);
          //console.log(`${this.constructor.name}.findAncestors: ancestors.push ${this[index].type} id: ${this[index].arg.__mocha_id__} parent: ${this[index].arg.parent ? this[index].arg.parent.__mocha_id__ : ''} alias: ${aggregator.alias[this[index].arg.__mocha_id__]}`);
        }
        else {
          console.error(`Session.findAncestors: cannot find start`);
        }
      }
      else {
        console.error(`Session.findAncestors: cannot find the root suite ${JSON.stringify(this.map(e => e.type))}`);
      }
      return ancestors;
    }
    insert(mEvent) {
      if (!mEvent) {
        throw new Error(`${this.constructor.name}.insert: empty mEvent`);
      }
      if (this.current >= 0) {
        this.splice(this.current, 0, mEvent);
      }
      else {
        throw new Error(`${this.constructor.name}.insert: current (${this.current}) is negative`);
      }
    }
  }

  class Session {
    constructor(dispatcher) {
      this.state = STATE_IDLE;
      this.mEvents = new AggregationBuffer();
      this.phaseState = SESSION_PHASE_STATE_INITIAL;
      this.sessionId = this.createSessionId();
      this.dispatcher = dispatcher;
    }
    createSessionId() {
      return crypto.randomUUID
              ? crypto.randomUUID()
              : (() => {
                  const hex = Array.prototype.map.call(
                    crypto.getRandomValues(new Uint16Array(8)),
                    (v) => v.toString(16).padStart(4, '0'));
                  return `${hex[0]}${hex[1]}-${hex[2]}-${hex[3]}-${hex[4]}-${hex[5]}${hex[6]}${hex[7]}`
                })();
    }
    createPseudoMochaId() {
      const chars = 'abcdefghiklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
      const length = chars.length;
      return Array.prototype.map.call(
        crypto.getRandomValues(new Uint8Array(21)),
        v => chars[v % length]).join('');
    }
    onStartSessionMessage(startSessionData) {
      this.startSessionData = startSessionData;
      if (this.onStartSession(this.startSessionData)) {
        this.state = STATE_RUNNING;
        return true;
      }
      else {
        return null;
      }
    }
    onStartSession(eventData) {
      /*
        {
          type: "startSession",
          sessionId: "",
          runner: { total: num, stats: { } },
          options: { reporterOptions: {} },
        }
      */
      if (eventData &&
          typeof eventData === 'object' &&
          eventData.type === TYPE_START_SESSION &&
          typeof eventData.runner === 'object') {
        this.total = eventData.runner.total;
        this.stats = eventData.runner.stats;
        this.options = eventData.options;
        console.log('Session.onStartSession: ', eventData);
        return true;
      }
      else {
        console.error('Session.onStartSession: invalid event.data', eventData);
        return false;
      }
    }
    createChannel() {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        //const latency = Date.now() - event.data.sent;
        //console.warn(`message latency: ${latency}`);
        switch (event.data.op) {
        case 'write':
          let mEvent = event.data.payload;
          if (Array.isArray(mEvent)) {
            this.mEvents.splice(this.mEvents.length, 0, ...mEvent);
          }
          else {
            this.mEvents.push(mEvent);
          }
          this.mEvents.current = this.mEvents.top;
          this.onWrite(mEvent);
          break;
        case 'close':
          console.log("Session.channel.close");
          this.onClose();
          break;
        case 'abort':
          console.log("Session.channel.abort", event.data.err);
          this.onAbort(event.data.err);
          break;
        case 'beacon':
          console.log(`Session.channel.beacon ${this.dispatcher ? this.dispatcher.url : 'no dispatcher'}`);
          this.onBeacon(event.data.sent);
          break;
        }
      };
      const intervalId = setInterval(() => {
        if (this.state === STATE_RUNNING && this.dispatcher) {
          if (!this.beacon) {
            this.beacon = { checked: Date.now() };
          }
          else if (this.beacon.received && Date.now() - this.beacon.received > Config.beaconTimeout) {
            console.log(`Session.channel.beacon timeout ${this.dispatcher.url}`);
            clearInterval(intervalId);
            this.onAbort(' beacon timed out');
          }
          else if (Date.now() - this.beacon.checked > Config.beaconTimeout) {
            //console.log(`Session.channel.beacon timeout ${this.dispatcher.url}`);
            throw new Error(`Session.channel.beacon timeout ${this.dispatcher.url}`);
          }
        }
        else if (this.state === STATE_STOPPED) {
          clearInterval(intervalId);
        }
      }, 1000);
      return channel.port2;
    }
    onBeacon(sent) {
      this.beacon = { received: Date.now(), sent: sent };
    }
    onWrite(mEvent) {
      if (Array.isArray(mEvent)) {
        console.log('Session.onWrite() ', ...mEvent.map((e) => e.type));
      }
      else {
        console.log('Session.onWrite() ', mEvent.type);
      }
      if (this.aggregator) {
        this.aggregator.onWrite(this, mEvent);
        this.mEvents.done = this.mEvents.current;
      }
    }
    onClose() {
      console.log('Session.onClose()');
      this.state = STATE_STOPPED;
      if (this.aggregator) {
        this.aggregator.onClose(this);
      }
    }
    onAbort(err) {
      console.log('Session.onAbort()');
      this.supplementFailOnAbort(err);
      if (this.dispatcher) {
        this.dispatcher.detach();
        this.dispatcher.closed();
      }
      if (this.aggregator) {
        this.aggregator.onAbort(this, err);
        this.mEvents.done = this.mEvents.current;
      }
      this.state = STATE_STOPPED;
      this.phaseState = SESSION_PHASE_STATE_FINAL;
      if (this.aggregator) {
        this.aggregator.onClose(this);
      }
      if (this.dispatcher) {
        const dispatcher = this.dispatcher;
        this.dispatcher = null;
        dispatcher.dispatchEvent(new CustomEvent('start', { detail: {} }));
      }
    }
    onReady() {
      console.log(`Session.onReady()`);
      this.phaseState = SESSION_PHASE_STATE_FINAL;
      if (this.aggregator) {
        this.aggregator.onReady(this);
      }
    }
    onNavigating() {
      console.log(`Session.onNavigating()`);
      this.phaseState = SESSION_PHASE_STATE_CONTINUING;
      if (this.aggregator) {
        this.aggregator.onNavigating(this);
      }
    }
    supplementFailOnAbort(err) {
      console.log('Session.supplementFailOnAbort');
      let ancestors = this.mEvents.findAncestors(this.aggregator);
      if (ancestors.length > 0 && ancestors[ancestors.length - 1].type === EVENT_RUN_BEGIN) {
        const pseudoEvents = [];
        let index;
        // supplement a fail event
        const title = 'aborted test';
        const titlePath = [];
        for (index = 0; index < ancestors.length - 1; index++) {
          if (ancestors[index].type === EVENT_SUITE_BEGIN &&
              ancestors[index].arg.title) {
            titlePath.unshift(ancestors[index].arg.title);
          }
        }
        titlePath.push(title);
        const pseudoFailEvent = {
          "type": EVENT_TEST_FAIL,
          "stats": { ...this.mEvents[this.mEvents.current].stats },
          "timings": {
            "enqueue": Date.now(),
            "write": Date.now(),
          },
          "arg": {
            "$$currentRetry": 0,
            "$$fullTitle": ancestors[0].arg.$$fullTitle + ' ' + title,
            "$$isPending": false,
            "$$retriedTest": null,
            "$$slow": 0,
            "$$titlePath": titlePath,
            "body": "window closed",
            "duration": 0,
            "err": {
              "$$toString": "Error: Aborted Test",
              "message": "Target application window was unexpectedly closed",
              "stack": err
            },
            "parent": {
              "$$fullTitle": ancestors[0].arg.$$fullTitle,
              "__mocha_id__": ancestors[0].arg.__mocha_id__
            },
            "state": "failed",
            "title": title,
            "type": "test",
            "file": null,
            "__mocha_id__": this.createPseudoMochaId(),
            "context": []
          }
        };
        pseudoEvents.push(pseudoFailEvent);
        for (index = 0; index < ancestors.length; index++) {
          if (ancestors[index].type === EVENT_SUITE_BEGIN) {
            // supplement a suite end event
            const pseudoSuiteEndEvent = {
              "type": EVENT_SUITE_END,
              "stats": { ...this.mEvents[this.mEvents.current].stats },
              "timings": {
                "enqueue": Date.now(),
                "write": Date.now()
              },
              "arg": {
                "_bail": false,
                "$$fullTitle": ancestors[index].arg.$$fullTitle,
                "$$isPending": false,
                "root": ancestors[index].arg.root,
                "title": ancestors[index].arg.title,
                "__mocha_id__": ancestors[index].arg.__mocha_id__,
                "parent": ancestors[index].arg.parent
                  ? { ...ancestors[index].arg.parent }
                  : ancestors[index].arg.parent
              }
            };
            pseudoEvents.push(pseudoSuiteEndEvent);
          }
          else if (ancestors[index].type === EVENT_RUN_BEGIN) {
            // supplement an end event
            const now = (new Date()).toISOString();
            const pseudoEndEvent = {
              "type": EVENT_RUN_END,
              "stats": Object.assign(Object.assign({}, this.mEvents[this.mEvents.current].stats), {
                "end": now,
                "duration": 0
              }),
              "timings": {
                "enqueue": Date.now()
              },
              "arg": {
                "$$fulltitle": ""
              }
            };
            pseudoEvents.push(pseudoEndEvent);
          }
          else {
            console.error(`Session.supplementFailOnAbort: invalid acnestor type ${ancestors[index].type}`);
          }
        }
        this.mEvents.splice(this.mEvents.length, 0, ...pseudoEvents);
        this.mEvents.current = this.mEvents.top;
      }
      else {
        console.error('Session.supplementFailOnAbort: no valid ancestors found');
      }
    }
  }

  class Aggregator {
    constructor(suites, Suite, reporterOptions) {
      this.suites = suites;
      this.buffer = new AggregationBuffer();
      this.mEventQueue = [];
      this.alias = {};
      this.sessionSuiteMap = new WeakMap();
      this.initializeIndices();
      this.initializeStats(Suite);
      this.setupReceiverRunner(reporterOptions);
    }
    initializeIndices() {
      this.suiteIndex = -1;
      this.sessionIndex = -1;
      this.mEventIndex = -1;
    }
    initializeStats(Suite) {
      const counters = {
        describe: 0,
        it: 0,
        before: 0,
        after: 0,
      };
      const context = {
        describe: (name, cb) => {
          counters.describe++;
          cb();
        },
        it: (name, cb) => {
          counters.it++;
        },
        before: (name, cb) => {
          counters.before++;
        },
        after: (name, cb) => {
          counters.after++;
        },
      }
      const pseudoSearchParamsInHash = new URL(location.hash.substring(1), Config.reporterOrigin).searchParams;
      const targetScope = pseudoSearchParamsInHash.get('scope');
      const targetTestIndexRaw = pseudoSearchParamsInHash.get('testIndex');
      const targetTestIndex = targetTestIndexRaw ? parseInt(targetTestIndexRaw) : -1;
      const targetTestClass = pseudoSearchParamsInHash.get('testClass');
      for (let scope in Suite.scopes) {
        if (Suite.scopes[scope][SUITE_HTML] === SUITE_COMMON) {
          continue; // skip running common suites
        }
        if (targetScope && scope !== targetScope) {
          continue; // skip non-target scope
        }
        const testList = Suite.scopes[scope].test;
        for (let index = 0; index < testList.length; index++) {
          const tests = testList[index];
          const classList = tests.split(',');
          let testFound = false;
          for (let i = 0; i < classList.length; i++) {
            const _class = Suite.scopes[scope].classes[classList[i]];
            if (_class && (_class.prototype.operation || _class.prototype.checkpoint)) {
              testFound = true;
              break;
            }
          }
          if (!testFound) {
            continue; // skip empty tests
          }
          if (targetTestIndexRaw) {
            if (index !== targetTestIndex) {
              continue; // skip non-target testClass index
            }
          }
          Suite.scopes[scope].run(index, undefined, context);
        }
      }
      this.total = counters.it;
      this.stats = {
        suites: counters.describe,
        tests: 0,
        passes: 0,
        failures: 0,
        pending: 0,
        start: new Date(),
      };
    }
    setupReceiverRunner(reporterOptions = {}) {
      this.receiverRunner = new ReceiverRunner(ReportageHTML);
      /*
        { runner: { total: num, stats: { } }, options: { reporterOptions: {} } }
      */
      this.receiverRunner.onOpen({
        runner: {
          total: this.total,
          stats: Object.assign({}, this.stats),
        },
        options: {
          reporterOptions: reporterOptions,
        },
      });
    }
    log(eventType = 'log') {
      console.log(`${this.constructor.name}.${eventType}: suiteIndex=${this.suiteIndex}, sessionIndex=${this.sessionIndex}, mEventIndex=${this.mEventIndex}`);
      console.log(`Buffer: top=${this.buffer.top}, current=${this.buffer.current}, done=${this.buffer.done}`, this.buffer.map(item => item.type));
    }
    enqueueMochaEvent(mEvent) {
      console.log(`${this.constructor.name}.enqueueMochaEvent: mEvent`, mEvent);
      //this.onMochaEvent(mEvent); // do not enqueue
      this.mEventQueue.push(mEvent);
    }
    flushMochaEvents() {
      let mEvent;
      while (mEvent = this.mEventQueue.shift()) {
        console.log(`${this.constructor.name}.flushMochaEvents: mEvent`, mEvent);
        try {
          this.onMochaEvent(mEvent);
        }
        catch (e) {
          // TODO: handle errors
          console.error(`${this.constructor.name}.flushMochaEvents: exception in onMochaEvent`, e, mEvent)
        }
      }
    }
    proceed(callerMethod) {
      if (this.proceeding) {
        console.warn(`${this.constructor.name}.proceed: skipping ${callerMethod} since proceeding ${this.proceeding}`)
        return;
      }
      else {
        this.proceeding = callerMethod;
      }
      if (!this.done && callerMethod === 'onLogTotalSuites' && this.suites.totalSuites == 0) {
        console.log(`${this.constructor.name}.proceed:${callerMethod}: totalSuites is zero ${this.suites.totalSuites}`);
        this.done = true;
        let mEvent;
        mEvent = ({ type: EVENT_RUN_BEGIN, arg: { } });
        console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
        this.buffer.push(mEvent);
        this.buffer.current = this.buffer.top;
        this.enqueueMochaEvent(mEvent);

        mEvent = ({ type: EVENT_RUN_END, arg: { }, stats: { passes: 0, pending: 0, failures: 0, duration: 0 } });
        if (window.__coverage__) {
          mEvent.arg.__coverage__ = [];
        }
        console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
        this.buffer.push(mEvent);
        this.buffer.current = this.buffer.top;
        this.enqueueMochaEvent(mEvent);

        mEvent = ({ type: AGGREGATION_EVENT_RUN_FINAL, totalSuites: 0 });
        console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
        this.enqueueMochaEvent(mEvent);
        this.flushMochaEvents();
        return;
      }
      callerMethod = `${this.constructor.name}.proceed:${callerMethod}:`;
      let buf = {};
      let _suiteIndex = this.suiteIndex;
      let _sessionIndex = this.sessionIndex;
      let _mEventIndex = this.mEventIndex;
      let continuous = true;
      if (this.suites.length < 1) {
        if (continuous) {
          continuous = false;
        }
      }
      let initialSuiteIndex =
        this.suiteIndex < 0
          ? 0
          : this.suiteIndex;
      for (let suiteIndex = initialSuiteIndex; continuous && suiteIndex < this.suites.length; suiteIndex++) {
        let suite = this.suites[suiteIndex];
        let _suite = {};
        let _suiteFinished = false;
        buf[suiteIndex] = _suite;
        if (!suite.sessions) {
          if (continuous) {
            continuous = false;
            _suiteIndex = suiteIndex;
            _sessionIndex = -1;
            _mEventIndex = -1;
          }
          continue;
        }
        let initialSessionIndex =
          suiteIndex === this.suiteIndex &&
          this.sessionIndex >= 0
            ? this.sessionIndex
            : 0;
        for (let sessionIndex = initialSessionIndex; continuous && sessionIndex < suite.sessions.length; sessionIndex++) {
          let session = suite.sessions[sessionIndex];
          let _session = [];
          _suite[sessionIndex] = _session;
          let __mEventIndex = -1;
          let initialmEventIndex =
            suiteIndex === this.suiteIndex &&
            sessionIndex === this.sessionIndex &&
            this.mEventIndex >= 0
              ? this.mEventIndex
              : 0;
          for (let mEventIndex = initialmEventIndex; continuous && mEventIndex < session.mEvents.length; mEventIndex++) {
            let mEvent = session.mEvents[mEventIndex];
            __mEventIndex = mEventIndex;
            let { type } = mEvent;
            this.log(type);
            switch (type) {
            case EVENT_RUN_BEGIN:
              _session.push('Rb');
              break;
            case EVENT_RUN_END:
              _session.push('Re');
              break;
            case EVENT_SUITE_BEGIN:
              _session.push('Sb');
              break;
            case EVENT_SUITE_END:
              _session.push('Se');
              break;
            case EVENT_TEST_PASS:
              _session.push('Tp');
              break;
            case EVENT_TEST_FAIL:
              _session.push('Tf');
              break;
            case EVENT_TEST_PENDING:
              _session.push('Ts');
              break;
            default:
              break;
            }
            if (suiteIndex === this.suiteIndex &&
                sessionIndex === this.sessionIndex &&
                mEventIndex === this.mEventIndex) {
              continue; // already handled
            }
            console.log(`${this.constructor.name}.proceed: Send ${type} ${mEvent.arg.$$fullTitle || ''}`);
            this.enqueueMochaEvent(mEvent);
          } // loop for mEvents in a session
          const status = this.sessionSuiteMap.get(session);
          if (status && status.checked) {
            if (continuous) {
              switch (session.phaseState) {
              case SESSION_PHASE_STATE_INITIAL:
              case SESSION_PHASE_STATE_CONTINUING:
                if (sessionIndex === suite.sessions.length - 1) {
                  continuous = false;
                  _session.push('*');  
                  _suiteIndex = suiteIndex;
                  _sessionIndex = sessionIndex;
                  _mEventIndex = __mEventIndex;
                }
                break;
              case SESSION_PHASE_STATE_FINAL:
                _suiteFinished = true;
                if (typeof this.suites.totalSuites === 'number' &&
                    suiteIndex === this.suites.totalSuites - 1) {
                  // last session of last suite
                  continuous = false;
                  _session.push('*');  
                  _suiteIndex = suiteIndex;
                  _sessionIndex = sessionIndex;
                  _mEventIndex = __mEventIndex;
                }
                break;
              } // session.phaseState      
            }
          }
          else {
            if (continuous) {
              continuous = false;
              _session.push('*');  
              _suiteIndex = suiteIndex;
              _sessionIndex = sessionIndex;
              _mEventIndex = __mEventIndex;
            }
          }
          _session.push('|');
          _session.push(session.state);
          switch (session.phaseState) {
          case SESSION_PHASE_STATE_INITIAL:
            _session.push('Pi');
            break;
          case SESSION_PHASE_STATE_CONTINUING:
            _session.push('Pc');
            break;
          case SESSION_PHASE_STATE_FINAL:
            _session.push('Pf');
            break;
          } // session.phaseState
          if (sessionIndex === suite.sessions.length - 1 &&
              suite.lastInScope) {
            _session.push('Sf');
          }
          else {
            _session.push('Sc');
          }
          if (status && status.checked && !status.handled) {
            _session.push(`✔`);
            let mEvent;
            switch (session.phaseState) {
            case SESSION_PHASE_STATE_INITIAL:
              console.error(`${this.constructor.name}.proceed: unexpected session.phaseState ${session.phaseState}`);
              break;
            case SESSION_PHASE_STATE_CONTINUING:
              mEvent = ({ type: AGGREGATION_EVENT_PHASE_CONTINUING });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
              break;
            case SESSION_PHASE_STATE_FINAL:
              mEvent = ({ type: AGGREGATION_EVENT_PHASE_FINAL });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
              break;
            } // session.phaseState
            if (session.lastInScope) {
              mEvent = ({ type: AGGREGATION_EVENT_SCOPE_FINAL });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
            }
            else {
              mEvent = ({ type: AGGREGATION_EVENT_SCOPE_CONTINUING });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
            }
            if (session.lastInRun) {
              mEvent = ({ type: AGGREGATION_EVENT_RUN_FINAL });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
            }
            else {
              mEvent = ({ type: AGGREGATION_EVENT_RUN_CONTINUING });
              console.log(`${this.constructor.name}.proceed: Send ${mEvent.type}`);
              this.enqueueMochaEvent(mEvent);
            }
            status.handled = true;
            this.sessionSuiteMap.set(session, status);
          }
          else {
            _session.push('☐');
            console.log(`${this.constructor.name}.proceed: status: ${JSON.stringify(status)}`)
          }
          _suite[sessionIndex] = _session.join(' ');
          if (!(sessionIndex === suite.sessions.length - 1 &&
                suiteIndex === this.suites.length - 1)) {
          }
        } // loop for sessions in a suite
        if (_suiteFinished) {
          _suite.finished = true;
        }
        else {

        }
      } // loop for suites in a run
      console.log(`${callerMethod} ${_suiteIndex}:${_sessionIndex}:${_mEventIndex}:`, JSON.stringify(buf, null, 2));
      this.suiteIndex = _suiteIndex;
      this.sessionIndex = _sessionIndex;
      this.mEventIndex = _mEventIndex;
      this.proceeding = false;
      this.flushMochaEvents();
    }
    onLogSuite(suite) {
      console.log(`${this.constructor.name}.onLogSuite: `, suite);
      this.proceed('onLogSuite');
    }
    onLogSession(session, suiteIndex, phase) {
      session.aggregator = this;
      this.sessionSuiteMap.set(session, {
        suiteIndex: suiteIndex,
        phase: phase,
      });
      console.log(`${this.constructor.name}.onLogSession: `, session, suiteIndex, phase);
      this.proceed('onLogSession');
    }
    onLogTotalSuites(suites) {
      console.log(`${this.constructor.name}.onLogTotalSuites: `, suites.totalSuites);
      this.proceed('onLogTotalSuites');
    }
    onWrite(session, mEvent) {
      console.log(`${this.constructor.name}.onWrite: ${Array.isArray(mEvent) ? mEvent[0].type : mEvent.type}`);
      this.proceed('onWrite');
      //throw new Error(`${this.constructor.name}.onWrite: intentional error for testing`);
    }
    onClose(session) {
      console.log(`${this.constructor.name}.onClose: `);
      this.checkSessionStatus(session);
      this.proceed('onClose');
    }
    onAbort(session, err) {
      console.log(`${this.constructor.name}.onAbort: ${err}`);
      this.checkSessionStatus(session);
      this.proceed('onAbort');
    }
    onReady(session) {
      console.log(`${this.constructor.name}.onReady: `);
      this.checkSessionStatus(session);
      this.proceed('onReady');
    }
    onNavigating(session) {
      console.log(`${this.constructor.name}.onNavigating: `);
      this.checkSessionStatus(session);
      this.proceed('onNavigating');
    }
    checkSessionStatus(session) {
      const status = this.sessionSuiteMap.get(session);
      if (!status) {
        throw new Error(`${this.constructor.name}.checkSessionStatus: unknown session`);
      }
      if (status.checked) {
        // already checked
        return;
      }
      const suite = this.suites[status.suiteIndex];
      if (!suite) {
        throw new Error(`${this.constructor.name}.checkSessionStatus: unknown suite (${status.suiteIndex})`);
      }
      const phase = status.phase;
      if (suite.sessions[phase] !== session) {
        throw new Error(`${this.constructor.name}.checkSessionStatus: unknown session phase (${status.phase})`);
      }
      const totalSuites = this.suites.totalSuites;
      const lastInRun = suite.lastInRun;
      const lastInScope = suite.lastInScope;
      const phaseState = session.phaseState;
      // Either onClose or onReady/onNavigating may come earlier than the other
      if (phaseState === SESSION_PHASE_STATE_INITIAL) {
        // phaseState has not been updated yet
        return;
      }
      if (session.state !== STATE_STOPPED) {
        // session.state has not been updated yet
        return;
      }

      if (phaseState === SESSION_PHASE_STATE_FINAL && lastInScope) {
        // suite is last in scope AND the session phase is final
        session.lastInScope = true;
      }
      else {
        session.lastInScope = false;
      }

      if (phaseState === SESSION_PHASE_STATE_FINAL && lastInScope && lastInRun) {
        session.lastInRun = true;
      }
      else {
        session.lastInRun = false;
      }
      console.log(`${this.constructor.name}.checkSessionStatus: suiteIndex: ${status.suiteIndex} phase: ${phase} session.state: ${session.state} phaseState: ${phaseState} lastInScope: ${session.lastInScope} lastInRun: ${session.lastInRun} totalSuites: ${totalSuites}`);

      status.checked = true;
      this.sessionSuiteMap.set(session, status);
    }
    onStart(mEvent) {
      //throw new Error(`${this.constructor.name}.onStart: intentional error for testing`);
      if (this.buffer.isEmpty()) {
        this.buffer.push(mEvent);
        this.buffer.current = this.buffer.top;
        this.send(mEvent);  
        this.buffer.done = this.buffer.current;
      }
      else {
        // rewind
        this.buffer.current = 0;
        // [0].type must be start
        if (this.buffer[this.buffer.current].type === EVENT_RUN_BEGIN) {
          // skip start
        }
        else {
          throw new Error(`${this.constructor.name}.onStart: buffer[${this.buffer.current}].type is ${this.buffer[this.buffer.current].type} while ${EVENT_RUN_BEGIN} is expected`);
        }
      }
    }
    onEnd(mEvent) {
      if (this.buffer.isEmpty()) {
        // must not be empty on end
        throw new Error(`${this.constructor.name}.onEnd: buffer is unexpectedly empty`);
      }
      else if (this.buffer.current === this.buffer.top) {
        // current is at top
        // push
        this.buffer.push(mEvent);
        this.buffer.current = this.buffer.top;
        // skip sending
      }
      else if (this.buffer.current === this.buffer.top - 1) {
        // current is just before top
        // [top].type must be end
        if (this.buffer[this.buffer.top].type === EVENT_RUN_END) {
          // step current
          this.buffer.current++; // current === top
          // skip sending
        }
        else {
          throw new Error(`${this.constructor.name}.onEnd: buffer[top].type is ${this.buffer[this.buffer.top].type} while ${EVENT_RUN_END} is expected`);
        }
      }
    }
    onContinuingPhase() {
      this.buffer.current = this.buffer.done;
      if (this.buffer[this.buffer.current].type === EVENT_SUITE_BEGIN) {
        // skip suite
        this.buffer.current++;
      }
      // no flushing
      for (; this.buffer.current < this.buffer.top &&
             this.buffer[this.buffer.current].type !== EVENT_SUITE_END;
             this.buffer.current++) {
        // skip tests
        switch (this.buffer[this.buffer.current].type) {
        case EVENT_TEST_PASS:
        case EVENT_TEST_FAIL:
        case EVENT_TEST_PENDING:
          break;
        default:
          throw new Error(`${this.constructor.name}.onContinuingPhase: non-test type ${this.buffer[this.buffer.current].type} in continuing`);
          break;
        }
      }
      if (this.buffer.current < this.buffer.top &&
          this.buffer[this.buffer.current].type === EVENT_SUITE_END) {
        // skip suite end (current is already pointing the suite end)
      }
      else {
        throw new Error(`${this.constructor.name}.onContinuingPhase: ${EVENT_SUITE_END} not found in continuing`);
      }
    }
    onFinalPhase() {
      this.buffer.current = this.buffer.done;
      if (this.buffer[this.buffer.current].type === EVENT_SUITE_BEGIN) {
        // skip suite
        this.buffer.current++;
      }
      // flushing
      for (;this.buffer.current < this.buffer.top &&
            this.buffer[this.buffer.current].type !== EVENT_SUITE_END;
            this.buffer.current++) {
        // flush tests
        switch (this.buffer[this.buffer.current].type) {
        case EVENT_TEST_PASS:
        case EVENT_TEST_FAIL:
        case EVENT_TEST_PENDING:
          if (this.buffer.current <= this.buffer.done) {
            // skip
          }
          else {
            // send
            this.send(this.buffer[this.buffer.current]);
            this.buffer.done = this.buffer.current; // done++
          }
          break;
        default:
          throw new Error(`${this.constructor.name}.onFinalPhase: non-test type ${this.buffer[this.buffer.current].type} in flushing`);
          break;
        }
      }
      if (this.buffer.current < this.buffer.top &&
          this.buffer[this.buffer.current].type === EVENT_SUITE_END &&
          !this.buffer[this.buffer.current].arg.root) {
        // send suite end (current is already pointing the suite end)
        this.send(this.buffer[this.buffer.current]);
        this.buffer.done = this.buffer.current; // done++
        // cleanup
        this.buffer.cleanup();
      }
      else {
        throw new Error(`${this.constructor.name}.onFinalPhase: ${EVENT_SUITE_END} not found in continuing`);
      }
    }
    onNotLastInSession() {
      if (this.buffer[this.buffer.current].type === EVENT_SUITE_END) {
        const suiteEnd = this.buffer.current;
        this.buffer.current = this.buffer.done; // rewind to done
        if (this.buffer[this.buffer.current].type === EVENT_SUITE_BEGIN) {
          // skip suite
          this.buffer.current++;
        }
        // flushing
        for (; this.buffer.current < suiteEnd; this.buffer.current++) {
          // flush tests
          switch (this.buffer[this.buffer.current].type) {
          case EVENT_TEST_PASS:
          case EVENT_TEST_FAIL:
          case EVENT_TEST_PENDING:
            if (this.buffer.current <= this.buffer.done) {
              // skip
            }
            else {
              // send
              this.send(this.buffer[this.buffer.current]);
              this.buffer.done = this.buffer.current; // done++
            }
            break;
          default:
            throw new Error(`${this.constructor.name}.onNotLastInSession: non-test type ${this.buffer[this.buffer.current].type} in flushing`);
            break;
          }
        }
        // send suite end (current is already pointing the suite end)
        this.send(this.buffer[this.buffer.current]);
        this.buffer.done = this.buffer.current; // done++
        // cleanup
        this.buffer.cleanup();
      }
      else {
        // not suite end
        throw new Error(`${this.constructor.name}.onNotLastInSession: current type (${this.buffer[this.buffer.current].type}) is not ${EVENT_SUITE_END}`);
      }
    }
    onLastInScope() {
      if (this.buffer.current < this.buffer.top &&
          !this.buffer[this.buffer.current].arg.root) {
        // step 
        this.buffer.current++;
        // send
        this.send(this.buffer[this.buffer.current]);
        this.buffer.done = this.buffer.current; // done++
        // cleanup
        this.buffer.cleanup();
        this.log();
      }
      else {
        throw new Error(`${this.constructor.name}.onLastInScope: current (${this.buffer.current}) is at top (${this.buffer.top})`);
      }
    }
    onNotLastInScope() {
      if (this.buffer.current < this.buffer.top) {
        // step 
        this.buffer.current++;
        // skip
      }
      else {
        throw new Error(`${this.constructor.name}.onNotLastInScope: current (${this.buffer.current}) is at top (${this.buffer.top})`);
      }
    }
    onNoTotalSuites() {
      if (this.buffer.current + 2 === this.buffer.top) {
        // step current
        this.buffer.current++;
        // skip root suite end
        // step current
        this.buffer.current++;
        // skip end
      }
      else {
        throw new Error(`${this.constructor.name}.onNoTotalSuites: buffer.current (${this.buffer.current}) + 2 != buffer.top (${this.buffer.top})`);
      }
    }
    async collectCoverage() {
      if (Config.coverageOptions && Config.coverageOptions.enabled && globalThis.__coverage__) {
        // Coverage data for the extension and the mediator have to be collected
        // if and only if the covarage target is the reportage package itself
        //console.log(`${this.constructor.name}.collectCoverage: issueing collect-coverage and awaiting coverage event`);
        await new Promise(resolve => {
          window.addEventListener('coverage', (event) => {
            event.data = { __coverage__: event.detail };
            //console.log(`event.data`, JSON.stringify(event.data));
            Dispatcher.onCoverage(event);
            console.log(`${this.constructor.name}.collectCoverage: coverage event received`);
            resolve();
          });
          window.dispatchEvent(new CustomEvent('collect-coverage'));
        });
        //console.log(`${this.constructor.name}.collectCoverage: issueing ${TYPE_COLLECT_COVERAGE} and awaiting to call coverageResolve`);
        await new Promise(resolve => {
          this.suites.coverageResolve = resolve;
          this.suites.coverageResolveSource = NAME_MEDIATOR;
          mediatorPort.postMessage({
            type: TYPE_COLLECT_COVERAGE,
            source: NAME_REPORTER,
            target: NAME_MEDIATOR,
          });  
        });
        //console.log(`${this.constructor.name}.collectCoverage: coverageResolve called`);
      }
    }
    async onTotalSuites(totalSuites) {
      if (this.buffer.current + 2 === this.buffer.top) {
        if (this.buffer.current === this.buffer.done) {
          // step
          this.buffer.current++;
          // send suite end
          this.send(this.buffer[this.buffer.current]);
          this.buffer.done = this.buffer.current;
          // cleanup
          this.buffer.cleanup();
          this.log();

          // step
          this.buffer.current++;
          // merge coverage
          await this.collectCoverage();
          this.buffer[this.buffer.current].arg.__coverage__ = this.buffer[this.buffer.current].arg.__coverage__ || [];
          if (Array.isArray(this.suites.__coverage__) && this.suites.__coverage__.length > 0) {
            this.buffer[this.buffer.current].arg.__coverage__.splice(0, 0, ...this.suites.__coverage__);
          }
          if (Array.isArray(this.buffer[this.buffer.current].arg.__coverage__) && globalThis.__coverage__) {
            this.buffer[this.buffer.current].arg.__coverage__.push(globalThis.__coverage__);
          }
          // send end
          const end = this.buffer[this.buffer.current];
          this.buffer.done = this.buffer.current;
          this.log();
          // buffer cleanup
          this.buffer.cleanup();
          // cache cleanup
          const cleanupOptions = Config.cleanupOptions;
          await Dispatcher.cleanupBrowsingData(cleanupOptions.RemovalOptions, cleanupOptions.dataToRemove.end, cleanupOptions.timeout);
          await Dispatcher.clearNavigationUrl('*', 1000);
          // deferred sending
          this.send(end);
        }
        else {
          throw new Error(`${this.constructor.name}.onTotalSuites: buffer.current (${this.buffer.current}) != buffer.done (${this.buffer.done})`);
        }
      }
      else if (totalSuites == 0) {
        await this.collectCoverage();
        this.buffer[this.buffer.current].arg.__coverage__ = this.buffer[this.buffer.current].arg.__coverage__ || [];
        if (Array.isArray(this.suites.__coverage__) && this.suites.__coverage__.length > 0) {
          this.buffer[this.buffer.current].arg.__coverage__.splice(0, 0, ...this.suites.__coverage__);
        }
        if (Array.isArray(this.buffer[this.buffer.current].arg.__coverage__) && globalThis.__coverage__) {
          this.buffer[this.buffer.current].arg.__coverage__.push(globalThis.__coverage__);
        }
        // send end
        const end = this.buffer[this.buffer.current];
        this.buffer.done = this.buffer.current;
        this.log();
        // buffer cleanup
        this.buffer.cleanup();
        // cache cleanup
        const cleanupOptions = Config.cleanupOptions;
        await Dispatcher.cleanupBrowsingData(cleanupOptions.RemovalOptions, cleanupOptions.dataToRemove.end, cleanupOptions.timeout);
        await Dispatcher.clearNavigationUrl('*', 1000);
        // deferred sending
        this.send(end);
      }
      else {
        throw new Error(`${this.constructor.name}.onTotalSuites: buffer.current (${this.buffer.current}) + 2 != buffer.top (${this.buffer.top})`);
      }
    }
    onSuite(mEvent) {
      if (mEvent.arg.root) {
        // root suite
        // just under start
        if (this.buffer.isEmpty()) {
          // must not be empty on root suite
          throw new Error(`${this.constructor.name}.onSuite: buffer is unexpectedly empty`);
        }
        else {
          if (this.buffer.current === 0) {
            if (this.buffer[this.buffer.current].type === EVENT_RUN_BEGIN) {
              if (this.buffer.current === this.buffer.top) {
                // push
                this.buffer.push(mEvent);
                this.buffer.current = this.buffer.top;
                // send
                this.send(mEvent);
                this.buffer.done = this.buffer.current;
              }
              else {
                if (this.buffer[this.buffer.current + 1].type === EVENT_SUITE_BEGIN) {
                  if (this.buffer[this.buffer.current + 1].arg.root) {
                    // step
                    this.buffer.current++;
                    // skip
                    this.alias[mEvent.arg.__mocha_id__] = this.buffer[this.buffer.current].arg.__mocha_id__;
                  }
                  else {
                    // not skipping on root suite
                    throw new Error(`${this.constructor.name}.onSuite: current (${this.buffer[this.buffer.current + 1].type} is not root suite`);
                  }
                }
                else {
                  // not just under start
                  throw new Error(`${this.constructor.name}.onSuite: current (${this.buffer[this.buffer.current + 1].type} is not root suite`);
                }
              }
            }
            else {
              // current.type is not start
              throw new Error(`${this.constructor.name}.onSuite: buffer[current].type (${this.buffer[this.buffer.current].type}) is not ${EVENT_RUN_BEGIN}`);
            }
          }
          else {
            // current is not 0
            throw new Error(`${this.constructor.name}.onSuite: buffer.current is not 0`);
          }
        }
      }
      else {
        // non-root suite
        if (this.isParent(this.buffer[this.buffer.current], mEvent)) {
          if (this.buffer.current === this.buffer.top) {
            // push
            this.buffer.push(mEvent);
            this.buffer.current = this.buffer.top;
            // send
            this.send(mEvent);
            this.buffer.done = this.buffer.current;
          }
          else {
            // step
            this.buffer.current++;
            if (this.buffer[this.buffer.current].type === EVENT_SUITE_BEGIN) {
              if (this.isSameSuite(this.buffer[this.buffer.current], mEvent)) {
                // skip
                this.alias[mEvent.arg.__mocha_id__] = this.buffer[this.buffer.current].arg.__mocha_id__;
              }
              else {
                // sibling suite has not been cleaned up
                throw new Error(`${this.constructor.name}.onSuite: sibling suite has not been cleaned up`);
              }
            }
            else if (this.buffer[this.buffer.current].type === EVENT_SUITE_END) {
              if (this.buffer.current === this.buffer.done + 1) {
                // insert
                this.buffer.insert(mEvent);
                // send
                this.send(mEvent);
                this.buffer.done = this.buffer.current; // done++      
              }
              else {
                // done + 1 is not current
                throw new Error(`${this.constructor.name}.onSuite: done (${this.buffer.done}) + 1 is not current (${this.buffer.current})`);
              }
            }
          }
        }
        else {
          // current is not parent
          if (this.buffer[this.buffer.current].type === EVENT_SUITE_END) {
            this.onNotLastInSession(); // flush and clean up
            // retry after cleanup
            this.onSuite(mEvent); // recursive but never comes here again
          }
          else {
            throw new Error(`${this.constructor.name}.onSuite: buffer[current] is not the parent of suite`);
          }
        }
      }
    }
    onSuiteEnd(mEvent) {
      if (mEvent.arg.root) {
        // root suite end
        if (this.buffer.size >= 2) {
          if (this.buffer.current === this.buffer.top) {
            // push at top
            this.buffer.push(mEvent);
            this.buffer.current = this.buffer.top;
            // skip root suite end
          }
          else {
            if (this.buffer[this.buffer.current + 1].type === EVENT_SUITE_END) {
              // step
              this.buffer.current++;
              // skip on root suite end
            }
            else {
              // current.type is not suite end
              throw new Error(`${this.constructor.name}.onSuiteEnd: [current].type (${this.buffer[this.buffer.current + 1].type}) is not ${EVENT_SUITE_END}`);
            }
          }
        }
        else {
          // buffer is too short
          throw new Error(`${this.constructor.name}.onSuiteEnd: buffer.size (${this.buffer.size}) must be >= 2`);
        }
      }
      else {
        // non-root suite end
        if (this.buffer.current === this.buffer.top) {
          if (this.isParent(mEvent, this.buffer[this.buffer.current])) {
            // push at top
            this.buffer.push(mEvent);
            this.buffer.current = this.buffer.top;
            // skip suite end
          }
          /*
          else if (this.isSameSuite(mEvent, this.buffer[this.buffer.current])) {
            // ending empty suite
            console.warn(`${this.constructor.name}.onSuiteEnd: ending empty suite`, mEvent);
            // push at top
            this.buffer.push(mEvent);
            this.buffer.current = this.buffer.top;
            // skip suite end
          }
          */
          else {
            // out of the parent context
            throw new Error(`${this.constructor.name}.onSuiteEnd: suite end is out of the parent context`);
          }
        }
        else {
          // step
          this.buffer.current++;
          if (this.isSameSuite(this.buffer[this.buffer.current], mEvent)) {
            // skip suite end
          }
          else {
            // insert suite end
            this.buffer.insert(mEvent);
          }
        }
      }
    }
    onTest(mEvent) { // common checks for pass, fail, or pending
      if (this.buffer.current >= 0) {
        if (this.buffer.current <= this.buffer.top) {
          // current is parent suite or sibling test
          switch (this.buffer[this.buffer.current].type) {
          case EVENT_SUITE_BEGIN:
            if (!this.isParent(this.buffer[this.buffer.current], mEvent)) {
              throw new Error(`${this.constructor.name}.onTest: invalid parent`);
            }
            break;
          case EVENT_TEST_PASS:
          case EVENT_TEST_FAIL:
          case EVENT_TEST_PENDING:
            if (!this.isSibling(this.buffer[this.buffer.current], mEvent)) {
              throw new Error(`${this.constructor.name}.onTest: invalid sibling`);    
            }
            break;
          }
          if (this.buffer.current == this.buffer.top) {
            // push
            this.buffer.push(mEvent);
            this.buffer.current = this.buffer.top;
            switch (mEvent.type) {
            case EVENT_TEST_PASS:
            case EVENT_TEST_FAIL:
              // flush
              this.flush();
              break;
            case EVENT_TEST_PENDING:
              // skip
              break;
            }
          }
          else {
            // current < top
            // step
            this.buffer.current++;
            switch (this.buffer[this.buffer.current].type) {
            case EVENT_SUITE_END:
              if (this.buffer.current > this.buffer.done) {
                // insert
                this.buffer.insert(mEvent);
                switch (mEvent.type) {
                case EVENT_TEST_PASS:
                case EVENT_TEST_FAIL:
                  // flush
                  this.flush();
                  break;
                case EVENT_TEST_PENDING:
                  // skip
                  break;
                }
              }
              else {
                // current <= done
                throw new Error(`${this.constructor.name}.onTest: current ${this.buffer.current} must be greater than done ${this.buffer.done}`);
              }
              break;
            case EVENT_TEST_PASS:
            case EVENT_TEST_FAIL:
            case EVENT_TEST_PENDING:
              if (this.isSameTest(this.buffer[this.buffer.current], mEvent)) {
                if (this.buffer.current > this.buffer.done) {
                  this.overwrite(mEvent);
                  switch (mEvent.type) {
                  case EVENT_TEST_PASS:
                  case EVENT_TEST_FAIL:
                    // flush
                    this.flush();
                    break;
                  case EVENT_TEST_PENDING:
                    // skip
                    break;
                  }      
                }
                else {
                  // current <= done
                  switch (mEvent.type) {
                  case EVENT_TEST_PASS:
                  case EVENT_TEST_FAIL:
                    // TODO: how to handle errors
                    if (mEvent.arg.type !== EVENT_HOOK_BEGIN) {
                      // error
                      //throw new Error(`${this.constructor.name}.onTest: pending test is expected but ${mEvent.type} is received`);
                    }
                    break;
                  case EVENT_TEST_PENDING:
                    // skip
                    break;
                  }
                }
              }
              else {
                throw new Error(`${this.constructor.name}.onTest: current is not the same test`);
              }
            }
          }
        }
        else {
          throw new Error(`${this.constructor.name}.onTest: current ${this.buffer.current} must be less than or equal to top ${this.buffer.top}`);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.onTest: current ${this.buffer.current} must not be negative`);
      }
    }
    onPass(mEvent) {
      this.onTest(mEvent);
    }
    onFail(mEvent) {
      this.onTest(mEvent);
    }
    onPending(mEvent) {
      this.onTest(mEvent);
    }
    isParent(parent, child) {
      if (typeof child.arg.__mocha_id__ === 'string' &&
          typeof parent.arg.__mocha_id__ === 'string') {
        if (child.arg.parent && child.arg.parent.__mocha_id__) {
          if (parent.arg.__mocha_id__ === child.arg.parent.__mocha_id__) {
            return true;
          }
          else {
            if (this.alias[child.arg.parent.__mocha_id__] === parent.arg.__mocha_id__) {
              child.arg.parent.__mocha_id__ = parent.arg.__mocha_id__;
              return true;
            }
            else {
              return false;
            }
          }
        }
        else {
          return (parent === null && child.arg.root);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.isParent: __mocha_id__ is missing parent: ${JSON.stringify(parent, null, 0)}, child: ${JSON.stringify(child, null, 0)}`);
      }
    }
    isSameSuite(suiteA, suiteB) {
      if (suiteA && suiteB) {
        if (suiteA.arg.root && suiteB.arg.root) {
          // both are root suites
          return true;
        }
        else if (suiteA.arg.$$title === suiteB.arg.$$title &&
                 suiteA.arg.$$fullTitle === suiteB.arg.$$fullTitle) {
          // both of title and full title match
          let parentA = suiteA.arg.parent.__mocha_id__;
          let parentB = suiteB.arg.parent.__mocha_id__;
          if (this.alias[parentA]) {
            parentA = this.alias[parentA];
          }
          if (this.alias[parentB]) {
            parentB = this.alias[parentB];
          }
          // same parent
          return (parentA === parentB);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.isSameSuite: comparing null suites suiteA:${suiteA}, suiteB:${suiteB}`);
      }
    }
    isSibling(testA, testB) {
      if (testA && testB) {
        if (testA.arg.parent.$$fullTitle === testB.arg.parent.$$fullTitle) {
          // parents' fullTitles match
          let parentA = testA.arg.parent.__mocha_id__;
          let parentB = testB.arg.parent.__mocha_id__;
          if (this.alias[parentA]) {
            parentA = this.alias[parentA];
          }
          if (this.alias[parentB]) {
            parentB = this.alias[parentB];
          }
          // same parent
          return parentA === parentB;
        }
        else {
          return false; // parents' fullTitles are different
        }
      }
      else {
        throw new Error(`${this.constructor.name}.isSibling: comparing null tests`);
      }
    }
    isSameTest(testA, testB) {
      if (testA && testB) {
        if (testA.arg.$$title === testB.arg.$$title &&
            testA.arg.$$fullTitle === testB.arg.$$fullTitle) {
          // both of title and full title match
          let parentA = testA.arg.parent.__mocha_id__;
          let parentB = testB.arg.parent.__mocha_id__;
          if (this.alias[parentA]) {
            parentA = this.alias[parentA];
          }
          if (this.alias[parentB]) {
            parentB = this.alias[parentB];
          }
          // same parent
          return (parentA === parentB);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.isSameTest: comparing null tests`);
      }
    }
    updateStats(mEvent) {
      switch (mEvent.type) {
      case EVENT_TEST_PASS:
        this.stats.passes++;
        this.stats.tests++;
        break;
      case EVENT_TEST_FAIL:
        this.stats.failures++;
        this.stats.tests++;
        break;
      case EVENT_TEST_PENDING:
        this.stats.pending++;
        this.stats.tests++;
        break;
      case EVENT_RUN_END:
        if (this.stats.start instanceof Date && mEvent.stats.end instanceof Date) {
          mEvent.stats.end = new Date();
          this.stats.duration = mEvent.stats.end - this.stats.start;
        }
        break;
      default:
        break;
      }
      Object.assign(mEvent.stats, this.stats);
    }
    send(mEvent) {
      this.updateStats(mEvent);
      console.log(`${this.constructor.name}.send: Send ${mEvent.type}:`, mEvent);
      if (this.receiverRunner) {
        this.receiverRunner.onMochaEvent(mEvent);
        document.dispatchEvent(new CustomEvent('mocha-event', { detail: mEvent }));
      }
      else {
        throw new Error(`${this.constructor.name}.send: receiverRunner is missing`);
      }
    }
    flush() {
      if (this.buffer.done < this.buffer.current) {
        // send done + 1...current
        this.buffer.done++;
        for (; this.buffer.done <= this.buffer.current; this.buffer.done++) {
          this.send(this.buffer[this.buffer.done]);
          if (this.buffer.done == this.buffer.current) {
            break;
          }
        }
      }
    }
    overwrite(mEvent) {
      if (this.buffer.current >= 0 && this.buffer.current <= this.buffer.top) {
        switch (mEvent.type) {
        case EVENT_TEST_PASS:
        case EVENT_TEST_FAIL:
        case EVENT_TEST_PENDING:
          break;
        default:
          throw new Error(`${this.constructor.name}.overwrite: test is expected but ${mEvent.type} is received`);
          break;
        }
        switch (this.buffer[this.buffer.current].type) {
        case EVENT_TEST_PASS:
        case EVENT_TEST_FAIL:
        case EVENT_TEST_PENDING:
          break;
        default:
          throw new Error(`${this.constructor.name}.overwrite: current ${this.buffer.current} must be a test but the type is ${mEvent.type}`);
          break;
        }
        if (this.isSameTest(this.buffer[this.buffer.current], mEvent)) {
          // transplant the parent id
          mEvent.arg.parent.__mocha_id__ = this.buffer[this.buffer.current].arg.parent.__mocha_id__;
          // overwrite
          this.buffer[this.buffer.current] = mEvent;
        }
        else {
          throw new Error(`${this.constructor.name}.overwrite: overwriting a different test`);
        }
      }
      else {
        throw new Error(`${this.constructor.name}.overwrite: current ${this.buffer.current} is invalid`);
      }
    }
    onFinish() {
      Dispatcher.setupInjection(true).catch(reason => {});
    }
    onMochaEvent(mEvent) {
      const { type } = mEvent;
      switch (type) {
      case EVENT_RUN_BEGIN:
        this.onStart(mEvent);
        break;
      case EVENT_RUN_END:
        this.onEnd(mEvent);
        break;
      case EVENT_SUITE_BEGIN:
        this.onSuite(mEvent);
        break;
      case EVENT_SUITE_END:
        this.onSuiteEnd(mEvent);
        break;
      case EVENT_TEST_PASS:
        this.onPass(mEvent);
        break;
      case EVENT_TEST_FAIL:
        this.onFail(mEvent);
        break;
      case EVENT_TEST_PENDING:
        this.onPending(mEvent);
        break;
      case AGGREGATION_EVENT_PHASE_CONTINUING:
        this.onContinuingPhase();
        break;
      case AGGREGATION_EVENT_PHASE_FINAL:
        this.onFinalPhase();
        break;
      case AGGREGATION_EVENT_SCOPE_CONTINUING:
        this.onNotLastInScope();
        break;
      case AGGREGATION_EVENT_SCOPE_FINAL:
        this.onLastInScope();
        break;
      case AGGREGATION_EVENT_RUN_CONTINUING:
        this.onNoTotalSuites();
        break;
      case AGGREGATION_EVENT_RUN_FINAL:
        this.onTotalSuites(mEvent.totalSuites);
        break;
      default:
        console.error(`${this.constructor.name}.onMochaEvent: unhandled event ${type}`);
        break;          
      }
    }
  }

  class Dispatcher extends EventTarget {
    static async populate(suiteGenerator, ...parameters) {
      this.suiteIterator = suiteGenerator(...parameters);
      this.originIterator = Config.originGenerator();
      await this.setupInjection();
      for (let origin of this.originIterator) {
        new Dispatcher(origin);
      }
    }
    static async setupInjection(teardown = false) {
      if (Config.driverInjectionMethod === 'Extension') {
        let origins = {};
        for (let origin of Config.originGenerator()) {
          origins[origin] = true;
        }
        let driverURL = new URL('driver.js', new URL(Config.reportagePackagePathOnReporter, Config.reporterOrigin).href) + '#' + Config.testConfigPathOnReporter;
        let detail = teardown ? null : {
          origins: origins,
          driverURL: driverURL,
          targetPathPattern: '^\/.*',
        };
    
        await new Promise((resolve, reject) => {
          let resolved = false;
          let timeoutId;
          let _setupInjectionFinished;
          window.addEventListener('setup-injection-finished', _setupInjectionFinished = (event) => {
            window.removeEventListener('setup-injection-finished', _setupInjectionFinished);
            console.log(`setup injection finished`, event.detail);
            resolved = true;
            clearTimeout(timeoutId);
            resolve(event.detail);
          });
          window.dispatchEvent(new CustomEvent('setup-injection', { detail: detail }));
          timeoutId = setTimeout(() => {
            if (!resolved) {
              reject('setup-injection timed out');
            }
          }, Config.setupInjectionTimeout);
        });
      }
      else {
        window.dispatchEvent(new CustomEvent('setup-injection', { detail: {} })); // set empty but non-null parameter object
      }
    }
    static async ready() {
      this.isReady = true;
      window.dispatchEvent(new CustomEvent('dispatcher-ready', { detail: null }));
    }
    static onMessage(event) {
      console.log(`Dispatcher: message event`, event.data);
      if (event.data.type === TYPE_COVERAGE) {
        this.onCoverage(event);
        return;
      }
      else if (event.data.type === TYPE_READY && Array.isArray(event.data.__coverage__)) {
        this.onCoverage(event);
        delete (event.data).__coverage__;
      }
      const targetInstance = Dispatcher.findTargetInstance(event);
      if (targetInstance) {
        try {
          targetInstance.onMessage(event);
        }
        catch (e) {
          console.error(`${this.name}.onMessage: caught an exception`, e);
        }
      }
      else {
        console.error(`Dispatcher.start: no target dispatcher instance found for event `, event);
      }
    }
    static onCoverage(event) {
      console.log(`Dispatcher.onCoverage:`);
      this.suites.__coverage__ = this.suites.__coverage__ || [];
      this.suites.__coverage__.splice(this.suites.__coverage__.length - 1, 0, ...event.data.__coverage__);
      if (typeof this.suites.coverageResolve === 'function' &&
          event.data.source === this.suites.coverageResolveSource) {
        const resolve = this.suites.coverageResolve;
        this.suites.coverageResolve = null;
        this.suites.coverageResolveSource = '';
        resolve();
      }
    }
    static start(port) {
      if (this._onMessage && this.port) {
        this.port.removeEventListener('message', this._onMessage);
      }
      this.suites = [];
      this.prefetchedSuite = null;
      this.aggregator = new Aggregator(this.suites, Suite, {});
      this.port = port;
      this._onMessage = (event) => {
        return this.onMessage(event);
      };
      this.port.addEventListener('message', this._onMessage);
      (async () => {
        const cleanupOptions = Config.cleanupOptions;
        await this.cleanupBrowsingData(cleanupOptions.RemovalOptions, cleanupOptions.dataToRemove.start, cleanupOptions.timeout);
        await this.clearNavigationUrl('*', 1000);
        for (const instance of this.list) {
          const event = new CustomEvent('start', { detail: {} });
          instance.dispatchEvent(event);
          await new Promise(resolve => setTimeout(resolve, Config.dispatcherStartInterval));
        }
      })();
    }
    static async rewind(suiteGenerator, ...parameters) {
      let nonClosed;
      do {
        nonClosed = 0;
        for (let instance of this.list) {
          if (instance.state !== DISPATCHER_STATE_CLOSED) {
            nonClosed++;
          }
        }
        console.log('Dispatcher.rewind: nonClosed = ', nonClosed);
        if (nonClosed !== 0) {
          this.prefetchedSuite = 'done'; // stop iterating suites
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      while (nonClosed !== 0)
      if (this.port && this._onMessage) {
        this.port.removeEventListener('message', this._onMessage);
      }
      this.list = [];
      this.suites = [];
      this.prefetchedSuite = null;
      delete this.nonClosed;
      document.getElementById('mocha').innerHTML = '';
      await this.populate(suiteGenerator, ...parameters);
    }
    static async cleanupBrowsingData(removalOptions, dataToRemove, removalTimeout) {
      try {
        const cleanupStart = Date.now();
        let cleanupFinishedCallback;
        const result = await new Promise((resolve, reject) => {
          window.addEventListener('cleanup-finished', cleanupFinishedCallback = (event) => {
            let cleanupFinished = Date.now();
            window.removeEventListener('cleanup-finished', cleanupFinishedCallback);
            console.log(`cleanup finished in ${cleanupFinished - cleanupStart}ms removalOptions: ${JSON.stringify(removalOptions)}, dataToRemove: ${JSON.stringify(dataToRemove)}`);
            resolve(event.detail);
          });
          window.dispatchEvent(new CustomEvent('cleanup', { detail: {
            removalOptions: removalOptions,
            dataToRemove: dataToRemove,
          }}));
          setTimeout(() => { reject('timed out') }, removalTimeout);
        });
      }
      catch (e) {
        console.error(`cleanup timeout`, e);
        throw e;
      }
    }
    static async clearNavigationUrl(origin, clearTimeout) {
      try {
        const clearStart = Date.now();
        let clearFinishedCallback;
        const result = await new Promise((resolve, reject) => {
          window.addEventListener('clear-navigation-finished', clearFinishedCallback = (event) => {
            let clearFinished = Date.now();
            window.removeEventListener('clear-navigation-finished', clearFinishedCallback);
            console.log(`clear navigation finished in ${clearFinished - clearStart}ms values: ${JSON.stringify(event.detail, null, 2)}`);
            resolve(event.detail);
          });
          window.dispatchEvent(new CustomEvent('clear-navigation', { detail: { origin: origin, } } ));
          setTimeout(() => { reject('timed out') }, clearTimeout);
        });
        return result;
      }
      catch (e) {
        console.error(`clear-navigation timeout`, e);
        throw e;
      }
    }
    static async getNavigationUrl(origin, getTimeout) {
      try {
        const getStart = Date.now();
        let getFinishedCallback;
        const result = await new Promise((resolve, reject) => {
          window.addEventListener('get-navigation-finished', getFinishedCallback = (event) => {
            let getFinished = Date.now();
            window.removeEventListener('get-navigation-finished', getFinishedCallback);
            console.log(`get navigation finished in ${getFinished - getStart}ms values: ${JSON.stringify(event.detail, null, 2)}`);
            resolve(event.detail);
          });
          window.dispatchEvent(new CustomEvent('get-navigation', { detail: { origin: origin, } } ));
          setTimeout(() => { reject('timed out') }, getTimeout);
        });
        return result;
      }
      catch (e) {
        console.error(`clear-navigation timeout`, e);
        throw e;
      }      
    }
    static logSuite(suite) {
      if (suite && typeof suite === 'object' &&
          typeof suite.suiteIndex === 'number') {
        if (this.suites[suite.suiteIndex]) {
          console.error(`Dispatcher.logSuite: duplicate suiteIndex ${suite.suiteIndex}`);
        }
        else {
          this.suites[suite.suiteIndex] = Object.assign({}, suite);
          this.aggregator.onLogSuite(this.suites[suite.suiteIndex]);
        }
      }
      else {
        console.error(`Dispatcher.logSuite: invalid suite`, suite);
      }
    }
    static logSession(session, suiteIndex, phase) {
      if (session && typeof session === 'object' &&
          typeof session.sessionId === 'string' &&
          typeof suiteIndex === 'number' &&
          typeof phase === 'number') {
        if (this.suites[suiteIndex]) {
          const suite = this.suites[suiteIndex];
          if (!Array.isArray(suite.sessions)) {
            suite.sessions = [];
          }
          suite.sessions[phase] = session;
          this.aggregator.onLogSession(session, suiteIndex, phase);
        }
        else {
          console.error(`Dispatcher.logSession: invalid suiteIndex ${suiteIndex}`);
        }
      }
      else {
        console.error(`Dispatcher.logSession: invalid session `, session, suiteIndex, phase);
      }
    }
    static logTotalSuites() {
      if (this.suites) {
        this.suites.totalSuites = this.suites.length;
        this.aggregator.onLogTotalSuites(this.suites);
      }
    }
    static findTargetInstance(event) {
      let warning = null;
      if (event.data.target === NAME_REPORTER) {
        for (const dispatcher of this.list) {
          if (dispatcher.pageId) { // pageId available
            if (dispatcher.pageId === event.data.source) {
              warning = [];
              return dispatcher; // pageId matched
            }
          }
          else { // pageId is not available (before receiving ready)
            if (event.data.type === TYPE_ERROR) {
              if (event.data.orgType === TYPE_DETACH &&
                  event.data.orgTarget && event.data.orgTarget.startsWith(`${NAME_MEDIATOR_BRIDGE}:`)) {
                const origin = event.data.orgTarget.substring(`${NAME_MEDIATOR_BRIDGE}:`.length);
                if (dispatcher.origin === origin) {
                  return dispatcher; // orgTarget matched
                }
              }
              else {
                if (!warning) {
                  warning = [ `Dispatcher.findTargetInstance: unhandled ${TYPE_ERROR} event`, event ];
                }  
              }
            }
            if (dispatcher.url) { // URL matching
              if (event.data.url) {
                if (event.data.url === '*') {
                  warning = [`event.data.url === '*':`];
                }
                else {
                  if (event.data.url === dispatcher.url) {
                    return dispatcher; // full URL matched
                  }
                  else if (new URL(event.data.url).origin === dispatcher.origin) {
                    return dispatcher; // origin matched
                  }
                }
              }
              else {
                if (!warning) {
                  warning = [ `Dispatcher.findTargetInstance: no event.data.url set for event`, event ];
                }
              }
            }
            else {
              if (!warning) {
                warning = [ `Dispatcher.findTargetInstance: no url set for dispatcher`, dispatcher ];
              }
            }
          }
          let origin = event.data.origin;
          if (!origin) {
            if (event.data.url && event.data.url !== '*') {
              origin = new URL(event.data.url).origin;
            }
          }
          if (dispatcher.origin === origin) { // TODO: event.data.origin set?
            return dispatcher;
          }
        }
      }
      else {
        warning = [ `Dispatcher.findTargetInstance: target ${event.data.target} is not ${NAME_REPORTER}` ];
      }
      if (warning) {
        console.warn(...warning);
      }
      return null;
    }
    registerInstance() {
      if (!Array.isArray(this.constructor.list)) {
        this.constructor.list = [];
      }
      this.constructor.list.push(this);
    }
    constructor(origin) {
      super();
      this.origin = origin;
      this.reset(DISPATCHER_STATE_CLOSED);
      this.setUpListeners();
      this.registerInstance();
    }
    reset(state = DISPATCHER_STATE_CLOSED) {
      this.state = state;
      this.pageId = '';
      this.session = null;
      this.url = '';
      this.navigationType = null;
      this.suite = null;
      this.suiteParameters = null;
      this.timeoutId = 0;
      this.reason = null;
    }
    setUpListeners() {
      this.addEventListener('start', (event) => { this.next(); });
    }
    nextSuite() {
      // prefetch one suite to detect the last suite earlier
      let prefetchedSuite = this.constructor.prefetchedSuite;
      if (!prefetchedSuite) {
        // the first call
        const { value, done } = this.constructor.suiteIterator.next();
        prefetchedSuite = this.constructor.prefetchedSuite = done ? 'done' : value;
      }
      if (prefetchedSuite === 'done') {
        this.constructor.logTotalSuites();
        return null;
      }
      const { value, done } = this.constructor.suiteIterator.next();
      if (done) {
        // suite - undefined
        // prefetchedSuite - last
        prefetchedSuite.lastInRun = true;
        // update prefetchedSuite
        this.constructor.prefetchedSuite = 'done';
      }
      else {
        // suite - may be last or not
        // prefetchedSuite - not last
        prefetchedSuite.lastInRun = false;
        // update prefetchedSuite
        this.constructor.prefetchedSuite = value;
      }
      this.constructor.logSuite(prefetchedSuite);
      return prefetchedSuite;
    }
    next() {
      switch (this.state) {
      case DISPATCHER_STATE_CLOSED:
        {
          const suite = this.nextSuite();
          if (suite) {
            this.open(suite);
          }
          else {
            console.log(`Dispatcher.next:${this.state}: ${this.origin} no more suites`);
            this.reset();
          }
        }
        break;
      case DISPATCHER_STATE_READY0:
        {
          if (this.suite) {
            this.request();
          }
          else {
            console.log(`Dispatcher.next:${this.state}: ${this.origin} no suite`);
            this.close();
          }
        }
        break;
      case DISPATCHER_STATE_READY1:
        {
          const suite = this.nextSuite();
          if (suite) {
            this.navigate(suite);
          }
          else {
            console.log(`Dispatcher.next:${this.state}: ${this.origin} no more suites`);
            this.close();
          }
        }
        break;
      default:
        // TODO: error handling
        break;
      }
    }
    createInitialSuiteParameters() {
      return {
        suite: { ...this.suite },
        phase: 0,
      };
    }
    async open(suite) { // open a new window
      if (!suite) {
        return;
      }
      if (this.timeoutId === 0) {
        this.suite = suite;
        const cleanupOptions = Config.cleanupOptions;
        await this.constructor.cleanupBrowsingData(cleanupOptions.RemovalOptions, cleanupOptions.dataToRemove.window, cleanupOptions.timeout)
        this.url = Config.targetApp(this.origin, suite[SUITE_HTML]);
        this.url0 = this.url;
        this.navigationType = NAVI_WINDOW_OPEN;
        this.suiteParameters = this.createInitialSuiteParameters();
        window.open(this.url, Config.windowTarget, Config.windowFeatures);
        this.state = DISPATCHER_STATE_NAVIGATING1;
        const timeoutId = this.timeoutId = setTimeout(() => {
          this.timeout(timeoutId);
        }, Config.readyTimeout);
      }
      else {
        // another timer is running
        this.clearTimeout();
        this.reset(this.state);
        this.error(`${this.state}.open: another timer is running`);
      }
    }
    async reopen() {
      if (this.timeoutId === 0) {
        const cleanupOptions = Config.cleanupOptions;
        await this.constructor.cleanupBrowsingData(cleanupOptions.RemovalOptions, cleanupOptions.dataToRemove.window, cleanupOptions.timeout)
        this.url = this.url0;
        this.navigationType = NAVI_WINDOW_OPEN;
        this.suiteParameters = this.createInitialSuiteParameters();
        window.open(this.url, Config.windowTarget, Config.windowFeatures);
        this.state = DISPATCHER_STATE_NAVIGATING1;
        const timeoutId = this.timeoutId = setTimeout(() => {
          this.timeout(timeoutId);
        }, Config.readyTimeout);
      }
      else {
        // another timer is running
        this.clearTimeout();
        this.reset(this.state);
        this.error(`${this.state}.reopen: another timer is running`);
      }
    }
    navigate(suite) {
      if (this.timeoutId === 0) {
        this.suite = suite;
        this.url = Config.targetApp(this.origin, suite[SUITE_HTML]);// + `?suiteIndex=${this.suite.suiteIndex}`;
        this.url0 = this.url;
        this.navigationType = NAVI_HISTORY_GO;
        this.suiteParameters = this.createInitialSuiteParameters(); // reset suiteParameters on a new suite
        const message = {
          type: TYPE_NAVIGATE,
          source: NAME_REPORTER,
          target: this.pageId,
          suite: this.suite,
          url: this.url,
          navigationType: this.navigationType,
        };
        console.log(`Dispatcher: sending message`, message);
        this.constructor.port.postMessage(message);
        this.state = DISPATCHER_STATE_NAVIGATING0;
        const timeoutId = this.timeoutId = setTimeout(() => {
          this.timeout(timeoutId);
        }, Config.timeout);
      }
      else {
        // another timer is running
        this.clearTimeout();
        this.reset(this.state);
        this.error(`${this.state}.navigate: another timer is running`);
      }
    }
    request() { // request a new session
      if (this.timeoutId === 0) {
        this.session = new Session(this);
        const transfer = [ this.session.createChannel() ];
        const message = {
          type: TYPE_REQUEST_SESSION,
          source: NAME_REPORTER,
          target: this.pageId,
          /* clonable object
          this.suite = {
            suiteIndex: suiteIndex,
            ui: TEST_UI_SCENARIST,
            scope: scope,
            testIndex: index,
            lastInScope: true || false,
            tests: tests,
            [SUITE_HTML]: Suite.scopes[scope][SUITE_HTML],
          }
          */
          suite: this.suite,
          /* clonable object
          this.suiteParameters = { // defined by Suite.scopes[scope]
            suite: suite,
            phase: phase,
            ...
          } || null // default null
          */
          suiteParameters: this.suiteParameters || null,
          sessionId: this.session.sessionId,
          transfer: transfer,
        };
        let phase = 0;
        if (this.suiteParameters && typeof this.suiteParameters.phase === 'number') {
          phase = this.suiteParameters.phase;
        }
        this.constructor.logSession(this.session, this.suite.suiteIndex, phase);
        console.log(`Dispatcher: sending message`, message);
        this.constructor.port.postMessage(message, transfer);
        this.state = DISPATCHER_STATE_STARTING0;
        const timeoutId = this.timeoutId = setTimeout(() => {
          this.timeout(timeoutId);
        }, Config.timeout);
      }
      else {
        // another timer is running
        this.clearTimeout();
        this.reset(this.state);
        this.error(`${this.state}.open: another timer is running`);
      }
    }
    error(reason) {
      this.reason = reason || `${this.state}: Unknown Error`;
      this.state = DISPATCHER_STATE_ERROR;
      console.error(`Dispatcher.error: ${this.reason}`);
      this.close();
    }
    close() {
      if (this.pageId) {
        const message = {
          type: TYPE_CLOSE,
          source: NAME_REPORTER,
          target: this.pageId,
        };
        console.log(`Dispatcher: sending message`, message);
        this.constructor.port.postMessage(message);
        this.state = DISPATCHER_STATE_CLOSING;
        if (this.timeoutId === 0) {
          const timeoutId = this.timeoutId = setTimeout(() => {
            this.timeout(timeoutId);
          }, Config.timeout);
        }
        else {
          // another timer is running
          this.clearTimeout();
          this.error(`${this.state}.close: another timer is running`);
        }
      }
      else {
        // early error before opening a window and obtaining its page ID
        this.closed();
      }
    }
    closed() {
      this.reset(DISPATCHER_STATE_CLOSED);
      let nonClosed = 0;
      for (let instance of this.constructor.list) {
        if (instance.state !== DISPATCHER_STATE_CLOSED) {
          nonClosed++;
        }
      }
      console.log('nonClosed = ', nonClosed);
      this.constructor.nonClosed = nonClosed;
      if (nonClosed === 0) {
        this.constructor.aggregator.onFinish();
        console.timeEnd();
      }
    }
    clearTimeout() {
      if (this.timeoutId > 0) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = 0;
    }
    async timeout(timeoutId) {
      switch (this.state) {
      case DISPATCHER_STATE_NAVIGATING0:
        if (timeoutId === this.timeoutId) {
          this.timeoutId = 0; // properly handled timeout
          const reason = `${this.state}.timeout: timeout for receiving navigating`;
          this.reset(this.state);
          this.error(reason);
        }
        else {
          // another timer is running
          this.clearTimeout();
          const reason = `${this.state}.timeout: another timer is running`;
          this.reset(this.state);
          this.error(reason);
        }
        break;
      case DISPATCHER_STATE_NAVIGATING1:
        if (timeoutId === this.timeoutId) {
          this.timeoutId = 0; // properly handled timeout
          const reason = `${this.state}.timeout: timeout for receiving ready`;
          if (this.suiteParameters && this.suiteParameters.phase > 0) {
            console.error(reason);
            // Fix #3 CLOSED state must be transitioned synchronously; timestamp is unused as described in the following Note
            // let timestamp = this.navigatingTimestamp;
            try {
              /* Fix #3 CLOSED state must be transitioned synchronously; result is unused as described in the following Note
              let result = await this.constructor.getNavigationUrl(this.origin, 1000);
              if (timestamp <= result.values[this.origin].timestamp) {
                console.log(`${this.state}.timeout: navigation url found ${result.values[this.origin].url}`);
              }
              else {
                console.warn(`${this.state}.timeout: no navigation url available after timestamp for origin ${this.origin}`);
              }
              */
              // Note: Do NOT use the current url of the target window 
              //   since sessionStorage cannot be inherited to the reopened window
              //   Instead, the suite is reset to its phase 0 when a new window is opened for the origin
              this.detach();
              this.readyTimeoutRetryCount = this.readyTimeoutRetryCount || 0;
              if (this.readyTimeoutRetryCount < Config.readyTimeoutRetries) {
                this.readyTimeoutRetryCount++;
                this.state = DISPATCHER_STATE_CLOSED; // Fix #3 In CLOSED state, discard delayed READY after timeout
                setTimeout(() => {
                  this.reopen();
                }, 1000);
              }
              else {
                this.reset(this.state); // TODO: this handling of error unexpectedly hangs up the test run
                this.error(reason);  
              }                
            }
            catch (e) {
              this.reset(this.state); // TODO: this handling of error unexpectedly hangs up the test run
              this.error(reason);
            }
          }
          else {
            // phase 0 -> reopen
            console.error(reason);
            this.detach();
            this.readyTimeoutRetryCount = this.readyTimeoutRetryCount || 0;
            if (this.readyTimeoutRetryCount < Config.readyTimeoutRetries) {
              this.readyTimeoutRetryCount++;
              this.state = DISPATCHER_STATE_CLOSED; // Fix #3 In CLOSED state, discard delayed READY after timeout
              setTimeout(() => {
                this.open(this.suite);
              }, 1000);
            }
            else {
              this.reset(this.state); // TODO: this handling of error unexpectedly hangs up the test run
              this.error(reason);  
            }
          }
        }
        else {
          // another timer is running
          this.clearTimeout();
          const reason = `${this.state}.timeout: another timer is running`;
          this.reset(this.state);
          this.error(reason);
        }
        break;
      case DISPATCHER_STATE_STARTING0:
        if (timeoutId === this.timeoutId) {
          this.timeoutId = 0; // properly handled timeout
          const reason = `${this.state}.timeout: timeout for receiving startSession`;
          this.reset(this.state);
          this.error(reason);
        }
        else {
          // another timer is running
          this.clearTimeout();
          const reason = `${this.state}.timeout: another timer is running`;
          this.reset(this.state);
          this.error(reason);
        }
        break;
      case DISPATCHER_STATE_CLOSING:
        if (timeoutId === this.timeoutId) {
          this.timeoutId = 0;
          this.closed();
        }
        else {
          // another timer is running
          this.clearTimeout();
          const reason = `${this.state}.timeout: another timer is running`;
          this.reset(this.state);
          this.error(reason);
        }
        break;
      default:
        // TODO: error handling
        break;
      }
    }
    onMessage(event) {
      const { type } = event.data;
      switch (this.state) {
      case DISPATCHER_STATE_NAVIGATING0:
        switch (type) {
        case TYPE_NAVIGATING:
          this.onNavigating(event);
          break;
        default:
          break; // TODO: error handling
        }
        break;
      case DISPATCHER_STATE_NAVIGATING1:
        switch (type) {
        case TYPE_READY:
          this.ready0(event);
          break;
        default: // TODO: error handling
          break;
        }
        break;
      case DISPATCHER_STATE_STARTING0:
        switch (type) {
        case TYPE_START_SESSION:
          this.starting1(event);
          break;
        default: // TODO: error handling
          break;
        }  
        break;
      case DISPATCHER_STATE_STOPPED:
        switch (type) {
        case TYPE_READY:
          this.session.onReady();
          this.ready1(event);
          break;
        case TYPE_NAVIGATING:
          this.session.onNavigating();
          this.onNavigating(event);
          break;
        default: // TODO: error handling
          break;
        }
        break;
      case DISPATCHER_STATE_RUNNING:
        switch (type) {
        case TYPE_END_SESSION:
          this.stopped(event);
          break;
        default: // TODO: error handling
          break;
        }  
        break;
      case DISPATCHER_STATE_CLOSING:
        switch (type) {
        case TYPE_CLOSING:
          this.closed();
          break;
        case TYPE_ERROR:
          this.closed();
          break;
        default:
          this.closed();
          break;
        }        
        break;
      case DISPATCHER_STATE_CLOSED:
        switch (type) {
        case TYPE_READY:
          // Fix #3 In CLOSED state, discard delayed READY after timeout
          console.warn(`${this.state}.onMessage: discarding delayed ${type}`);
          break;
        default:
          break;
        }
        break;
      default:
        break;
      }
    }
    /*
    focusReporter() {
      if (this.constructor._focused) {
        return;
      }
      let nonClosed = 0;
      for (let instance of this.constructor.list) {
        if (instance.state !== DISPATCHER_STATE_CLOSED) {
          nonClosed++;
        }
      }
      if (nonClosed == this.constructor.list.length) {
        setTimeout(() => window.focus(), 1000);
        this.constructor._focused = true;
      }
    }
    */
    ready0(event) {
      this.clearTimeout();
      const { source, url } = event.data;
      this.pageId = source;
      if (this.url !== '*' && this.url !== url) {
        console.error(`ready0: this.url !== url: ${this.url} !== ${url}`);
        // TODO: handle expected URL and reported URL from ready
      }
      //this.focusReporter(); // TODO: not working?
      this.url = url;
      this.state = DISPATCHER_STATE_READY0;
      this.next();
    }
    ready1(event) {
      // TODO: mark this.session finished as the last one in the current suite
      this.clearTimeout();
      const { source, url } = event.data;
      this.pageId = source;
      if (this.url !== url) {
        //console.error(`ready1: this.url !== url: ${this.url} !== ${url}`);
        // TODO: handle expected URL and reported URL from ready
      }
      this.url = url;
      this.state = DISPATCHER_STATE_READY1;
      this.next();
    }
    starting1(event) {
      this.clearTimeout();
      const { sessionId } = event.data;
      if (this.session.sessionId !== sessionId) {
        const reason = `${this.state}.starting1: unexpeted sessionId: ${sessionId}, expecting ${this.session.sessionId}`;
        this.reset(this.state);
        this.error(reason);
      }
      else {
        if (this.timeoutId !== 0) {
          // another timer is running
          this.clearTimeout();
          this.error(`${this.state}.close: another timer is running`);
        }
        else {
          this.state = DISPATCHER_STATE_STARTING1;
          const ok = this.session.onStartSessionMessage(event.data);
          if (ok) {
            this.state = DISPATCHER_STATE_RUNNING;
          }
          else {
            const reason = `${this.state}.starting1: sessionId: ${this.session.sessionId} invalid startSession message`;
            this.reset(this.state);
            this.error(reason);
          }
        }
      }
    }
    stopped(event) {
      const { sessionId } = event.data;
      if (this.session.sessionId !== sessionId) {
        const reason = `${this.state}.stopped: unexpeted sessionId: ${sessionId}, expecting ${this.session.sessionId}`;
        this.reset(this.state);
        this.error(reason);
      }
      else {
        this.state = DISPATCHER_STATE_STOPPED;
        this.navigationType = null;
        if (this.timeoutId !== 0) {
          // another timer is running
          this.clearTimeout();
          this.error(`${this.state}.stopped: another timer is running`);
        }
      }
    }
    onNavigating(event) {
      const { url, navigationType, suiteParameters, timestamp } = event.data;
      switch (this.state) {
      case DISPATCHER_STATE_NAVIGATING0:
        // parameters for the sent TYPE_NAVIGATE have to be mirrored in the received TYPE_NAVIGATING
        if (this.navigationType === navigationType &&
            this.url === url) {
          this.state = DISPATCHER_STATE_NAVIGATING1;
          this.pageId = '';
        }
        else {
          this.error(`${this.state}.onNavigating: unexpected url ${url}, expecting ${this.url}`);
        }
        break;
      case DISPATCHER_STATE_STOPPED:
        switch (navigationType) {
        case NAVI_DEFERRED:
          this.state = DISPATCHER_STATE_NAVIGATING1;
          this.url = url;
          this.pageId = '';
          this.suiteParameters = suiteParameters;
          this.navigatingTimestamp = timestamp;
          if (this.timeoutId === 0) {
            const timeoutId = this.timeoutId = setTimeout(() => {
              this.timeout(timeoutId);
            }, Config.readyTimeout);
          }
          else {
            // another timer is running
            this.clearTimeout();
            this.reset(this.state);
            this.error(`${this.state}.onNavigating: another timer is running`);
          }
          break;
        default: // TODO; error handling and support other types
          this.error(`${this.state}.onNavigating: unexpected navigationType ${navigationType}`);
          break;
        }
        break;
      default: // TODO: error handling
        break;
      }
    }
    detach() {
      if (this.origin) {
        const bridgeName = NAME_MEDIATOR_BRIDGE + ':' + this.origin;
        const message = {
          type: TYPE_DETACH,
          source: NAME_REPORTER,
          target: bridgeName,
        };
        console.log(`Dispatcher: sending message`, message);
        this.constructor.port.postMessage(message);
      }
    }
  }

  await Dispatcher.populate(suiteGenerator_Scenarist, Suite);
  window.Dispatcher = Dispatcher;

  // <link rel="stylesheet" href="node_modules/mocha/mocha.css">
  const mochaCSS = Config.resolve('mocha/mocha.css');
  const linkElement = document.createElement('link');
  linkElement.setAttribute('rel', 'stylesheet');
  linkElement.setAttribute('href', mochaCSS);
  document.head.appendChild(linkElement);

  const scopeSelect = document.getElementById('scope');
  const testClassSelect = document.getElementById('test-class');
  scopeSelect.innerHTML = `<option value="">-- select scope --</option>`;
  for (let scope in Suite.scopes) {
    if (Suite.scopes[scope][SUITE_HTML] === SUITE_COMMON) {
      continue;
    }
    const option = document.createElement('option');
    option.value = scope;
    option.innerHTML = `${scope}`;
    scopeSelect.appendChild(option);
  }
  
  const linksSpan = document.getElementById('links');
  const links = Config.links;
  for (let link in links) {
    let anchor = document.createElement('a');
    anchor.href = links[link];
    anchor.target = link;
    anchor.innerHTML = link;
    linksSpan.appendChild(anchor);
    linksSpan.appendChild(document.createTextNode(' '));
  }

  function updateControlPanel() {
    const pseudoSearchParamsInHash = new URL(location.hash.substring(1), Config.reporterOrigin).searchParams;
    const scope = pseudoSearchParamsInHash.get('scope');
    if (scope) {
      scopeSelect.value = scope;
      const testIndex = pseudoSearchParamsInHash.get('testIndex');
      const testClass = pseudoSearchParamsInHash.get('testClass');
      const tests = Suite.scopes[scope].test;
      testClassSelect.innerHTML = `<option value="">-- all test classes --</option>`;
      for (let i = 0; i < tests.length; i++) {
        const testClasses = tests[i].split(',');
        for (const _testClass of testClasses) {
          const testClassOption = document.createElement('option');
          testClassOption.value = `${i},${_testClass}`;
          testClassOption.innerHTML = _testClass;
          testClassSelect.appendChild(testClassOption);
        }
      }
      if (testIndex && testClass) {
        testClassSelect.value = `${testIndex},${testClass}`;
      }
      else {
        testClassSelect.value = '';  
      }
    }
    else {
      scopeSelect.value = '';
      testClassSelect.innerHTML = `<option value="">-- all test classes --</option>`;
      testClassSelect.value = '';
    }
  }

  function updateHash() {
    const configPath = new URL(location.hash.substring(1), Config.reporterOrigin).pathname;
    const scope = scopeSelect.value;
    const [ testIndex, testClass ] = testClassSelect.value.split(',');
    let hash = `#${configPath}`;
    if (scope) {
      hash += `?scope=${encodeURIComponent(scope)}`;
      if (testIndex && testClass) {
        hash += `&testIndex=${encodeURIComponent(testIndex)}` +
                `&testClass=${encodeURIComponent(testClass)}`;  
      }
    }
    const changed = location.hash !== hash;
    if (changed) {
      location.assign(hash);
    }
    return changed;
  }

  function scopeChanged() {
    const scope = scopeSelect.value;
    testClassSelect.innerHTML = `<option value="">-- all test classes --</option>`;
    if (scope) {
      const tests = Suite.scopes[scope].test;
      for (let i = 0; i < tests.length; i++) {
        const testClasses = tests[i].split(',');
        for (const _testClass of testClasses) {
          const testClassOption = document.createElement('option');
          testClassOption.value = `${i},${_testClass}`;
          testClassOption.innerHTML = _testClass;
          testClassSelect.appendChild(testClassOption);
        }
      }
    }
    testClassSelect.value = '';
  }

  function testClassChanged() {
  }

  customElements.define('mocha-container', class MochaContainer extends HTMLElement {
    constructor() {
      super();
      this.reports = {};
      this._onHashChange = (event) => {
        return this.onHashChange(event);
      };
    }
    initialReport() {
      return `<div id="mocha"></div>`;
    }
    onHashChange(event, connected = false) {
      updateControlPanel();
      let report = this.reports[location.href];
      if (report) {
        this.innerHTML = '';
        this.appendChild(report);
      }
      else {
        this.innerHTML = this.initialReport();
        report = this.children[0];
        this.reports[location.href] = report;
        if (!connected) {
          Dispatcher.rewind(suiteGenerator_Scenarist, Suite).then(() => {
            Dispatcher.start(mediatorPort);
          });
        }
      }
    }
    connectedCallback() {
      window.addEventListener('hashchange', this._onHashChange);
      this.onHashChange(null, true);
    }
    disconnectedCallback() {
      window.removeEventListener('hashchange', this._onHashChange);
    }
  });

  scopeSelect.addEventListener('change', (event) => {
    scopeChanged();
  });

  testClassSelect.addEventListener('change', (event) => {
    testClassChanged();
  });

  startButton.onclick = (event) => {
    console.log('start button clicked', event);
    console.time();
    if (!updateHash()) {
      Dispatcher.rewind(suiteGenerator_Scenarist, Suite).then(() => {
        Dispatcher.start(mediatorPort);
      })
      .catch((reason) => { console.error(reason); });
    }
  };

  await Dispatcher.ready();

  updateControlPanel();
}
catch (e) {
  console.error('Fatal Exception:', e);
  alert(e.message);
}
