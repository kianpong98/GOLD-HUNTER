// Backward-compatible Admin endpoint.
// Older cached admin.js versions POST here; route all methods to the same
// News Engine v10.2 single-source handlers used by /api/market-events.
export { onRequestOptions, onRequestGet, onRequestPost } from './data-engine.js';
