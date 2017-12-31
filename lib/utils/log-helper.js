'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dummyLog = undefined;

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const dummyLog = exports.dummyLog = {
  info: _sinon2.default.spy(Function.prototype),
  error: _sinon2.default.spy(Function.prototype),
  debug: _sinon2.default.spy(Function.prototype),
  warn: _sinon2.default.spy(Function.prototype)
};
//# sourceMappingURL=log-helper.js.map