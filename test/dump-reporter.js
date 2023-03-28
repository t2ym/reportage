/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Mocha from 'mocha';
const {
  EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_SUITE_BEGIN, EVENT_SUITE_END, EVENT_TEST_PASS, EVENT_TEST_FAIL, EVENT_TEST_PENDING
} = Mocha.Runner.constants;

class DumpReporter extends Mocha.reporters.Base {
  constructor(runner, options) {
    super(runner, options);

    const structuredClone = (arg) => {
      if (!(arg instanceof Object)) {
        return arg;
      }
      if (Array.isArray(arg)) {
        return arg.map(value => structuredClone(value));
      }
      else {
        const keys = Object.keys(arg);
        const clonable = {};
        for (const key of keys) {
          if (key === '__coverage__') {
            continue;
          }
          if (typeof arg[key] === 'function') {
            continue;
          }
          if (key.startsWith('$$')) {
            clonable[key.substring(2)] = structuredClone(arg[key]);
          }
          else {
            clonable[key] = structuredClone(arg[key]);
          }
        }
        return clonable;
      }
    }

    [ EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_SUITE_BEGIN, EVENT_SUITE_END, EVENT_TEST_PASS, EVENT_TEST_FAIL, EVENT_TEST_PENDING ].forEach((eventType) => {
      runner.on(eventType, (arg) => {
        console.log(`[ "${eventType}", ${JSON.stringify(structuredClone(arg))} ]`);
      });
    });

  }

}

export default DumpReporter;
