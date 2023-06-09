/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/

import { dirname } from "path";
import { mkdir, stat } from "fs/promises";
import { EventEmitter } from "events";

let Config;
let enabled;
let pages;
let origins;
let screenshotCount;
let concurrency;
let taskQueue;
let serializeTasks;
let eventEmitter;
let handler;
let processing;
let logging;

async function onConfig({ Config: _Config }) {
  if (logging) console.log('onConfig');
  Config = _Config;
  enabled = Config.screenshotOptions &&
            Config.screenshotOptions.enabled &&
            Config.screenshotOptions.exposedFunction &&
            Config.screenshotOptions.options;
  if (!enabled) {
    return;
  }
  origins = {};
  for (let origin of Config.originGenerator()) {
    origins[origin] = true;
  }
  pages = new Map();
  screenshotCount = 0;
  concurrency = 0;
  taskQueue = [];
  processing = false;
  globalThis.takingScreenshots = async () => true;
  serializeTasks = !(Config.windowFeatures.split(',').findIndex((el) => el === 'popup') >= 0);
  logging = Config.screenshotOptions.logging || false;

  eventEmitter = new EventEmitter();

  eventEmitter.on('enqueued', handler = async () => {
    if (processing) {
      if (logging) console.log(`enqueued taskQueue.length = ${taskQueue.length}`);
      return;
    }
    processing = true;
    const MAX_RETRIES = Config.screenshotOptions.max_retries || 3;
    let task;
    while (task = taskQueue.shift()) {
      if (logging) console.log(`taking screenshot latency ${Date.now() - task.enqueued}ms taskQueue.length = ${taskQueue.length}`, task.arg.path);
      let stats;
      try {
        stats = await stat(dirname(task.arg.path));
      }
      catch (e) {
        stats = null;
      }
      if (!(stats && stats.isDirectory())) {
        await mkdir(dirname(task.arg.path), { recursive: true });
      }
      let retries = 0;
      const start = Date.now();
      while (retries <= MAX_RETRIES) {
        await task.page.bringToFront();
        let result = await Promise.race([
          task.page.screenshot(task.arg),
          new Promise(resolve => setTimeout(() => resolve('timeout'), Config.screenshotOptions.timeout || 1000))
        ]);
        if (result === 'timeout') {
          if (logging) console.log(`taking screenshot timed out`);
          retries++;
          continue;
        }
        else {
          if (logging) console.log(`taking screenshot succeeded`);
          break;
        }
      }
      const end = Date.now();
      if (logging) console.log(`taking screenshot done in ${end - start}ms taskQueue.length = ${taskQueue.length}`, task.arg.path);
      task.resolve(retries <= MAX_RETRIES ? 'done' : 'timeout');
    }
    processing = false;
  });
}

async function exposeFeature(target) {
  const page = await target.page();
  if (!page) {
    return;
  }
  if (!pages.get(page)) {
    if (logging) console.log('exposeFunction', page.url());
    page.exposeFunction(Config.screenshotOptions.exposedFunction, async (screenshotRequest) => {
      /*
        {
          type: 'screenshot',
          screenshotURL: screenshotURL,
        };
      */
      const { type, screenshotURL } = screenshotRequest;
      if (type !== 'screenshot') {
        return 'type is not screenshot';
      }
      let url = new URL(screenshotURL);
      if (url.origin !== Config.reporterOrigin) {
        return 'origin is not reporterOrigin';
      }
      screenshotCount++;
      concurrency++;
      let imagePath = '.' + url.pathname;
      let result;
      if (serializeTasks) {
        let resolve, reject;
        let promise = new Promise((_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        taskQueue.push({
          page,
          arg: {
            path: imagePath,
            ...Config.screenshotOptions.options
          },
          enqueued: Date.now(),
          resolve,
          reject,
        });
        eventEmitter.emit('enqueued');
        result = await promise;
      }
      else {
        /*
          For popup windows, no need to serialize screenshot taking
        */
        const start = Date.now();
        await page.bringToFront();
        await page.screenshot({
          path: imagePath,
          ...Config.screenshotOptions.options
        });
        result = 'done';
        const end = Date.now();
        if (logging) console.log(`taking screenshot done in ${end - start}ms concurrency = ${concurrency}`, imagePath);
      }
      concurrency--;
      return result;
    });
    pages.set(page, true);
  }
}

function onTargetCreated(target) {
  const url = new URL(target.url());
  if (origins[url.origin] && target.type() === 'page') {
    if (logging) console.log(`targetcreated`, url.origin);
    exposeFeature(target);
  }
}

function onTargetChanged(target) {
  const url = new URL(target.url());
  if (origins[url.origin] && target.type() === 'page') {
    if (logging) console.log(`targetchanged`, url.origin);
    exposeFeature(target);
  }
}

function onTargetDestroyed(target) {
  const url = new URL(target.url());
  if (origins[url.origin] && target.type() === 'page') {
    if (logging) console.log(`targetdestroyed`, url.origin);
  }
}

async function onReady({ Config, page, browser }) {
  if (!enabled) {
    return;
  }
  await page.exposeFunction('takingScreenshots', async () => true);
  browser.on('targetcreated', onTargetCreated);
  browser.on('targetchanged', onTargetChanged);
  browser.on('targetdestroyed', onTargetDestroyed);
}

async function onEnd({ Config, page, browser, event }) {
  if (!enabled) {
    return;
  }
  if (logging) console.log('onEnd');
  eventEmitter.off('enqueued', handler);
  pages = null;
  browser.off('targetcreated', onTargetCreated);
  browser.off('targetchanged', onTargetChanged);
  browser.off('targetdestroyed', onTargetDestroyed);
}

export { onConfig, onReady, onEnd };
