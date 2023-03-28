/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import {
  NAME_MEDIATOR,
  NAME_MEDIATOR_BRIDGE,
  NAME_REPORTER,

  TYPE_TRANSFER_PORT,
  TYPE_COVERAGE,
  TYPE_CONNECT,
  TYPE_DETACH,
} from './constants.js';

const targetAppOrigin = new URL(document.referrer).origin;

try {
  const worker = new SharedWorker('./mediator-worker.js', { /* type: 'module',*/ name: NAME_MEDIATOR }); // module worker has not been implemented in Firefox

  worker.port.onmessage = (event) => {
    const { type, transfer } = event.data;
    if (type === TYPE_TRANSFER_PORT) {
      window.opener.postMessage({
        type: TYPE_TRANSFER_PORT,
        source: NAME_MEDIATOR_BRIDGE,
        transfer: transfer,
      }, targetAppOrigin, transfer);
    }
    else if (type === TYPE_DETACH) {
      console.log(`mediator-worker-client.js: message `, event.data);
      window.opener.close();
    }
  }
  worker.port.postMessage({
    type: TYPE_CONNECT,
    targetAppOrigin: targetAppOrigin,
  }, []);

  setInterval(() => {
    if (!window.opener) {
      window.close();
    }
  }, 1000);

  if (globalThis.__coverage__) {
    console.log(`${import.meta.url}: globalThis.__coverage__ found`);
    window.addEventListener('beforeunload', (event) => {
      const target = window.opener;
      if (target) {
        target.postMessage({
          type: TYPE_COVERAGE,
          source: NAME_MEDIATOR_BRIDGE,
          target: NAME_REPORTER,
          __coverage__: [ globalThis.__coverage__ ],
        }, targetAppOrigin);
      }
      else {
        worker.port.postMessage({
        type: TYPE_COVERAGE,
        source: NAME_MEDIATOR_BRIDGE,
        target: NAME_REPORTER,
        __coverage__: [ globalThis.__coverage__ ],
        });
      }
    });
  }
}
catch (e) {
  console.error('Fatal Exception:', e);
  //window.close();
}
