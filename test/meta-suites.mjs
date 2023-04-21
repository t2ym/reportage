/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import fs from 'fs';
//import path from 'path';
import { EventEmitter} from 'events';
import { spawn } from 'child_process';
import Suite from 'scenarist/Suite.mjs';
import chai from '@esm-bundle/chai';

let meta = new Suite('meta', 'Meta Suites');

meta.test = class MetaTest extends Suite {
  async setup() {
    await super.setup();
    this.skipAfterFailure = false;
  }
  async teardown() {
    await super.teardown();
  }
}

meta.test = (base) => class SpawnTestSuites extends base {
  setup() {
    super.setup();
    this.data = [];
    this.eventEmitter = new (class Emitter extends EventEmitter {})();
    const test = spawn('node', [
      'cli.js',
      '--import', './test/reporter-test.mjs',
      'test/reportage.config.js',
      'test/close/reportage.config.js',
      'test/empty/reportage.config.js',
      'test/phased-ready-timeout-noretry/reportage.config.js',
      'test/phased-ready-timeout/reportage.config.js',
      'test/phased-start-timeout-noretry/reportage.config.js',
      'test/phased-start-timeout/reportage.config.js',
      'test/ready-timeout-noretry/reportage.config.js',
      'test/ready-timeout/reportage.config.js',
      'test/single/reportage.config.js',
      'test/start-timeout/reportage.config.js',
      'test/successive-ready-timeout-noretry/reportage.config.js',
      'test/successive-ready-timeout/reportage.config.js',
    ]);

    test.stdout.on('data', (data) => {
      this.onData(data);
    });
    
    test.stderr.on('data', (data) => {
      this.onErrorData(data);
    });
    
    test.on('close', (code) => {
      this.onClose(code);
    });
  }

  onData(data) {
    data = data.toString();
    //console.log(`onData ${data}`);
    let appendToLast = false;
    if (this.data.length > 0 && !this.data[this.data.length - 1].endsWith('\n')) {
      appendToLast = true;
    }
    while (data) {
      const newline = data.indexOf('\n');
      if (newline < 0) {
        if (appendToLast) {
          this.data[this.data.length - 1] = this.data[this.data.length - 1] + data;
        }
        else {
          this.data.push(data);
        }
        break;
      }
      else {
        if (appendToLast) {
          this.data[this.data.length - 1] = this.data[this.data.length - 1] + data.substring(0, newline + 1);
        }
        else {
          this.data.push(data.substring(0, newline + 1));
        }
        data = data.substring(newline + 1);
      }
    }
    this.eventEmitter.emit('data-updated');
  }
  onErrorData(data) {
    throw new Error(data.toString());
  }
  onClose(exitCode) {
    this.eventEmitter.emit('data-updated');
  }

  * iteration() {
    const dumpText = fs.readFileSync('test/dump.txt').toString();
    const lines = dumpText.split('\n');
    //console.log(`lines.length = ${lines.length}`);
    for (let index = 0; index < lines.length; index++) {
      let line = lines[index];
      let data = JSON.parse(line);
      //console.log(`yield ${index}`);
      yield { index: index, name: (data[1] && data[1].title ? `type: ${data[0]} title: ${data[1].title}` : `type: ${data[0]} data: ${JSON.stringify(data[1])}`), data: data, line: line };
    }
  }
  async operation(parameters) {    
    const { index } = parameters;
    //console.log(`operation index ${index}`);
    if (!(this.data[index] && this.data[index].endsWith('\n'))) {
      let listener;
      let dataResolve;
      let dataPromise = new Promise((resolve, reject) => {
        dataResolve = resolve;
      });
      this.eventEmitter.on('data-updated', listener = (event) => {
        if (this.data[index] && this.data[index].endsWith('\n')) {
          this.eventEmitter.off('data-updated', listener);
          dataResolve();
        }
      });
      await dataPromise;
    }
  }
  async checkpoint(parameters) {
    const { index, name, data, line } = parameters;
    const resultLine = this.data[index];
    chai.assert.isOk(resultLine && resultLine.endsWith('\n'), 'line ends with newline');
    //console.log(this.resultLine);
    const resultData = JSON.parse(this.data[index]);
    if (typeof data[1].duration === 'number') {
      data[1].duration = 0;
      resultData[1].duration = 0;
    }
    if (typeof data[1].start === 'string') {
      data[1].start = '*';
      resultData[1].start = '*';
    }
    if (typeof data[1].end === 'string') {
      data[1].end = '*';
      resultData[1].end = '*';
    }
    if (typeof data[1].stack === 'string') {
      data[1].stack = '*';
      resultData[1].stack = '*';
    }
    if (data[1].__mocha_id__) {
      data[1].__mocha_id__ = '*';
      resultData[1].__mocha_id__ = '*';
    }
    if (data[1].parent && data[1].parent.__mocha_id__) {
      data[1].parent.__mocha_id__ = '*';
      resultData[1].parent.__mocha_id__ = '*';
    }
    if (data[1].ctx && data[1].ctx.currentTest && data[1].ctx.currentTest.__mocha_id__) {
      data[1].ctx.currentTest.__mocha_id__ = '*';
      resultData[1].ctx.currentTest.__mocha_id__ = '*';
    }
    if (data[1].retriedTest && data[1].retriedTest.__mocha_id__) {
      data[1].retriedTest.__mocha_id__ = '*';
      resultData[1].retriedTest.__mocha_id__ = '*';
      data[1].retriedTest.duration = 0;
      resultData[1].retriedTest.duration = 0;
      data[1].retriedTest.parent.__mocha_id__ = '*';
      resultData[1].retriedTest.parent.__mocha_id__ = '*';
    }
    chai.assert.deepEqual(resultData, data, `Expected output at line index ${index}`);
  }
}

meta.test = {
  // test class mixins
  '': [
  ],
  // test classes
  MetaTest: {
    SpawnTestSuites: 'CheckTestOutput',
  },
};

for (let scope in Suite.scopes) {
  const tests = Suite.scopes[scope].test;
  for (let index = 0; index < tests.length; index++) {
    Suite.scopes[scope].run(index);
  }
}
