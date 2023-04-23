/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
// Provide a wrapper sandbox object so that mocha can run without contaminating the global scope of the browser
const _global = globalThis;
const sandbox = Object.create(_global);
let _onerror = null; // for mocha-es2018.js, onerror is the only global getter/setter property that has to be confined in the sandbox
let _wrappedOnError = null;
Object.defineProperty(sandbox, 'onerror', {
  configurable: true,
  enumerable: true,
  get() {
    return _onerror;
  },
  set(value) {
    if (_onerror) {
      _global.removeEventListener('error', _wrappedOnError);
    }
    /* istanbul ignore else */
    if (value) {
      _onerror = value;
      _wrappedOnError = (errorEvent) => {
        const { message, filename, lineno, colno, error } = errorEvent;
        return _onerror(message, filename, lineno, colno, error);
      };
      _global.addEventListener('error', _wrappedOnError);
    }
    return _onerror;
  },
});
const _globalThis = new Proxy(_global, {
  get: function(target, prop, receiver) {
    if (Object.hasOwn(sandbox, prop)) {
      //console.log('Proxy(sandbox).get property ', prop);
      return Reflect.get(sandbox, prop, target);
    }
    else {
      //console.log('Proxy(globalThis).get property ', prop);
      return Reflect.get(target, prop);
    }
  },
  set(obj, prop, value) {
    // TODO: properly handle _global getter/setter other than onerror
    //console.log('Proxy(sandbox).set property ', prop, value);
    return Reflect.set(sandbox, prop, value);
  }
});
// return the Proxy object for global object properties
[ 'self', 'window', 'globalThis', 'frames', 'top', 'parent' ].forEach(prop => {
  /* istanbul ignore else */
  if (_global === _global[prop]) {
    Object.defineProperty(sandbox, prop, { configurable: true, value: _globalThis, writable: false });
  }
});
export { _globalThis, sandbox };

/* for bdd, sandbox object contains these properties

  Mocha
  mocha
  before
  after
  beforeEach
  afterEach
  run
  context
  describe
  xcontext
  xdescribe
  specify
  it
  xspecify
  xit
  onerror

  Suite from scenarist

*/