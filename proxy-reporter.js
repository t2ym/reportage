/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2022, 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/

/*
Note: initial obsoleted design

target.html <--- window.open()--------------------------------------- reporter.html
  +- mocha.run()                                                        +- ReceiverRunner(origin, Mocha.reporters.HTML)
    +- Runner                                                              +- startListening()
      +- ProxyReporter(origin)                                                +- window.addEventListener('message', listener)
        +- window.opener.postMessage({ type: 'openReporter' }, origin) -(open)> +- createStream()
          +- window.addEventListener('message')                                   +- onOpen(): reporter = new Mocha.reporters.HTML()
            +- writer = stream.getWriter()   <------------(stream)--------------  +- event.source.postMessage(['transferWritableStream', stream])
              +- transferEvent('suite', arg) ----{ type: 'suite', arg: arg }----> +- reporter.suiteHandler(arg))
              +- transferEvent('pass', arg)  ----{ type: 'pass', arg: arg }-----> +- reporter.passHandler(arg))
                                                         ...
              +- transferEvent('suite end',arg) -{type: 'suite end', arg: arg}--> +- reporter.suiteEndHandler(arg))
                                                         ...
              +- transferEvent('end', arg)  ----{ type: 'end', arg: arg }-------> +- onEnd()
              +- writer.close()             -------------(close)----------------> +- onClose()
 */

/**
 * Installer of the custom reporter to Mocha.reporters
 */
export function reporterInstaller(Mocha, Config) {
  const namespace = {};

  const Base = Mocha.reporters.Base;
  const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
    EVENT_HOOK_BEGIN,
    EVENT_HOOK_END,
    EVENT_TEST_PASS,
    EVENT_TEST_FAIL,
    EVENT_TEST_PENDING,    
    STATE_IDLE,
    STATE_RUNNING,
    STATE_STOPPED,
  } = Mocha.Runner.constants;

  // Pseudo-Runner class which transfers received events from Aggregator to HTML reporter
  // Note: ReceiverRunner is NOT instantiated via mocha.run()
  namespace.ReceiverRunner = class ReceiverRunner {
    constructor(reporterType = Mocha.reporters.HTML) {
      this.state = STATE_IDLE;
      this.reporterType = reporterType;
      this.suite = {
        title: '',
        suites: [],
      };
      this.listeners = {
        [EVENT_RUN_BEGIN]: [{
          listener: this.onStart,
          once: true,
        }],
        [EVENT_SUITE_BEGIN]: [{
          listener: this.onSuite,
          once: false,
        }],
        [EVENT_TEST_PASS]: [{
          listener: this.onTest,
          once: false,
        }],
        [EVENT_TEST_FAIL]: [{
          listener: this.onTest,
          once: false,
        }],
        [EVENT_TEST_PENDING]: [{
          listener: this.onTest,
          once: false,
        }],
      };
    }
    registerOnEnd() {
      this.on(EVENT_RUN_END, this.onEnd);
    }
    onMochaEvent(mEvent) {
      if (this.listeners[mEvent.type]) {
        Object.assign(this.stats, mEvent.stats);
        const arg = this.decodeArg(mEvent.arg);
        for (let { listener, once } of this.listeners[mEvent.type]) {
          listener.call(this, arg, arg.err); // Base reporter fail listener expects the 2nd argument as an error object
        }
      }
      else {
        //console.warn('ReceiverRunner.onChunk: unhandled mocha event', mEvent);
      }
    }
    onOpen(eventData) {
      /*
        { type: "open", runner: { total: num, stats: { } }, options: { reporterOptions: {} } }
      */
      if (eventData && typeof eventData === 'object' /* && eventData.type === TYPE_OPEN_REPORTER */ && 
          typeof eventData.runner === 'object') {
        this.total = eventData.runner.total;
        this.stats = eventData.runner.stats;
        this.options = eventData.options;
        this.reporter = new this.reporterType(this, this.options);
        this.registerOnEnd();
        //console.log('ReceiverRunner.onOpen: ', eventData);
      }
      else {
        console.error('ReceiverRunner.onOpen: invalid event.data', eventData);
      }
    }
    onStart() {
      //console.log('ReceiverRunner.onStart()');
      this.suiteMap = new Map();
      this.state = STATE_RUNNING;
    }
    onSuite(suite) {
      suite.suites = suite.suites || [];
      suite.tests = suite.tests || [];
      suite._beforeAll = suite._beforeAll || [];
      suite._beforeEach = suite._beforeEach || [];
      suite._afterAll = suite._afterAll || [];
      suite._afterEach = suite._afterEach || [];
      this.suiteMap.set(suite.__mocha_id__, suite);
      //console.log(`onSuite ${suite.title} id:${suite.__mocha_id__}, parent id: ${suite.parent ? suite.parent.__mocha_id__ : null}`)
      //console.log(this.suiteMap);
      if (suite.root) {
        this.suite = suite;
      }
      else {
        let parentSuite = this.suiteMap.get(suite.parent.__mocha_id__);
        if (parentSuite) {
          parentSuite.suites.push(suite);
        }
        else {
          this.suite.suites.push(suite); // TODO: error?
          //console.error('parentSuite not found', suite);
        }
      }
    }
    onTest(test) {
      let parentSuite = this.suiteMap.get(test.parent.__mocha_id__);
      if (parentSuite) {
        parentSuite.tests.push(test);
      }
      else {
        this.suite.tests.push(test); // TODO: error?
        //console.error('parentSuite not found', test);
      }
    }
    onEnd(arg) {
      //console.log(`ReceiverRunner.onEnd()`);
      this.state = STATE_STOPPED;
      if (typeof this.reporter.done === 'function') {
        this.reporter.done();
      }
    }
    on(type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push({
        listener: listener,
        once: false,
      });
    }
    once(type, listener) { // TODO: once feature is not functional
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push({
        listener: listener,
        once: true,
      });
    }
    decodeArg(arg) {
      //console.log('decodeArg:original', arg);
      Object.keys(arg).forEach(key => {
        if (key.startsWith('$$')) {
          arg[key.substring(2)] = () => arg[key];
        }
        if (arg[key] && typeof arg[key] === 'object' && !Array.isArray(arg[key])) {
          Object.keys(arg[key]).forEach(_key => {
            if (_key.startsWith('$$')) {
              arg[key][_key.substring(2)] = () => arg[key][_key];
            }
          });
        }
      });
      //console.log('decodeArg', arg);
      return arg;
    }
  }

  namespace.ProxyReporter = class ProxyReporter extends Base {
    constructor(runner, options) {
      super(runner, options);
  
      const This = this;
  
      if (options &&
          options.reporterOptions &&
          options.reporterOptions.start &&
          options.reporterOptions.end &&
          options.reporterOptions.port instanceof MessagePort) {
  
        this.start(runner, options);
  
        [ EVENT_RUN_BEGIN, EVENT_SUITE_BEGIN, EVENT_SUITE_END, EVENT_TEST_PASS, EVENT_TEST_FAIL, EVENT_TEST_PENDING ].forEach((eventType) => {
          runner.on(eventType, (arg) => {
            //console.log('transferring chunk', arg);
            This.enqueueEvent(eventType, arg);
            This.transferEvent();
          });
        });
  
        runner.once(EVENT_RUN_END, () => {
          //console.log('transferring event ', EVENT_RUN_END);
          This.enqueueEvent(EVENT_RUN_END, { $$fulltitle: '' });
          This.transferEvent();
        });
      }
      else {
        throw new Error(`${this.constructor.name}: invalid reporterOptions ${JSON.stringify(options ? options.reporterOptions : null)}`);
      }
    }

    start(runner, options) {
      this.reporterOrigin = options.reporterOptions.reporterOrigin;
      this.pendingQueue = [];
      this.mochaTestIdInventory = {};
      this.port = options.reporterOptions.port;
      options.reporterOptions.port = null;
      this.onTransferPort(this.port);
      this.runner = runner;
      this.options = options;
      this._onBeforeUnload = (event) => {
        this.onBeforeUnload(event);
      };
      window.addEventListener('beforeunload', this._onBeforeUnload, false);
      this.options.reporterOptions.start(runner, this);
    }

    onBeforeUnload(event) {
      if (this.writer) {
        if (this.writerClosed) {
          //this.writer.close();
        }
        else {
          const stack = (new Error().stack);
          const reason = stack + '\nunexpected unload of target page';
          this.writer.abort(reason);
          console.error('writer.abort() on unexpected unload of target page');
        }
      }
    }

    onTransferPort(port) {
      if (port instanceof MessagePort) {
        this.portReceived = true;
        this.port = port;
        const This = this;
        this.writer = {
          write(mEvent) {
            This.port.postMessage({
              op: 'write',
              payload: mEvent,
              sent: Date.now(),
            });
          },
          close() {
            This.port.postMessage({
              op: 'close',
              sent: Date.now(),
            });
          },
          abort(err) {
            This.port.postMessage({
              op: 'abort',
              err: err,
              sent: Date.now(),
            });
          },
          beacon() {
            This.port.postMessage({
              op: 'beacon',
              sent: Date.now(),
            });
          },
        };
        this.port.start();
        this.writer.beacon();
        setInterval(() => {
          this.writer.beacon();
        }, 1000);
        this.writerClosed = false;
        //console.log('onTransferPort: MessagePort received');
      }
    }

    enqueueEvent(eventType, arg = {}) {
      //console.log('enqueueEvent called', eventType, arg);
      /*
      Suite.prototype.serialize = function serialize() {
        return {
          _bail: this._bail,
          $$fullTitle: this.fullTitle(),
          $$isPending: Boolean(this.isPending()),
          root: this.root,
          title: this.title,
          [MOCHA_ID_PROP_NAME]: this.id,
          parent: this.parent ? {[MOCHA_ID_PROP_NAME]: this.parent.id} : null
        };
      };
      Test.prototype.serialize = function serialize() {
        return {
          $$currentRetry: this._currentRetry,
          $$fullTitle: this.fullTitle(),
          $$isPending: Boolean(this.pending),
          $$retriedTest: this._retriedTest || null,
          $$slow: this._slow,
          $$titlePath: this.titlePath(),
          body: this.body,
          duration: this.duration,
          err: this.err,
          parent: {
            $$fullTitle: this.parent.fullTitle(),
            [MOCHA_ID_PROP_NAME]: this.parent.id
          },
          speed: this.speed,
          state: this.state,
          title: this.title,
          type: this.type,
          file: this.file,
          [MOCHA_ID_PROP_NAME]: this.id
        };
      };
      Hook.prototype.serialize = function serialize() {
        return {
          $$currentRetry: this.currentRetry(),
          $$fullTitle: this.fullTitle(),
          $$isPending: Boolean(this.isPending()),
          $$titlePath: this.titlePath(),
          ctx:
            this.ctx && this.ctx.currentTest
              ? {
                  currentTest: {
                    title: this.ctx.currentTest.title,
                    [MOCHA_ID_PROP_NAME$1]: this.ctx.currentTest.id
                  }
                }
              : {},
          duration: this.duration,
          file: this.file,
          parent: {
            $$fullTitle: this.parent.fullTitle(),
            [MOCHA_ID_PROP_NAME$1]: this.parent.id
          },
          state: this.state,
          title: this.title,
          type: this.type,
          [MOCHA_ID_PROP_NAME$1]: this.id
        };
      };
      */
      const chunk = {
        type: eventType,
        stats: this.runner.stats,
        timings: {}
      };    
      if (arg instanceof Mocha.Suite) {
        chunk.arg = arg.serialize();
        chunk.arg.context = [];
        if (eventType === EVENT_SUITE_BEGIN) {
          const id = chunk.arg.__mocha_id__;
          if (chunk.arg.root) {
            this.suiteIdMap = {};
            this.suiteIdMap[id] = Symbol.for('root');
            this.testClassIndex = -2; // root
          }
          else {
            const parentId = chunk.arg.parent.__mocha_id__;
            if (this.suiteIdMap[parentId] === Symbol.for('root')) {
              this.suiteIdMap[id] = Symbol.for('scope');
              this.testClassIndex = -1; // scope
            }
            else if (this.suiteIdMap[parentId] === Symbol.for('scope')) {
              this.suiteIdMap[id] = Symbol.for('class');
              if (this.testClassIndex < 0) {
                this.testClassIndex = 0; // first
              }
              else {
                this.testClassIndex++; // subsequent
              }
            }
          }
          const reporterURL = new URL(Config.reporterURL);
          const configPath = (reporterURL.hash.substring(1) || '/test/reportage.config.js').split('?')[0];
          let url = `${reporterURL.origin}${reporterURL.pathname}${reporterURL.search}#${configPath}`;
          if (!chunk.arg.root) {
            url += `?scope=${encodeURIComponent(this.driver.suite.scope)}`;
            if (this.testClassIndex >= 0) {
              url += `&testIndex=${encodeURIComponent(this.driver.suite.testIndex)}` +
                     `&testClass=${encodeURIComponent(this.driver.suite.tests.split(',')[this.testClassIndex])}`;
            }
          }
          chunk.arg.context.push({
            title: 'suiteURL',
            value: url,
          });
        }
      }
      else if (arg instanceof Mocha.Test) {
        const id = arg.__mocha_id__;
        if (id && this.mochaTestIdInventory[id]) {
          return; // skip enqueueing redundant tests such as unhandled exceptions
        }
        this.mochaTestIdInventory[id] = eventType;
        let err = arg.err;
        if (err) {
          err = {
            $$toString: err.toString(),
            actual: err.actual,
            expected: err.expected,
            message: err.message,
            operator: err.operator,
            showDiff: err.showDiff,
            stack: err.stack,
          };
        }
        else {
          // arg.err is mandatory for failures but is missing
          // supply err for a failure
          err = {
            $$toString: arg.title,
            actual: '',
            expected: '',
            message: arg.title,
            operator: '',
            showDiff: '',
            stack: '',
          };
        }
        chunk.arg = arg.serialize();
        chunk.arg.body = arg.body;
        chunk.arg.err = err;
        if (chunk.arg.$$retriedTest instanceof Mocha.Test) {
          chunk.arg.$$retriedTest = chunk.arg.$$retriedTest.serialize();
        }
        chunk.arg.context = JSON.parse(JSON.stringify(arg.context || [])); // mochawesome addContext
      }
      else if (arg instanceof Mocha.Hook) {
        let err = arg.err;
        if (err) {
          err = {
            $$toString: err.toString(),
            actual: err.actual,
            expected: err.expected,
            message: err.message,
            operator: err.operator,
            showDiff: err.showDiff,
            stack: err.stack,
          };
        }
        /*
        else {
          // arg.err is mandatory for failures but is missing
          // supply err for a failure
          err = {
            $$toString: arg.title,
            actual: '',
            expected: '',
            message: arg.title,
            operator: '',
            showDiff: '',
            stack: '',
          };
        }
        */
        chunk.arg = arg.serialize();
        chunk.arg.body = arg.body;
        chunk.arg.err = err;
      }
      else {
        chunk.arg = arg;
      }
      chunk.timings.enqueue = Date.now();
      this.pendingQueue.push(chunk);
      //console.log("enqueueEvent: Chunk enqueued", chunk);
    }

    onClose(err) {
      //console.log('ProxyReporter.onClose() called');
      this.writerClosed = true;
      this.writer.close();
      if (this.options &&
          this.options.reporterOptions &&
          typeof this.options.reporterOptions.end === 'function') {
        this.options.reporterOptions.end(err, this);
      }
      if (typeof this._onBeforeUnload === 'function') {
        window.removeEventListener('beforeunload', this._onBeforeUnload);
      }
    }

    transferEvent() {
      const writable = !!(this.writer && !this.writerClosed);
      //console.log('transferEvent called writable = ', writable, 'writer', this.writer, 'writerClosed', this.writerClosed);

      if (writable) {
        let chunk;
        try {
          while (!this.writerClosed && this.pendingQueue.length > 0) {
            chunk = this.pendingQueue.shift();
            //console.log(`About to write a chunk from pending queue to sink (${this.pendingQueue.length} remaining)`, chunk);
            chunk.timings.write = Date.now();
            this.writer.write(chunk);
            //console.log(`Chunk written from pending queue (${this.pendingQueue.length} remaining) to sink in ${Date.now() - chunk.timings.write}ms`, chunk);
            if (chunk.type === EVENT_RUN_END) {
              this.onClose();
            }
          }
        }
        catch (err) {
          console.error('catching error', err, chunk);
          this.onClose(err);
        }
      }
    }
  }
  namespace.ProxyReporter.description = 'Proxy reporter events to ReceiverRunner via MessagePort';

  Mocha.reporters.ProxyReporter = Mocha.reporters['proxy-reporter'] = namespace.ProxyReporter;

  return namespace;
}
