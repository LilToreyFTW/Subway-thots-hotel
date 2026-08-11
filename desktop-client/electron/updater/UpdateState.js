const STATES = Object.freeze(['IDLE', 'CHECKING', 'UP_TO_DATE', 'AVAILABLE', 'DOWNLOADING', 'DOWNLOADED', 'INSTALLING', 'ERROR', 'OFFLINE']);
function makeState(state, extra = {}) { if (!STATES.includes(state)) throw new Error(`Invalid update state: ${state}`); return { state, progress: 0, transferred: 0, total: 0, ...extra }; }
module.exports = { STATES, makeState };
