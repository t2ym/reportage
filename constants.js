/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
export const NAME_REPORTER = 'reporter';
export const NAME_MEDIATOR = 'mediator';
export const NAME_MEDIATOR_BRIDGE = 'mediator_bridge';

// message types
export const TYPE_READY = 'ready'; // page/reporter -> mediator -> reporter
export const TYPE_ERROR = 'error';
export const TYPE_CONNECT = 'connect'; // mediator_bridge -> mediator
export const TYPE_DISCONNECT = 'disconnect'; // page -> mediator
export const TYPE_TRANSFER_PORT = 'transferMediatorPort'; // mediator_bridge -> page
export const TYPE_REQUEST_SESSION = 'requestSession'; // reporter -> page
export const TYPE_START_SESSION = 'startSession'; // page -> reporter
export const TYPE_END_SESSION = 'endSession'; // page -> reporter
export const TYPE_NAVIGATE = 'navigate'; // reporter -> page
export const TYPE_NAVIGATING = 'navigating'; // page -> reporter
export const TYPE_CLOSING = 'closing'; // page -> reporter
export const TYPE_CLOSE = 'closeWindow'; // reporter -> page
export const TYPE_COVERAGE = 'coverage'; // page -> reporter
export const TYPE_COLLECT_COVERAGE = 'collectCoverage';
export const TYPE_DETACH = 'detach'; // reporter -> mediator_bridge

// navigation types
// location
export const NAVI_LOCATION_HREF = 'location.href';
export const NAVI_LOCATION_RELOAD = 'location.reload';
export const NAVI_LOCATION_REPLACE = 'location.replace';
export const NAVI_LOCATION_ASSIGN = 'location.assign';
// history
export const NAVI_HISTORY_GO = 'history.go';
export const NAVI_HISTORY_BACK = 'history.back';
export const NAVI_HISTORY_FORWARD = 'history.forward';
export const NAVI_HISTORY_REPLACE = 'history.replaceState';
export const NAVI_HISTORY_PUSH = 'history.pushState';
// click link or programmatic
export const NAVI_DEFERRED = 'navi.deferred';
// window
export const NAVI_WINDOW_OPEN = 'window.open';

// dispatcher states
export const DISPATCHER_STATE_CLOSED = 'DispatcherState:closed';
export const DISPATCHER_STATE_NAVIGATING0 = 'DispatcherState:navigating0';
export const DISPATCHER_STATE_NAVIGATING1 = 'DispatcherState:navigating1';
export const DISPATCHER_STATE_READY0 = 'DispatcherState:ready0';
export const DISPATCHER_STATE_READY1 = 'DispatcherState:ready1';
export const DISPATCHER_STATE_STARTING0 = 'DispatcherState:starting0';
export const DISPATCHER_STATE_STARTING1 = 'DispatcherState:starting1';
export const DISPATCHER_STATE_RUNNING = 'DispatcherState:running';
export const DISPATCHER_STATE_STOPPED = 'DispatcherState:stopped';
export const DISPATCHER_STATE_CLOSING = 'DispatcherState:closing';
export const DISPATCHER_STATE_ERROR = 'DispatcherState:error';

// driver states
export const DRIVER_STATE_CLOSED = 'DriverState:closed';
export const DRIVER_STATE_LOADING = 'DriverState:loading';
export const DRIVER_STATE_DISCONNECTED = 'DriverState:disconnected';
export const DRIVER_STATE_CONNECTING = 'DriverState:connecting';
export const DRIVER_STATE_CONNECTED = 'DriverState:connected';
export const DRIVER_STATE_READY = 'DriverState:ready';
export const DRIVER_STATE_STARTING0 = 'DriverState:starting0';
export const DRIVER_STATE_RUNNING = 'DriverState:running';
export const DRIVER_STATE_STOPPING = 'DriverState:stopping';
export const DRIVER_STATE_STOPPED = 'DriverState:stopped';
export const DRIVER_STATE_ABORTING = 'DriverState:aborting';
export const DRIVER_STATE_CLOSING0 = 'DriverState:closing0';
export const DRIVER_STATE_CLOSING1 = 'DriverState:closing1';
export const DRIVER_STATE_CLOSING2 = 'DriverState:closing2';
export const DRIVER_STATE_NAVIGATING0 = 'DriverState:navigating0';
export const DRIVER_STATE_NAVIGATING1 = 'DriverState:navigating1';
export const DRIVER_STATE_NAVIGATING2 = 'DriverState:navigating2';
export const DRIVER_STATE_NAVIGATING3 = 'DriverState:navigating3';
export const DRIVER_STATE_BEFOREUNLOAD = 'DriverState:beforeunload';
export const DRIVER_STATE_UNLOADING = 'DriverState:unloading';
export const DRIVER_STATE_ERROR = 'DriverState:error';

export const SESSION_STORAGE_DRIVER_NAVIGATING = 'SessionStorage:driver:navigating';

// session phase states
export const SESSION_PHASE_STATE_INITIAL = 'SessionPhase:initial';
export const SESSION_PHASE_STATE_CONTINUING = 'SessionPhase:continuing';
export const SESSION_PHASE_STATE_FINAL = 'SessionPhase:final';

// pseudo mocha events
export const AGGREGATION_EVENT_PHASE_CONTINUING = 'Phase:continuing';
export const AGGREGATION_EVENT_PHASE_FINAL = 'Phase:final';
export const AGGREGATION_EVENT_SCOPE_CONTINUING = 'Scope:continuing';
export const AGGREGATION_EVENT_SCOPE_FINAL = 'Scope:final';
export const AGGREGATION_EVENT_RUN_CONTINUING = 'Run:continuing';
export const AGGREGATION_EVENT_RUN_FINAL = 'Run:final';

// test ui types
export const TEST_UI_SCENARIST = 'scenarist';
//export const TEST_UI_BDD = 'bdd'; // not implemented (low priority)
//export const TEST_UI_TDD = 'tdd'; // not implemented (low priority)

// scenarist html suite constants
export const SUITE_HTML = 'htmlSuite';
export const SUITE_COMMON = '*';
