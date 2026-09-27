// One process-wide event emitter, so a tab can react to another tab's work without
// importing it. garmin/service.js emits 'garmin:day' with today's bundle after every
// warm; health/ingest.js listens. Emit is wrapped by the emitter so a listener that
// throws never reaches the emitting code path.
const { EventEmitter } = require('events');

const bus = new EventEmitter();

// Same as bus.emit but a throwing listener is logged, not propagated. Async listeners
// own their rejections: wrap them in catch, the bus does not await them.
bus.announce = function announce(event, ...args) {
  try {
    return bus.emit(event, ...args);
  } catch (err) {
    console.error(`[bus] listener for ${event} threw:`, err && err.message ? err.message : err);
    return false;
  }
};

module.exports = bus;
