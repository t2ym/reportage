/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { default as Suite, Config, chai, assert } from "./common-suite.js";
/*
const console = {
  log() {
    globalThis.console.log(...arguments);
    let log = localStorage.getItem('console.log');
    if (!log) {
      log = [];
    }
    else {
      log = JSON.parse(log);
    }
    log.push([...arguments]);
    localStorage.setItem('console.log', JSON.stringify(log, null, 2));
  }
}
*/
// example scope
let scope = 'example';
let example = new Suite(scope, 'Description of Example Suite');
example.htmlSuite = '/test/mocha.html';
let CommonSuite;
example.test = CommonSuite = Suite.scopes.common.classes.CommonSuite;
// test class mixin in "example" scope
example.test = (base) => class TestA extends base {
  get description() { return 'Description of Test A'; }
  * iteration() {
    yield * [ { name: 'Test A it 0' }, { name: 'Test A it 1' } ];
  }
  async operation(parameters, _this) {
    this.skipPhase(_this);
    console.log(parameters.name);
    //console.log(`Test A suiteParameters: ${JSON.stringify(this.target)}`);
    //this.element = document.querySelector('#example')
  }
  async checkpoint(parameters) {
    console.log('Checkpoint for Test A');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test A');
  }
}
example.test = (base) => class TestB extends base {
  get description() { return 'Description of Test B'; }
  static get reconnectable() { return false; }
  async operation(_this) {
    this.stepPhase();
    if (this.currentPhase + 1 === this.phase) {
      console.log('Test B operation (deferred navigation)', this.phase, this.currentPhase);
      Object.assign(this.target, {
        phase: this.phase,
        _url: (new URL(`/test/mocha2.html?x_phase=${this.phase}`, location.href)).href,
        deferredNavigation() {
          const navigate = function (url) {
            console.log(`TestB: history.pushState(null, '', "${url}")`);
            history.pushState(null, '', url); // history.length is reset as 2
            if (url !== location.href) {
              console.log(`TestB:navigate() location.href ${location.href} !== url ${url}`);
              setTimeout(() => {
                console.log(`TestB:navigate() recalling navigate(${url}) after 1000ms`);
                navigate(url);
              }, 1000);
            }
            window.addEventListener('beforeunload', (event) => {
              console.log(`TestB: beforeunload`);
              setTimeout(() => {
                console.log(`TestB: recalling history.go() 100ms after beforeunload`);
                history.go();
              }, 100);
            });
            window.addEventListener('unload', (event) => {
              console.log(`TestB: unload`);
            });
            console.log(`TestB: history.go()`, history.state, location.href, document.readyState);
            history.go();
          }
          const a = document.querySelector('#_link');
          a.href = this._url;
          a.click();
          //location.assign(this._url);
          //navigate(this._url);
        },
      });
    }
  }
  async checkpoint(_this) {
    this.skipPhase(_this);
    console.log('Checkpoint for Test B (deferred navigation)', this.phase, this.currentPhase, history.length, location.href);
    assert.equal(location.href, (new URL(`/test/mocha2.html?x_phase=${this.phase}`, location.href)).href, 'Deferred navigation URL');
    //assert.equal(history.length, this.phase + 1, 'history.length === this.phase + 1');
    //chai.assert.isOk(false, 'Failing test B');
  }
}
example.test = (base) => class Test1 extends base {
  get description() { return 'Description of Test 1'; }
  //static get skipAfterFailure() { return false; }
  async operation(_this) {
    this.skipPhase(_this);
    location.replace('#Test1');
    //this.element = document.querySelector('#example')
  }
  async checkpoint(_this) {
    console.log('Checkpoint for Test 1');
    chai.assert.equal(location.hash, '#Test1', 'URL hash is #Test1');
    //chai.assert.equal(JSON.stringify(Object.keys(_this)), '', 'test context exists');
    this.addContext(_this, {
      title: 'screenshot',
      value: new URL('assets/thin-hook-icon.png', new URL(Config.consoleReporterOptions.reportDir, Config.reporterOrigin))
    });
    //chai.assert.equal(JSON.stringify(Object.keys(_this.test)), 'object', 'typeof this.context is object');
    //await new Promise(resolve => setTimeout(resolve, 5000));
    //chai.assert.equal(_this.test.currentRetry(), 1, 'currentRetry is 1');
    chai.assert.equal('broken-element', 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test 1');
  }
}
example.test = (base) => class Test2 extends base {
  get description() { return 'Description of Test 2'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Test 2 operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Test 2');
    //chai.assert.equal('Test 2', 'must throw');
    //chai.assert.throws(() => {
    //  debugger;
    //});
    //chai.assert.equal('fake-example-element', 'example-element', 'Element is instantiated');
    //chai.assert.isOk(false, 'Failing test 2');
  }
}
example.test = (base) => class Test3 extends base {
  get description() { return 'Description of Test 3'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Test 3 operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Test 3');
    //chai.assert.equal('Test 2', 'must throw');
    //chai.assert.throws(() => {
    //  debugger;
    //});
    //chai.assert.equal('fake-example-element', 'example-element', 'Element is instantiated');
    chai.assert.isOk(false, 'Failing Test 3');
  }
}
example.test = (base) => class Test4 extends base {
  get description() { return 'Description of Test 4'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Test 4 operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Test 4');
    //assert.equal(history.length, this.phase + 1, 'history.length === this.phase + 1');
    //chai.assert.equal('Test 2', 'must throw');
    //chai.assert.throws(() => {
    //  debugger;
    //});
    //chai.assert.equal('fake-example-element', 'example-element', 'Element is instantiated');
    //chai.assert.isOk(false, 'Failing test 2');
  }
}
example.test = (base) => class RetryableTest1 extends base {
  get description() { return 'Description of RetryableTest 1'; }
  static get skipAfterFailure() { return false; } // must not skip the retried test even after a failure
  async operation(_this) {
    this.skipPhase(_this);
    // Note: Every Retryable test must come at the end of a test scenario
    // to avoid unexpected affects of retried tests on subsequent test scenario
    _this.test.retries(1); // set retries as 1
    location.replace('#RetryableTest1');
    //this.element = document.querySelector('#example')
  }
  async checkpoint(_this) {
    console.log('Checkpoint for RetryableTest 1');
    chai.assert.equal(location.hash, '#RetryableTest1', 'URL hash is #RetryableTest1');
    //_this.test.context = [`${Config.reporterOrigin}/mochawesome-report/assets/thin-hook-icon.png`];
    //chai.assert.equal(JSON.stringify(Object.keys(_this.test)), 'object', 'typeof this.context is object');
    //await new Promise(resolve => setTimeout(resolve, 5000));
    chai.assert.equal(_this.test.currentRetry(), 1, 'fails at 1st attempt (currentRetry 0); succeed in the 2nd trial (currentRetry 1); currentRetry is 1');
    //chai.assert.equal('broken-element', 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test 1');
  }
}
example.test = (base) => class RetryableTest2 extends base {
  get description() { return 'Description of RetryableTest 2'; }
  static get skipAfterFailure() { return false; } // must not skip the retried test even after a failure
  async operation(_this) {
    this.skipPhase(_this);
    // Note: Every Retryable test must come at the end of a test scenario
    // to avoid unexpected affects of retried tests on subsequent test scenario
    _this.test.retries(3); // set retries as 3
    location.replace('#RetryableTest2');
    //this.element = document.querySelector('#example')
  }
  async checkpoint(_this) {
    console.log('Checkpoint for RetryableTest 2');
    chai.assert.equal(location.hash, '#RetryableTest2', 'URL hash is #RetryableTest2');
    //_this.test.context = [`${Config.reporterOrigin}/mochawesome-report/assets/thin-hook-icon.png`];
    //chai.assert.equal(JSON.stringify(Object.keys(_this.test)), 'object', 'typeof this.context is object');
    //await new Promise(resolve => setTimeout(resolve, 5000));
    chai.assert.equal(_this.test.currentRetry(), 100, 'currentRetry is 100; always fails on all trials');
    //chai.assert.equal('broken-element', 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test 1');
  }
}
example.test = class TestC extends CommonSuite {
  get description() { return 'Description of Test C'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Test C operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Test C');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test A');
  }
}
///*
example.test = class TestD extends CommonSuite {
  get description() { return 'Description of Test D'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Test D operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Test D');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test A');
  }
}
example.test = class TestE extends CommonSuite {
  static get skipAfterFailure() { return true; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log(`TestE operation`);
  }
  async checkpoint() {
    console.log(`TestE checkpoint`);
  }
}
// scenarios
example.test = {
  // test class mixins
  '': [
    {
      TestA: {
        TestB: 'TestAThenB'
      },
      TestB: {
        TestA: 'TestBThenA'
      },
    },
    Suite.repeat('TestAThenB', 3, 'TestAB3')
  ],
  // test classes
  TestC: {
    TestAThenB: 'TestCAB'
  },
  TestD: 'TestDAlias',
  TestE: [
    {
      TestAThenB: 'TestEAB',
      TestA: {
        Test1: 'TestEA1',
        Test2: 'TestEA2',
        TestB: {
          Test1: {
            Test2: 'TestEAB12'
          }
        },
        TestBThenA: 'TestEABA'
      },
      TestB: {
        Test1: ''
      },
      TestAB3: 'TestEAB3; Description of "Test EAB3"',
      // Note: Every Retryable test must come at the end of a test scenario
      // to avoid unexpected affects of retried tests on subsequent test scenario
      RetryableTest1: 'TestERetryableTest1; Description of "Test E then RetryableTest 1"',
      RetryableTest2: 'TestERetryableTest2; Description of "Test E then RetryableTest 2"',
    },
    Suite.permute([ 'TestA', 'TestB', 'Test1' /* , 'Test3', 'Test2', 'Test4' */ ], (scenario) => ({
      Test2: 'Test_E_' + scenario.map(n => n.replace(/^Test/,'')).join('_') + '_2'
    }))
  ]
};
//*/
/*
example.test = {
  // test class mixins
  '': [
    {
      TestA: {
        TestB: 'TestAThenB'
      },
      TestB: {
        TestA: 'TestBThenA'
      },
    },
    Suite.repeat('TestAThenB', 3, 'TestAB3')
  ],
  // test classes
  TestC: {
    TestAThenB: 'TestCAB',
    TestBThenA: {
      TestBThenA: {
        TestBThenA: {
          Test4: 'TestCBABABA4',
        },
      },
    },
  },
};
*/

//let match = decodeURIComponent(window.location.href).match(/^.*[^_a-zA-Z0-9]TestSuites=([_a-zA-Z0-9,]*).*$/);

//if (match) {
  // Runner
  // match[1] = '0' for the first round of test suites runnable without reloading
  //example.run(0, '#example');
//}
export default Suite;
