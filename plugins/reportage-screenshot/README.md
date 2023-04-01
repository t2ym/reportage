# screenshot plugin for [reportage](https://github.com/t2ym/reportage)

reportage plugin to add screenshots to console reporter

## Example Project

[examples/vite-lit-ts-app](https://github.com/t2ym/reportage/tree/main/examples/vite-lit-ts-app)

## Install 

```sh
npm i --save-dev reportage-screenshot
```

## Configure

### `package.json` script

Add `npm run test:screenshot` script

```json
{
  ...
  "scripts": {
    ...
    "test": "reportage test/reportage.config.js",
    "test:screenshot": "npm test -- --import reportage-screenshot",
    ...
  }
  ...
}
```

### `test/reportage.config.js`

Add `Config.screenshotOptions` in sync with `consoleReporter`, `consoleReporterOptions`

```js
const Config = {
  ...
  consoleReporter: 'mochawesome',
  consoleReporterOptions: {
    reportDir: './test/mochawesome-report/',
    //reportFilename: '[status]_[datetime]-[name]-report',
    autoOpen: false,
    html: true,
    json: true,
    timeout: 5000,
    consoleReporter: 'list',
  },
  screenshotOptions: {
    enabled: true,
    exposedFunction: 'takeScreenshot',
    timeout: 1000,
    max_retries: 3,
    options: {
      // https://pptr.dev/api/puppeteer.screenshotoptions
      format: 'png',
      fullPage: true,
    },
  },
  ...
}
```

### `test/common-suite.js`

Common suite class needs to
- add `screenshotURL()` method 
- add `screenshot` URL to context in `beforeEach()`
- add a call to the exposed screenshot function in `afterEach()`

```js
// common-test.js global test classes
common.test = class CommonSuite extends Suite {
  async setup(_this) {
    await super.setup(_this);
    // hack until beforeEach() and afterEach() are implemented in scenarist
    const This = this;
    if (_this.test.parent._beforeEach.length == 0) {
      _this.test.parent._beforeEach.push(
        _this.test.parent._createHook(
          'beforeEach hook',
          async function () {
            await This.beforeEach(_this);
          }
        )
      );
    }
    if (_this.test.parent._afterEach.length == 0) {
      _this.test.parent._afterEach.push(
        _this.test.parent._createHook(
          'afterEach hook',
          async function () {
            await This.afterEach(_this);
          }
        )
      );
    }
    this.currentPhase = this._currentPhase;
    this.step = null;
  }
  async teardown(_this) {
    await super.teardown(_this);
  }
  async beforeEach(_this) {
    if (this.step === null) {
      this.step = 0;
    }
    else if (_this.currentTest.currentRetry() === 0) {
      this.step++;
    }
    const testURL = this.testURL(_this);
    _this.currentTest.context = [
      {
        title: 'testURL',
        value: testURL,
      },
    ];
    if (Config.screenshotOptions &&
        Config.screenshotOptions.enabled &&
        typeof window[Config.screenshotOptions.exposedFunction] === 'function') {
      const screenshotURL = this.screenshotURL(_this);
      _this.currentTest.context.push(
        {
          title: 'screenshot',
          value: screenshotURL,
        },
      );
    }
  }
  async afterEach(_this) {
    // _this.currentTest.state == 'passed', 'failed', 'pending'
    switch (_this.currentTest.state) {
    case 'passed':
    case 'failed':
      if (Config.screenshotOptions &&
          Config.screenshotOptions.enabled &&
          typeof window[Config.screenshotOptions.exposedFunction] === 'function') {
        const screenshotURL = this.screenshotURL(_this);
        let result = await window[Config.screenshotOptions.exposedFunction]({
          type: 'screenshot',
          screenshotURL: screenshotURL,
        });
        if (result !== 'done') {
          throw new Error(`afterEach: onScreenshot result is not 'done' for ${screenshotURL}`);
        }
      }
      break;
    case 'pending':
    default:
      break;
    }
  }
  ...
  screenshotURL(_this) {
    return new URL(`assets/` +
      `${encodeURIComponent(this.target.suite.scope)}` +
      `@${encodeURIComponent(this.target.suite.testIndex)}` +
      `@${encodeURIComponent(this.constructor.name)}` +
      `@${this.step}` +
      `.png`,
      new URL(Config.consoleReporterOptions.reportDir, Config.reporterOrigin)).href;
  }
  ...
}
```
