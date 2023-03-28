/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
/*
import {
  NAME_REPORTER,
  NAME_MEDIATOR,
  NAME_MEDIATOR_BRIDGE,

  TYPE_READY,
  TYPE_ERROR,
  TYPE_CONNECT,
  TYPE_DISCONNECT,
  TYPE_COVERAGE,
  TYPE_COLLECT_COVERAGE,
} from './mediator-constants.js';
*/
/* 
  Compatibility Note: Firefox implementation of worker modules is in progress:
    Implement worker modules https://bugzilla.mozilla.org/show_bug.cgi?id=1247687
    WIP: Bug 1247687 - Implement modules for shared workers https://phabricator.services.mozilla.com/D156103
*/

///*
const NAME_REPORTER = 'reporter';
const NAME_MEDIATOR = 'mediator';
const NAME_MEDIATOR_BRIDGE = 'mediator_bridge';

const TYPE_READY = 'ready';
const TYPE_ERROR = 'error';
const TYPE_CONNECT = 'connect';
const TYPE_DISCONNECT = 'disconnect';
const TYPE_COVERAGE = 'coverage';
const TYPE_COLLECT_COVERAGE = 'collectCoverage';
const TYPE_TRANSFER_PORT = 'transferMediatorPort';
//*/

const nameToPortMap = {};
const coverages = [];

onconnect = function (connectEvent) {
  console.log('connect', connectEvent);
  const clientPort0 = connectEvent.ports[0];

  clientPort0.addEventListener('message', function onPort0Message (event) {
    const { type } = event.data;
    if (type === TYPE_CONNECT) {
      const targetAppOrigin = event.data.targetAppOrigin;
      const bridgeName = NAME_MEDIATOR_BRIDGE + ':' + targetAppOrigin;
      nameToPortMap[bridgeName] = clientPort0;
      const channel = new MessageChannel();
      const clientPort = channel.port1;
      const transfer = [ channel.port2 ];

      clientPort.addEventListener('message', function onMessage (event) {
        const { type, source, target } = event.data;
        console.log(`message ${type} ${source} ${target}`, event);
        try {
          if (type === TYPE_READY) {
            if (typeof source === 'string' && source) {
              if (nameToPortMap[source] instanceof MessagePort) {
                if (clientPort !== nameToPortMap[source]) {
                  console.warn('ready: overwriging port for ' + source);
                  nameToPortMap[source] = clientPort;
                }
              }
              else {
                console.log('ready: registering port for ' + source);
                nameToPortMap[source] = clientPort;
              }
            }
            else {
              throw new Error('source is missing');
            }
          }
          else if (type === TYPE_DISCONNECT) {
            if (nameToPortMap[source] instanceof MessagePort) {
              if (clientPort === nameToPortMap[source]) {
                console.log('disconnect: source: ', source);
              }
              else {
                console.error('disconnect: another port was registered for ' + source);
                nameToPortMap[source].close();
              }
            }
            else {
              console.error('disconnect: the port is not registered for ' + source);
            }
            if (!event.data.coverageAvailable) {
              clientPort.close();
            }
            if (typeof source === 'string' && source) {
              delete nameToPortMap[source];
            }
          }
          else if (type === TYPE_COVERAGE) {
            clientPort.close();
          }
          else if (type === TYPE_COLLECT_COVERAGE) {
            if (globalThis.__coverage__) {
              coverages.push(globalThis.__coverage__);
              clientPort.postMessage({
                type: TYPE_COVERAGE,
                source: NAME_MEDIATOR,
                target: source,
                __coverage__: coverages,
              });
            }
          }
          if (typeof target === 'string' && target &&
              target !== NAME_MEDIATOR) {
            // inter-port routing
            let targetPort = nameToPortMap[target];
            if (targetPort instanceof MessagePort) {
              // forward the message to the target
              targetPort.postMessage(event.data, Array.isArray(event.data.transfer) ? event.data.transfer : undefined);
            }
            else {
              throw new Error('Target port not found: ' + target);
            }
          }
        }
        catch (error) {
          console.error(`${type}: source: ${source}, target: ${target} ${error.toString()}`, event);
          const { type: orgType, source: orgSource, target: orgTarget, ...orgData } = event.data;
          const data = {
            type: TYPE_ERROR,
            errorMessage: error.toString(),
            source: NAME_MEDIATOR,
            target: source,
            orgType,
            orgTarget,
            orgSource,
            ...orgData,
          };
          // send back an error message to the source
          clientPort.postMessage(data, Array.isArray(orgData.transfer) ? orgData.transfer : undefined);
        }
      });
      clientPort.start();
    
      clientPort0.postMessage({
        type: TYPE_TRANSFER_PORT,
        transfer: transfer,
      }, transfer);
    }
    else if (type === TYPE_COVERAGE) {
      if (Array.isArray(event.data.__coverage__)) {
        coverages.splice(coverages.length, 0, ...event.data.__coverage__);
      }
    }
  });
  clientPort0.start();

}
