import path from 'path';
import { fileURLToPath } from 'url';
import ReportageConfig from './test/reportage.config.js';
// TODO: support importedBy
//ReportageConfig.importedBy(import.meta.url);
//console.log(ReportageConfig);
import TestExclude from 'test-exclude';
import { createInstrumenter } from 'istanbul-lib-instrument';
const instrumenter = createInstrumenter(ReportageConfig.coverageOptions.createInstrumenterOptions);
const exclude = new TestExclude({...ReportageConfig.coverageOptions.testExcludeOptions, cwd: fileURLToPath(path.dirname(import.meta.url))});
const driverURL = new URL('driver.js', new URL('/node_modules/reportage/' /*ReportageConfig.reportagePackagePathOnReporter*/, ReportageConfig.reporterOrigin).href) + '#' + ReportageConfig.testConfigPathOnReporter;
const targetAppOrigins = {};
for (let origin of ReportageConfig.originGenerator()) {
  targetAppOrigins[origin] = true;
}

const Config = {
  // whether to open the browser and/or the browser path to open on
  open: false,
  // index HTML to use for SPA routing / history API fallback
  //appIndex: 'mocha.html',
  // run in watch mode, reloading when files change
  watch: false,
  // resolve bare module imports
  nodeResolve: true,
  // JS language target to compile down to using esbuild. Recommended value is "auto", which compiles based on user agent.
  //esbuildTarget: 'auto',
  // preserve symlinks when resolve imports, instead of following
  // symlinks to their original files
  preserveSymlinks: true,
  // the root directory to serve files from. this is useful in a monorepo
  // when executing commands from a package
  rootDir: fileURLToPath(path.dirname(import.meta.url)),
  // prefix to strip from request urls
  //basePath: string;
  /**
   * Whether to log debug messages.
   */
  //debug: true,

  // files to serve with a different mime type
  //mimeTypes: MimeTypeMappings,
  // middleware used by the server to modify requests/responses, for example to proxy
  // requests or rewrite urls
  //middleware: Middleware[],
  // plugins used by the server to serve or transform files
  get plugins() { return [
    {
      name: 'set-access-control-allow-origin-header',
      transform(context) {
        context.set('Access-Control-Allow-Origin', '*');
      }
    },
    ReportageConfig.coverageOptions.enabled ? {
      name: 'instrument-coverage',
      transform(context) {
        const filename = path.join(Config.rootDir, context.request.path);
        if (exclude.shouldInstrument(filename)) {
          const body = instrumenter.instrumentSync(context.body, filename);
          return { body: body, transformCache: true };
        }
      },
    } : undefined,
    /*
    {
      name: 'inject-test-driver-script',
      transform(context) {
        if (targetAppOrigins[context.request.origin] &&
            context.response.is('html') &&
            context.request.headers['sec-fetch-dest'] === 'document') { // TODO: Is this feasible?
          //console.log('injecting driver to ' + context.request.url);
          //console.log(`headers: `, context.request.headers);
          return { body: context.body.replace(/<\/head>/, 
           `<script type="module">
              try {
                await import("${driverURL}");
              }
              catch (e) {
                alert("import failed");
                location.reload();
              }
            </script>
            </head>`), transformCache: true };
        }
      },
    },
    */
  ]},

  // configuration for the server
  //protocol: string;
  //hostname: string;
  port: 3000,

  // whether to run the server with HTTP2
  http2: false,//true,
  // path to SSL key
  //sslKey: '../../keys/demoCA/local162.org.key',
  // path to SSL certificate
  //sslCert: '../../keys/demoCA/local162.org.crt',
};
export default Config;