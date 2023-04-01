# Vite + Lit + TS project with reportage

- Based on the project template by `npm create vite@latest`

## CLI test

### Summary
```sh
npm i
npm run reporter:start
npm run build:coverage
npm run dist:start
npm test
google-chrome http://localhost:3000/test/mochawesome-report/mochawesome.html \
  http://localhost:3000/coverage/index.html
```

### Prerequisites
- `nginx -p . -c nginx.conf` is used as a command to serve the reporter
- Note: Any web servers with CORS (`Access-Control-Allow-Origin *;`) setting can suffice for serving the reporter as long as they can handle all requests properly

### Install Dependencies
```sh
npm i
```
- Note: `postinstall` npm script is specific to the examples of the `reportage` repo to install the reportage package from the `../..` (reportage package top) directory to fetch the latest local `reportage` package source. This `postinstall` process is unnecessary for real projects.

### Start the reporter server at http://localhost:3000
```sh
npm run reporter:start
```
- Note: `reporter:start` launches `nginx` at `.`

### Start the app server at http://localhost:3001
- Option 1: start dev server at http://localhost:3001
```sh
npm run dev:coverage
```
- Note: `vite` dev server might be too fragile to handle concurrent tests

- Option 2: start preview server at http://localhost:3001
```sh
npm run build:coverage
npm run preview
```
- Note: `vite` preview server might be too fragile to handle concurrent tests

- Option 3: start nginx at http://localhost:3001
```sh
npm run build:coverage
npm run dist:start
```
- Note: `dist:start` launches `nginx` at `dist/`

### Run CLI test
```sh
npm test
# CLI test with screenshots
npm run test:screenshot
```

### Open HTML reports

- Mochawesome Report: [http://localhost:3000/test/mochawesome-report/mochawesome.html](http://localhost:3000/test/mochawesome-report/mochawesome.html)
- Coverage Report: [http://localhost:3000/coverage/index.html](http://localhost:3000/coverage/index.html)

## GUI test

### Same steps for GUI tests before "Run CLI test"

### Launch Chrome or Edge browser with the following options

```sh
google-chrome --disable-ipc-flooding-protection \
  --disable-pushstate-throttle \
  --disable-background-timer-throttling \
  --disable-popup-blocking
```
- Note: It is recommended to create an alias or a command file to launch with the options

```sh
alias chrome='google-chrome --disable-ipc-flooding-protection --disable-pushstate-throttle --disable-background-timer-throttling --disable-popup-blocking '
```

### Create a new tester user profile once if not created yet
- The tester user profile need not to be associated with a Google account
- The profile has to be used for GUI tests

### Install the Test Helper browser extension
- Open `chrome://extensions/`
- Enable the Developer Mode
- Install the non-packaged extension from `node_modules/reportage/extension/chrome/`
  - The extension
    - Injects module `script` tags to test target pages
      - `http://localhost:3000/node_modules/reportage/driver.js#/test/reportage.config.js`
    - Clean up caches and storages
    - Notify the reporter page of navigated URLs

### Open the reporter page
- Open `http://localhost:3000/node_modules/reportage/reporter.html#/test/reportage.config.js

### Run GUI test
- Click the start ▶️ button

- Note: Currently, the `mochawesome` and `coverage` links show the reports from CLI test executions. They are NOT associated with the GUI test results for now.

## Test

### Suites
- [`test/basic-suite.js`](test/basic-suite.js)
- [`test/extended-suite.js`](test/extended-suite.js)
- [`test/common-suite.js`](test/common-suite.js) - define methods for handling test phases
- [`test/suites-loader.js`](test/suites-loader.js) - import above suites and scenarist
- Note: Currently, only [`scenarist`](https://github.com/t2ym/scenarist) UI, which wraps `mocha` BDD UI, is supported

### Configurations
- [`test/reportage.config.js`](test/reportage.config.js) - `reportage` configuration
- [`vite.config.ts`](vite.config.ts) - `vite` configuration: `coverage` mode is added
- [`.env.coverage`](.env.coverage) - `vite` `coverage` mode environment
- [`nyc.config.mjs`](nyc.config.mjs) - `nyc` coverage configuration
- [`nginx.conf`](nginx.conf) - reporter server nginx configuration (port 3000)
- [`nginx-dist.conf`](nginx-dist.conf) - dist server nginx configuration (port 3001)
- [`tsconfig.json`](tsconfig.json) - TypeScript configuration
- [`tsconfig.node.json`](tsconfig.node.json) - supplemental TypeScript configuration

### Reports
- [`test/mochawesome-report/mochawesome.html`](test/mochawesome-report/mochawesome.html) - Test report
- [`coverage/index.html`](coverage/index.html) - Coverage report

### Logs
- [`test/log/*.log`](test/log/) - nginx access and error logs
