/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { chai, assert } from "./common-suite.js";
import Suite from "./example-suite.js";
let extended_example = new Suite('extended_example', 'Description of Extended Example Suite');
let CommonSuite = Suite.scopes.common.classes.CommonSuite;
extended_example.htmlSuite = '/test/mocha3.html';
//extended_example.test = Suite.scopes.example.classes.TestEAB;
extended_example.test = Suite.scopes.example.classes.TestC;
extended_example.test = Suite.scopes.example.mixins.TestB;
// Tests for extended_example
extended_example.test = (base) => class ExtendedTestA extends base {
  get description() { return 'Description of Extended Test A'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Extended Test A operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Extended Test A');
    assert.equal(history.length, this.currentPhase + 1, `history.length === ${this.currentPhase + 1}`);
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //assert.isOk(false, 'Failing test A');
  }
}
extended_example.test = (base) => class ExtendedTestB extends base {
  get description() { return 'Description of Extended Test B'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Extended Test B operation');
    //this.element = document.querySelector('#example')
  }
  async checkpoint() {
    console.log('Checkpoint for Extended Test B');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //chai.assert.isOk(false, 'Failing test B');
  }
}
extended_example.test = (base) => class ExtendedTestC extends base {
  get description() { return 'Description of Extended Test C'; }
  async operation(_this) {
    this.skipPhase(_this);
    console.log('Extended Test C operation');
    //this.element = document.querySelector('#example')
    this.element = document.querySelector('#_link');
    //setTimeout(() => this.element.click(), 1000);
  }
  async checkpoint() {
    console.log('Checkpoint for Extended Test C');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //chai.assert.isOk(false, 'Failing test B');
  }
}

extended_example.test = (base) => class SkippedTest extends base {
  skip(_this) {
    this.__failed = false;
    _this.skip();
  }
  async operation(_this) {
    this.skip(_this);
  }
  async checkpoint() {
    console.log('Checkpoint for Skipped Test');
  }
}

extended_example.test = (base) => class TestX extends base {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Test X');
  }
}

extended_example.test = class EmptyTest extends CommonSuite {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Empty Test');
  }
}

extended_example.test = {
  TestC: {
    TestB: {
      // Extend example test
      ExtendedTestA: 'TestCB_ExtendedTestA',
      ExtendedTestB: 'TestCB_ExtendedTestB',
      ExtendedTestC: 'TestCB_ExtendedTestC',
    },
    TestX: {
      SkippedTest: 'XThenSkipped',
    },
    SkippedTest: {
      TestX: 'SkippedThenX',
    },
  }
}
//extended_example.run(0, '#example');
export default Suite;