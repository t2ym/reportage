/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { chai, assert } from "./common-suite.js";
import Suite from "./example-suite.js";
let errored_example = new Suite('errored_example', 'Description of Errored Example Suite');
errored_example.htmlSuite = '/test/mocha.html';
errored_example.test = Suite.scopes.example.classes.TestC;
errored_example.test = (base) => class SetupFailureTest extends base {
  static get reconnectable() { return false; }
  setup() {
    super.setup();
    throw new Error('setup failure');
  }
  get description() { return 'Description of Setup Failure Test'; }
  async operation(_this) {
    console.log('Setup Failure Test A operation');
  }
  async checkpoint() {
    console.log('Checkpoint for Setup Failure Test A');
  }
}
errored_example.test = (base) => class TeardownFailureTest extends base {
  static get reconnectable() { return false; }
  teardown() {
    super.teardown();
    throw new Error('teardown failure');
  }
  get description() { return 'Description of Teardown Failure Test'; }
  async operation(_this) {
    console.log('Teardown Failure Test operation');
  }
  async checkpoint() {
    console.log('Checkpoint for Teardown Failure Test');
  }
}
errored_example.test = (base) => class TimeoutTest extends base {
  static get reconnectable() { return false; }
  get description() { return 'Description of Timeout Test'; }
  async operation(_this) {
    console.log('Timeout Test operation');
    _this.timeout(1);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  async checkpoint() {
    console.log('Checkpoint for Timeout Test');
  }
}
errored_example.test = (base) => class HangUpTest extends base {
  static get reconnectable() { return false; }
  get description() { return 'Description of Hang Up Test'; }
  async operation(_this) {
    console.log('Hang Up Test operation');
    while (true) {}
  }
  async checkpoint() {
    console.log('Checkpoint for Hang Up Test');
  }
}
errored_example.test = (base) => class CloseTest extends base {
  static get reconnectable() { return false; }
  get description() { return 'Description of Close Test'; }
  async operation(_this) {
    console.log('Close Test operation');
    //throw new Error('Simulate Close Test');
    //await new Promise(resolve => setTimeout(resolve, 0));
    window.close();
    await new Promise(resolve => {
      window.addEventListener('beforeunload', (event) => {
        resolve();
        //while (true) {}
      });
    });
  }
  async checkpoint() {
    console.log('Checkpoint for Close Test');
  }
}
errored_example.test = class CloseTestOnly extends Suite {
  static get reconnectable() { return false; }
  get description() { return 'Description of Close Test Only'; }
  async operation(_this) {
    console.log('Close Test Only operation');
    //throw new Error('Simulate Close Test');
    //await new Promise(resolve => setTimeout(resolve, 0));
    window.close();
    await new Promise(resolve => {
      window.addEventListener('beforeunload', (event) => {
        resolve();
        //while (true) {}
      });
    });
  }
  async checkpoint() {
    console.log('Checkpoint for Close Test Only');
  }
}
errored_example.test = {
  TestC: {
    SetupFailureTest: 'TestC_SetupFailureTest',
    HangUpTest: 'TestC_HangUpTest',
    CloseTest: 'TestC_CloseTest',
    TeardownFailureTest: 'TestC_TeardownFailureTest',
    TimeoutTest: 'TestC_TimeoutTest',
  },
  CloseTestOnly: 'CloseTestX',
}
export default Suite;