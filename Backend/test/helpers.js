const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

function load(relative, mocks = {}, env = {}) {
    const filename = path.resolve(__dirname, '..', relative);
    const realRequire = createRequire(filename);
    const context = {
        module: { exports: {} }, require: (key) => key in mocks ? mocks[key] : realRequire(key),
        process: { env }, console: { error() {}, log() {} }, Buffer, URL, Date, AbortSignal,
        fetch: mocks.fetch || globalThis.fetch, __dirname: path.dirname(filename),
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return context.module.exports;
}
function response() {
    return {
        statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        cookie(name, value, options) { this.cookies ??= {}; this.cookies[name] = { value, options }; return this; },
        clearCookie(name) { this.cleared = name; return this; },
        redirect(url) { this.location = url; return this; },
        set() { return this; },
    };
}
module.exports = { load, response };
