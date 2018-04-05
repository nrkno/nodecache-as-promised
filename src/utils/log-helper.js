import sinon from 'sinon';

export const dummyLog = {
  info: sinon.spy(Function.prototype),
  error: sinon.spy(Function.prototype),
  debug: sinon.spy(Function.prototype),
  warn: sinon.spy(Function.prototype)
};
