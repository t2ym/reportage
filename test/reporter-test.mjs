/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/

let targeted = false;

async function onConfig({ Config }) {
  targeted = Config.configURL.endsWith('/reportage/test/single/reportage.config.js');
}

async function onReady({ Config, page, browser }) {
  if (targeted) {
    await page.evaluate(async () => {
      const scopeSelect = document.getElementById('scope');
      const testClassSelect = document.getElementById('test-class');
      const startButton = document.getElementById('start-button');
      scopeSelect.value = 'single';
      scopeSelect.dispatchEvent(new Event('change'));
      await new Promise(resolve => {
        const intervalId = setInterval(() => {
          if (testClassSelect.children.length > 1) {
            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      });
      testClassSelect.value = '0,SingleTest';
      testClassSelect.dispatchEvent(new Event('change'));
      scopeSelect.value = '';
      scopeSelect.dispatchEvent(new Event('change'));
      await new Promise(resolve => {
        const intervalId = setInterval(() => {
          if (testClassSelect.children.length === 1) {
            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      });
      location.href = '#/test/single/reportage.config.js?scope=single';
      await new Promise(resolve => {
        const intervalId = setInterval(() => {
          if (testClassSelect.value === '') {
            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      });
      /*
      location.href = '#/test/single/reportage.config.js';
      await new Promise(resolve => {
        const intervalId = setInterval(() => {
          if (scopeSelect.value === '') {
            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      });
      */
    });
  }
}

export { onConfig, onReady };