/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import { Config, chai, assert } from "./common-suite.js";
import Suite from "./basic-suite.js";
// extended scope
let scope = 'extended';
let extended = new Suite(scope, 'Description of Extended Suite');
extended.htmlSuite = '/';
let CommonSuite;
extended.test = CommonSuite = Suite.scopes.common.classes.CommonSuite;
// test class mixin in "extended" scope
extended.test = Suite.scopes.basic.mixins.WaitForRendering;
extended.test = Suite.scopes.basic.mixins.InitialCountIs0;
extended.test = Suite.scopes.basic.mixins.IncrementCount;
extended.test = Suite.scopes.basic.mixins.ViteNavi;
extended.test = Suite.scopes.basic.mixins.LitNavi;
extended.test = Suite.scopes.basic.mixins.HomeNavi;

// scenarios
extended.test = {
  // test class mixins
  '': [
    {
      ViteNavi: {
        HomeNavi: {
          WaitForRendering: 'ViteAndHome',
        }
      },
      LitNavi: {
        HomeNavi: {
          WaitForRendering: 'LitAndHome',
        }
      },
    },
  ],
  // test classes
  CommonSuite: {
    WaitForRendering: {
      InitialCountIs0: [
        Suite.permute([ 'IncrementCount', 'IncrementCount', 'ViteAndHome', 'LitAndHome' ], (scenario) => ({
          IncrementCount: 'Test_' + scenario.map(v => v.substring(0, 3)).join('_') + '_Inc' + '; ' + scenario.map(v => v.substring(0, 3)).join(' ') + ' Inc'
        })),
      ]
    },
  },
};

export default Suite;
