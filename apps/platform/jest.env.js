/**
 * Jest environment: jsdom + Node 18+ Request/Response/fetch/Headers
 * so Next.js API route tests and next/server can load.
 */
const JSDOMEnvironment = require("jest-environment-jsdom").default;

module.exports = class CustomJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    const nodeGlobal = typeof globalThis !== "undefined" ? globalThis : global;
    if (typeof nodeGlobal.Request !== "undefined") {
      this.global.Request = nodeGlobal.Request;
      this.global.Response = nodeGlobal.Response;
      this.global.Headers = nodeGlobal.Headers;
      this.global.fetch = nodeGlobal.fetch;
    }
  }
};
