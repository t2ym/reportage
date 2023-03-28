/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { default as Suite, Config, chai, assert } from "./common-suite.js";
// basic scope
let scope = 'basic';
let basic = new Suite(scope, 'Description of Basic Suite');
basic.htmlSuite = '/';
let CommonSuite;
basic.test = CommonSuite = Suite.scopes.common.classes.CommonSuite;
// test class mixin in "basic" scope
basic.test = (base) => class WaitForRendering extends base {
  get description() { return 'Button text is rendered'; }
  async operation(_this) {
    this.skipPhase(_this);
    let buttonText;
    let retry = 0;
    while (!buttonText) {
      try {
        buttonText = document.querySelector('my-element').shadowRoot.querySelector('[part=button]').innerText;
      }
      catch (e) {
        retry++;
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    if (retry > 0) {
      console.log(`WaitForRendering: retry = ${retry}`);
    }
  }
  async checkpoint() {
    chai.assert.isOk(document.querySelector('my-element').shadowRoot.querySelector('[part=button]').innerText.startsWith('count is '), 'Button text starts with "count is "');
  }
}
basic.test = (base) => class InitialCountIs0 extends base {
  get description() { return 'Button text is "count is 0"'; }
  async operation(_this) {
    this.skipPhase(_this);
    this.element = document.querySelector('my-element');
  }
  async checkpoint() {
    chai.assert.equal(this.element.count, 0, 'count property is 0');
    chai.assert.equal(this.element.shadowRoot.querySelector('[part=button]').innerText, `count is ${0}`, 'Initial button text is "count is 0"');
  }
}
basic.test = (base) => class IncrementCount extends base {
  get description() { return 'Click the button to increment the count'; }
  async operation(_this) {
    this.skipPhase(_this);
    this.element = document.querySelector('my-element');
    this.count = this.element.count;
    await this.forMutation(
      this.element.shadowRoot,
      async (target) => target.querySelector('[part=button]').innerText,
      async (target) => target.querySelector('[part=button]').click()
    );
  }
  async checkpoint() {
    chai.assert.equal(this.element.count, this.count + 1, `count property was incremented from ${this.count} to ${this.count + 1}`);
    chai.assert.equal(this.element.shadowRoot.querySelector('[part=button]').innerText, `count is ${this.count + 1}`, `Button text is "count is ${this.count + 1}"`);
  }
}
basic.test = (base) => class ViteNavi extends base {
  get description() { return 'Navigate to vite site'; }
  static get reconnectable() { return false; }
  async operation(_this) {
    this.stepPhase();
    if (this.currentPhase + 1 === this.phase) {
      console.log('ViteNavi operation (deferred navigation)', this.phase, this.currentPhase);
      Object.assign(this.target, {
        phase: this.phase,
        deferredNavigation() {
          document.querySelector('my-element').shadowRoot.querySelector('a[id=vite-navi]').click();
        },
      });
    }
  }
  async checkpoint(_this) {
    this.skipPhase(_this);
    console.log('Checkpoint for ViteNavi (deferred navigation)', this.phase, this.currentPhase, history.length, location.href);
    assert.equal(location.href, (new URL(`/external-navi-vite.html`, location.href)).href, 'Deferred navigation URL');
  }
}
basic.test = (base) => class LitNavi extends base {
  get description() { return 'Navigate to Lit site'; }
  static get reconnectable() { return false; }
  async operation(_this) {
    this.stepPhase();
    if (this.currentPhase + 1 === this.phase) {
      console.log('LitNavi operation (deferred navigation)', this.phase, this.currentPhase);
      Object.assign(this.target, {
        phase: this.phase,
        deferredNavigation() {
          document.querySelector('my-element').shadowRoot.querySelector('a[id=lit-navi]').click();
        },
      });
    }
  }
  async checkpoint(_this) {
    this.skipPhase(_this);
    console.log('Checkpoint for LitNavi (deferred navigation)', this.phase, this.currentPhase, history.length, location.href);
    assert.equal(location.href, (new URL(`/external-navi-lit.html`, location.href)).href, 'Deferred navigation URL');
  }
}
basic.test = (base) => class HomeNavi extends base {
  get description() { return 'Navigate to Home'; }
  static get reconnectable() { return false; }
  async operation(_this) {
    this.stepPhase();
    if (this.currentPhase + 1 === this.phase) {
      console.log('HomeNavi operation (deferred navigation)', this.phase, this.currentPhase);
      Object.assign(this.target, {
        phase: this.phase,
        deferredNavigation() {
          document.querySelector('a[id=home]').click();
        },
      });
    }
  }
  async checkpoint(_this) {
    this.skipPhase(_this);
    console.log('Checkpoint for HomeNavi (deferred navigation)', this.phase, this.currentPhase, history.length, location.href);
    assert.equal(location.href, (new URL(`/`, location.href)).href, 'Deferred navigation URL');
  }
}

// scenarios
basic.test = {
  // test class mixins
  '': [
  ],
  // test classes
  CommonSuite: {
    WaitForRendering: {
      InitialCountIs0: [
        {
          IncrementCount: {
            IncrementCount: 'ClickButtonTwice; Load and Click the button twice',
            ViteNavi: {
              HomeNavi: 'ClickButtonThenNaviToVite; Load, Click the button, Navigate to Vite, and back to Home',
            },
            LitNavi: {
              HomeNavi: 'ClickButtonThenNaviToLit; Load, Click the button, Navigate to Lit, and back to Home',
            },
          },
        },
      ]
    },
  },
};

export default Suite;
