#!/usr/bin/env node
/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import puppeteer from 'puppeteer';
//import { KnownDevices } from 'puppeteer';
import Mocha from 'mocha';
import { reporterInstaller } from './proxy-reporter.js';
import path from 'path';
import fs from 'fs';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import libCoverage from 'istanbul-lib-coverage';

const argv = yargs(hideBin(process.argv))
  .boolean([ 'p', 'persist' ]) // TODO: not implemented yet
  .default({ 'nyc-config': './nyc.config.mjs' })
  .argv;

if (argv._.length == 0) {
  argv._.push('test/reportage.config.js');
}
const { default: nycConfig } = await import(argv['nyc-config']);
const imports = [];
const _noop = async () => {};
if (argv['import']) {
  for (let mod of Array.isArray(argv['import']) ? argv['import'] : [ argv['import'] ]) {
    /* 
      const { onConfig, onReady, onMochaEvent, onEnd } = await import(mod);
      async onConfig({ Config });
      async onReady({ Config, page, browser });
      onMochaEvent({ Config, page, browser, event });
      async onEnd({ Config, page, browser, event });
    */
    imports.push(await import(mod));
  }
}
//console.log(`argv: ${JSON.stringify(argv, null, 2)}`);

let mergedCoverageMap;

const mergeCoverage = function mergeCoverage(endEvent, Config) {
  if (Config &&
      Config.coverageOptions &&
      Config.coverageOptions.enabled &&
      endEvent &&
      endEvent.detail &&
      endEvent.detail.arg &&
      Array.isArray(endEvent.detail.arg.__coverage__) &&
      endEvent.detail.arg.__coverage__.length > 0) {
    if (!mergedCoverageMap) {
      mergedCoverageMap = libCoverage.createCoverageMap({});
    }
    for (let cov of endEvent.detail.arg.__coverage__) {
      mergedCoverageMap.merge(cov);
    }
  }
  else if (!endEvent && mergedCoverageMap) {
    if (globalThis.__coverage__) {
      mergedCoverageMap.merge(globalThis.__coverage__);
    }
    if (nycConfig['temp-dir']) {
      fs.mkdirSync(path.resolve(process.cwd(), nycConfig['temp-dir']), { recursive: true });
      fs.writeFileSync(path.resolve(process.cwd(), nycConfig['temp-dir'], 'out.json'), JSON.stringify(mergedCoverageMap.toJSON(), null, 2));
    }
  }
}

for (let configPath of argv._) {
  //console.log(`configPath: ${configPath}`);
  const { default: Config } = await import(
    configPath.startsWith('/')
      ? configPath
      : path.join(process.cwd(), configPath)
  );
  await Config.importedBy(import.meta.url);
  for (const mod of imports) {
    await (mod.onConfig || _noop)({ Config });
  }
  
  const reporterURL = Config.reporterURL;
  //console.log('reporterURL', reporterURL);

  let reporterType;
  if (Mocha.reporters[Config.consoleReporter]) {
    reporterType = Mocha.reporters[Config.consoleReporter];
  }
  else {
    const { default: _reporterType } = await import(Config.consoleReporter);
    reporterType = _reporterType;
  }
  const { ReceiverRunner } = reporterInstaller(Mocha, Config);
  
  let browser = await puppeteer.launch(Config.puppeteerLaunchOptions);
  let page = await browser.newPage();
  //page.emulate(KnownDevices['Pixel 4']);
  await browser.waitForTarget(target => target.type() === 'service_worker'); // wait for extension
  
  const receiverRunner = new ReceiverRunner(reporterType);
  receiverRunner.onOpen({ runner: { total: 0, stats: { } }, options: { reporterOptions: Config.consoleReporterOptions } });
  let reportEnded;
  const waitForReporter = new Promise(resolve => {
    reportEnded = (endEvent) => {
      mergeCoverage(endEvent, Config);
      resolve(endEvent);
    };
  });
  
  await page.exposeFunction('onMochaEvent', event => {
    //console.log(event.detail);
    for (const mod of imports) {
      (mod.onMochaEvent || _noop)({ Config, page, browser, event });
    }
    receiverRunner.onMochaEvent(event.detail);
    if (event.detail.type === 'end') {
      reportEnded(event);
    }
  });
  
  await page.evaluateOnNewDocument((new Function(`return () => {
    document.addEventListener('mocha-event', event => {
      window.onMochaEvent({type: 'mocha-event', detail: event.detail});
    });
  }`))(), 'mocha-event');
  
  await page.goto(reporterURL, {
    waitUntil: 'networkidle0',
  });
  
  await page.evaluate((new Function(`return async () => {
    if (window.Dispatcher && window.Dispatcher.isReady) {
      return true;
    }
    else {
      await new Promise((resolve, reject) => {
        window.addEventListener('dispatcher-ready', (event) => {
          resolve(true);
        });
        setTimeout(() => { reject() }, 5000);
      });
    }
  }`))());

  for (const mod of imports) {
    await (mod.onReady || _noop)({ Config, page, browser });
  }
  
  await page.evaluate((new Function(`return async () => {
    document.querySelector('#start-button').click();
  }`))());
  
  const endEvent = await waitForReporter;
  for (const mod of imports) {
    await (mod.onEnd || _noop)({ Config, page, browser, event: endEvent });
  }

  await browser.close();
}

mergeCoverage(null);
