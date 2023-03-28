//const babelConfig = require('@istanbuljs/nyc-config-babel');

export default {
  //...babelConfig,
  "temp-dir": "./.nyc_output",

  "all": true,

  "include": [
    "**/*.js",
  ],
  //"exclude": default 
  "report-dir": "coverage",
  "watermarks": {
    "statements": [ 50, 80 ],
    "functions": [ 50, 80 ],
    "branches": [ 50, 80 ],
    "lines": [ 50, 80 ],
  },
  "reporter": [ "html", "text", "lcov" ],

  "check-coverage": true,
  "branches": 80,
  "lines": 80,
  "functions": 80,
  "statements": 80,
};
