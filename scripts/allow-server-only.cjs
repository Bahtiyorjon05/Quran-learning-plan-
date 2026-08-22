/**
 * Lets one-off scripts import modules marked `server-only`.
 *
 * That package exists to fail the build if server code is pulled into a client
 * bundle. A CLI script is neither, so it throws for no good reason — this maps
 * it to an empty module. Preloaded with --require; it never reaches the app.
 */
const Module = require("node:module");
const load = Module._load;

Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return load.call(this, request, ...rest);
};
