/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
const NAVIGATION_PREFIX = 'navigation-';
const SCREENSHOT_PREFIX = 'screenshot-';
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
  case 'setup-injection':
    {
      chrome.storage.session.set({ injectionParameters: message.injectionParameters }).then(() => {
        console.log(`background.js: injectionParameters`, message.injectionParameters);
        sendResponse({ type: 'setup-injection-finished', injectionParameters: message.injectionParameters });
      });
    }
    break;
  case 'get-injection-parameters':
    {
      chrome.storage.session.get(['injectionParameters']).then((result) => {
        console.log(`background.js: get-injection-parameters`, result.injectionParameters);
        sendResponse({ type: 'injection-parameters', injectionParameters: result.injectionParameters });
      });
    }
    break;
  case 'cleanup':
    {
      const filterableTargets = {
        // filterable by origins/hostnames
        cookies: true, // The browser's cookies.
        cache: true, // The browser's cache.
        fileSystems: true, // Websites' file systems.; not on Firefox
        indexedDB: true, // Websites' IndexedDB data.
        localStorage: true, // Websites' local storage data.
        cacheStorage: true, // Cache storage
        serviceWorkers: true, // Service Workers.
        webSQL: true, // [DEPRECATED FEATURE] Websites' WebSQL data.
      };
      const nonFilterableTargets = {
        // non-filterable by origins/hostnames - Be aware that other apps with the same user profile are affected as well
        appcache: true, // [DEPRECATED FEATURE] Websites' appcaches.
        downloads: true, // [BASICALLY IRRELEVANT TO WEB TESTS] The browser's download list.
        history: true, // [Session history is reset on navigating to cleanup.html] The browser's history, which is different from window.history object
        formData: true, // [Autofill feature should be disabled in the browser settings] The browser's stored form data.
        passwords: true, // [Autofill feature should be disabled in the browser settings] Stored passwords.
      };
      const dataToRemove = message.parameters.dataToRemove;
      console.log(`dataToRemove: ${JSON.stringify(dataToRemove,null,0)}`);
      const filterableDataToRemove = {};
      const nonFilterableDataToRemove = {};
      for (let target in dataToRemove) {
        if (filterableTargets[target]) {
          filterableDataToRemove[target] = dataToRemove[target];
        }
        if (nonFilterableTargets[target]) {
          nonFilterableDataToRemove[target] = dataToRemove[target];
        }
      }
      chrome.browsingData.remove(
        {
          since: message.parameters.removalOptions.since || 0,
        },
        nonFilterableDataToRemove,
        () => {
          console.log(`chrome.browsingData.remove: done for non-filterable browsing data ${JSON.stringify(nonFilterableDataToRemove, null, 0)}`);
          chrome.browsingData.remove(
            message.parameters.removalOptions,
            filterableDataToRemove,
            () => {
              console.log(`chrome.browsingData.remove: done for filterable browsing data ${JSON.stringify(filterableDataToRemove, null, 0)} for origins ${JSON.stringify(message.parameters.removalOptions.origins,null,0)}`);
              sendResponse({ type: 'cleanup-finished', origins: message.parameters.removalOptions.origins });
            }
          );
        }
      );
    }
    break;
  case 'navigation':
    {
      const origin = new URL(message.url).origin;
      chrome.storage.session.set({ [`${NAVIGATION_PREFIX}${origin}`]: { url: message.url, timestamp: message.timestamp } }).then(() => {
        console.log(`background.js: navigation origin: ${origin} url: ${message.url} timestamp: ${message.timestamp}`);
        sendResponse({ type: 'navigation-url-stored', values: { [origin]: { url: message.url, timestamp: message.timestamp } } });
      });
    }
    break;
  case 'get-navigation':
    {
      const origin = message.origin;
      chrome.storage.session.get([`${NAVIGATION_PREFIX}${origin}`]).then((result) => {
        const value = result[`${NAVIGATION_PREFIX}${origin}`];
        console.log(`background.js: get-navigation for origin: ${origin}`, value);
        sendResponse({ type: 'navigation-url', values: value ? { [origin]: value } : {} });
      });
    }
    break;
  case 'clear-navigation':
    {
      const origin = message.origin;
      if (origin === '*') {
        chrome.storage.session.get(null).then((result) => {
          let targetOrigins = [];
          let targetResults = {};
          for (let origin in result) {
            if (origin.startsWith(NAVIGATION_PREFIX)) {
              targetOrigins.push(origin);
              targetResults[origin.substring(NAVIGATION_PREFIX.length)] = result[origin];
            }
          }
          chrome.storage.session.remove(targetOrigins).then(() => {
            console.log(`background.js: clear-navigation for origins: ${JSON.stringify(targetOrigins.map(value => value.substring(NAVIGATION_PREFIX.length)))}`);
            sendResponse({ type: 'navigation-url-cleared', values: targetResults });
          });
        });
      }
      else {
        chrome.storage.session.get([`${NAVIGATION_PREFIX}${origin}`]).then((result) => {
          if (result[`${NAVIGATION_PREFIX}${origin}`]) {
            chrome.storage.session.remove(`${NAVIGATION_PREFIX}${origin}`).then(() => {
              console.log(`background.js: clear-navigation for origin: ${origin}`, result[`${NAVIGATION_PREFIX}${origin}`]);
              sendResponse({ type: 'navigation-url-cleared', values: { [origin]: result[`${NAVIGATION_PREFIX}${origin}`] } });
            });
          }
          else {
            console.log(`background.js: clear-navigation for origin: ${origin} failed as the value is missing`);
            sendResponse({ type: 'navigation-url-cleared', values: {} });
          }
        });
      }
    }
    break;
  /*
  case 'screenshot':
    (async () => {
      let tab;
      try {
        const [ _tab ] = await chrome.tabs.query({ currentWindow: true, url: message.url });
        tab = _tab;
        await chrome.debugger.attach({ tabId: tab.id }, '1.3');
        const result = { type: 'screenshot-finished', err: null, tabId: tab.id, url: tab.url };
        Object.assign(result, await chrome.debugger.sendCommand({ tabId: tab.id }, 'Page.getLayoutMetrics', {}));
        let { data } = await chrome.debugger.sendCommand({ tabId: tab.id }, 'Page.captureScreenshot', {
          format: message.format,
          quality: message.quality,
          clip: {
            x: 0,
            y: 0,
            width: result.cssContentSize.width,
            height: result.cssContentSize.height,
            scale: 1
          },
          captureBeyondViewport: true,
        });
        await chrome.debugger.detach({ tabId: tab.id });
        data = `data:image/${message.format};base64,` + data;
        result.dataSize = data.length;
        console.log(`background.js: screenshot-finished result: ${JSON.stringify(result, null, 2)} `);
        await chrome.storage.session.set({ [`${SCREENSHOT_PREFIX}${message.testURL}`]: { data } });
        console.log(`background.js: screenshot saved as ${SCREENSHOT_PREFIX}${message.testURL}`);
        sendResponse(result);
      }
      catch (err) {
        if (tab) {
          await chrome.debugger.detach({ tabId: tab.id });
        }
        console.log(`background.js: screenshot-finished err: ${err.message} for ${message.url}`, err);
        await chrome.storage.session.remove(`${SCREENSHOT_PREFIX}${message.testURL}`);
        sendResponse({ type: 'screenshot-finished', err: err.message, stack: err.stack });
      }
    })();
    break;
  */
  case 'coverage':
    (async () => {
      //console.log(message);
      const randomUUID = (() => { // emulate crypto.randomUUID()
        const hex = Array.prototype.map.call(
          crypto.getRandomValues(new Uint16Array(8)),
          (v) => v.toString(16).padStart(4, '0'));
        return `${hex[0]}${hex[1]}-${hex[2]}-${hex[3]}-${hex[4]}-${hex[5]}${hex[6]}${hex[7]}`
      })();
      /*
        {
          "coverage-${RandomUUID}": [{},...],
          ...
        }
      */
      if (message.__coverage__) {
        await chrome.storage.local.set({ [`coverage-${randomUUID}`]: message.__coverage__ });
        // no need to send a response as the coverage has been sent on a beforeunload event of a page
      }
      else {
        const rawResult = await chrome.storage.local.get(null); // get all results in the local storage
        // merge all covarage data
        const result = [];
        const keys = [];
        for (let key in rawResult) {
          if (key.startsWith('coverage-')) { // filter out coverage data
            result.splice(result.length, 0, ...rawResult[key]);
            keys.push(key);
          }
        }
        // merge globalThis.__coverage__ of background.js itself
        if (globalThis.__coverage__) {
          result.push(globalThis.__coverage__);
        }

        // remove all stored coverage data in chrome.storage.local
        await chrome.storage.local.remove(keys);

        sendResponse({ type: 'coverage', __coverage__: result });
      }
    })();
    break;
  default:
    sendResponse({ type: 'unknown-message' });
    break;
  }
  return true;
});
