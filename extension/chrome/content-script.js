/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
//console.log(`[content-script.js] starting for url: ${location.href}`);
chrome.runtime.sendMessage(
  {
    type: 'navigation',
    url: location.href,
    timestamp: Date.now(),
  },
  (response) => {
    //console.log(`[content-script.js] stored navigation`, response);
  }
);

window.addEventListener('cleanup', (event) => {
  //console.log(`cleanup`, event);
  /*
    event.detail = {
      removalOptions: {
        since: 0,
        origins: [ 'http://host:port' ],
      },
      dataToRemove: { // on each window.open(targetAppOrigin)
        // filterable by origins/hostnames
        cookies: true, // The browser's cookies.
        //cache: true, // The browser's cache.
        fileSystems: true, // Websites' file systems.; not on Firefox
        indexedDB: true, // Websites' IndexedDB data.
        localStorage: true, // Websites' local storage data.
        cacheStorage: true, // Cache storage
        serviceWorkers: true, // Service Workers.
        webSQL: false, // [DEPRECATED FEATURE] Websites' WebSQL data.
        // not supported in the browsingData.remove() API
        //sessionStorage: true, // sessionStorage is empty on window.optn()
      },
    };
  */
  chrome.runtime.sendMessage(
    {
      type: 'cleanup',
      parameters: event.detail,
    },
    (response) => {
      //console.log(`[content-script.js] cleanup finished`, response);
      window.dispatchEvent(new CustomEvent('cleanup-finished', { detail: response }));
    }
  );
});

let injectionParameters;

window.addEventListener('setup-injection', (event) => {
  //console.log(`setup-injection`, event);
  /*
    event.detail = {
      origins: origins,
      driverURL: driverURL,
      targetPathPattern: '^\/[^/]*[.]html',
    };
  */
  injectionParameters = event.detail;
  chrome.runtime.sendMessage(
    {
      type: 'setup-injection',
      injectionParameters: injectionParameters,
    },
    (response) => {
      //console.log(`[content-script.js] setup injection finished`, response);
      window.dispatchEvent(new CustomEvent('setup-injection-finished', { detail: response }));
    }
  );
});

window.addEventListener('get-navigation', (event) => {
  //console.log(`get-navigation`, event);
  /*
    event.detail = {
      origin: origin,
    };
  */
  const origin = event.detail.origin;
  chrome.runtime.sendMessage(
    {
      type: 'get-navigation',
      origin: origin,
    },
    (response) => {
      //console.log(`[content-script.js] get navigation finished`, response);
      window.dispatchEvent(new CustomEvent('get-navigation-finished', { detail: response }));
    }
  );
});

window.addEventListener('clear-navigation', (event) => {
  //console.log(`clear-navigation`, event);
  /*
    event.detail = {
      origin: origin,
    };
  */
  const origin = event.detail.origin;
  chrome.runtime.sendMessage(
    {
      type: 'clear-navigation',
      origin: origin,
    },
    (response) => {
      //console.log(`[content-script.js] clear navigation finished`, response);
      window.dispatchEvent(new CustomEvent('clear-navigation-finished', { detail: response }));
    }
  );
});

/*
window.addEventListener('screenshot', async (event) => {
  //console.log(`screenshot`, event);

  chrome.runtime.sendMessage(
    {
      type: 'screenshot',
      ...event.detail
    },
    (response) => {
      window.dispatchEvent(new CustomEvent('screenshot-finished', { detail: response }));
    }
  );
});
*/

window.addEventListener('load', async (event) => {
  let success = false;
  do {
    try {
      let response = await chrome.runtime.sendMessage({ type: 'get-injection-parameters' });
      if (response) {
        injectionParameters = response.injectionParameters;
        if (injectionParameters &&
            typeof injectionParameters.targetPathPattern === 'string') {
          //console.log(`[content-script.js] injection-parameters`, response);
          injectionParameters.targetPathPattern = new RegExp(injectionParameters.targetPathPattern);
        }
        if (injectionParameters) {
          if (injectionParameters.origins &&
              injectionParameters.origins[location.origin]) {
            if (injectionParameters.targetPathPattern instanceof RegExp &&
                injectionParameters.targetPathPattern.exec(location.pathname)) {
              //console.log(`[content-script.js] injection: ${location.href} \n ${injectionParameters.driverURL}`);
              let script = document.createElement('script');
              script.type = 'module';
              script.src = injectionParameters.driverURL;
              script.addEventListener('load', (event) => {
                //console.log(`[content-script.js] injected script load event`, event);
              });
              script.addEventListener('error', (event) => {
                console.error(`[content-script.js] injected script error event`, event);
                setTimeout(() => history.go(), 100); // reload on error
              });
              document.head.appendChild(script);
            }
          }
          success = true;
        }
      }
      else {
        throw new Error(`response is empty in get-injection-parameters`);
      }
    }
    catch (e) {
      console.error(e);
    }
    if (!success) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } 
  }
  while (!success);
});

window.addEventListener('beforeunload', async (event) => {
  const cov = [];
  if (globalThis.__coverage__) {
    cov.push(globalThis.__coverage__);
    chrome.runtime.sendMessage({ type: 'coverage', __coverage__: cov });
  }
});
window.addEventListener('collect-coverage', async (event) => {
  chrome.runtime.sendMessage({ type: 'coverage' })
    .then(response => {
      //console.log(`response`, JSON.stringify(response));
      if (globalThis.__coverage__) {
        response.__coverage__.push(globalThis.__coverage__);
      }
      window.dispatchEvent(new CustomEvent('coverage', { detail: response.__coverage__ }));
    });
});
