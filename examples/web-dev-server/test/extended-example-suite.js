/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { chai, assert } from "./common-suite.js";
import Suite from "./example-suite.js";
let extended_example = new Suite('extended_example', 'Description of Extended Example Suite');
extended_example.htmlSuite = '/mocha3.html';
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
    assert.equal(location.href, (new URL(`/mocha2.html?x_phase=${this.phase}`, location.href)).href, 'Deferred navigation URL');
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
    assert.equal(location.href, (new URL(`/mocha2.html?x_phase=${this.phase}`, location.href)).href, 'Deferred navigation URL');
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
    assert.equal(location.href, (new URL(`/mocha2.html?x_phase=${this.phase}`, location.href)).href, 'Deferred navigation URL');
    //assert.equal(this.element.is, 'example-element', 'Element is instantiated');
    //chai.assert.isOk(false, 'Failing test B');
  }
}
/*
extended_example.test = {
  TestEAB: {
    // Extend example test
    ExtendedTestA: 'TestEAB_ExtendedTestA',
    ExtendedTestB: 'TestEAB_ExtendedTestB',
    ExtendedTestC: 'TestEAB_ExtendedTestC',
  }
}
*/
extended_example.test = {
  TestC: {
    TestB: {
      // Extend example test
      ExtendedTestA: 'TestCB_ExtendedTestA',
      ExtendedTestB: 'TestCB_ExtendedTestB',
      ExtendedTestC: 'TestCB_ExtendedTestC',
    }
  }
}
//extended_example.run(0, '#example');
export default Suite;