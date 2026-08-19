/**
 * dataLoader.js
 * -------------
 * Loads backend/data_generation/output/synthetic_data.json into in-memory
 * maps on server startup. Provides lookup helpers for sessions, customers,
 * and products by ID.
 *
 * JSON structure (from generate_synthetic_data.py):
 *   { customers: [{id,name,email,created_at}], products: [{id,name,category,price}],
 *     sessions: [{id,customer_id,started_at,ended_at,device_type,events:[],feedback}] }
 *
 * Each event: { id, session_id, event_type, timestamp, metadata }
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(
  __dirname,
  '../../data_generation/output/synthetic_data.json'
);

// In-memory stores (populated on load())
const _store = {
  customers: new Map(), // id -> customer object
  products: new Map(),  // id -> product object
  sessions: [],         // array of session objects (order preserved)
  sessionMap: new Map(),// id -> session object
  loaded: false,
};

/**
 * Load the JSON file into memory. Idempotent — safe to call multiple times.
 * @returns {{ sessions: number, customers: number, products: number }}
 */
function load() {
  if (_store.loaded) {
    return {
      sessions: _store.sessions.length,
      customers: _store.customers.size,
      products: _store.products.size,
    };
  }

  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  for (const c of data.customers || []) {
    _store.customers.set(c.id, c);
  }
  for (const p of data.products || []) {
    _store.products.set(p.id, p);
  }
  for (const s of data.sessions || []) {
    _store.sessions.push(s);
    _store.sessionMap.set(s.id, s);
  }
  _store.loaded = true;

  return {
    sessions: _store.sessions.length,
    customers: _store.customers.size,
    products: _store.products.size,
  };
}

/** Return a copy of all sessions (do not mutate the returned array) */
function getAllSessions() {
  return _store.sessions;
}

/** Return a session by ID, or undefined */
function getSessionById(id) {
  return _store.sessionMap.get(id);
}

/** Return a customer by ID, or undefined */
function getCustomerById(id) {
  return _store.customers.get(id);
}

/** Return a product by ID, or undefined */
function getProductById(id) {
  return _store.products.get(id);
}

/**
 * Derive the primary product for a session.
 * Uses the first product_id seen in event metadata; falls back to a generic placeholder.
 */
function deriveSessionProduct(session) {
  for (const ev of session.events || []) {
    const pid = ev.metadata && ev.metadata.product_id;
    if (pid) {
      const product = _store.products.get(pid);
      if (product) return product;
    }
  }
  return { name: 'Unknown Product', category: 'Unknown', price: 0 };
}

/**
 * Derive cart_value for a session.
 * Uses the `amount` field from the first payment_attempt or cart_add metadata.
 * Falls back to product.price * quantity.
 */
function deriveCartValue(session, product) {
  for (const ev of session.events || []) {
    if (ev.event_type === 'payment_attempt' && ev.metadata && ev.metadata.amount) {
      return parseFloat(ev.metadata.amount) || 0;
    }
  }
  // Derive from cart_add events
  for (const ev of session.events || []) {
    if (ev.event_type === 'cart_add' && ev.metadata) {
      const qty = ev.metadata.quantity || 1;
      return (product.price || 0) * qty;
    }
  }
  return product.price || 0;
}

/**
 * Adapt a synthetic data session's events into the shape that tier1Detection.js
 * expects: { eventType (camelCase), metadata (with camelCase keys) }
 *
 * Mapping rules (glue code — keeps both modules' internals unchanged):
 *   event_type  -> eventType (camelCase)
 *   cart_add    -> add_to_cart        (tier1 looks for 'add_to_cart')
 *   payment_fail -> payment_failed    (tier1 looks for 'payment_failed')
 *   metadata.error_code -> metadata.paymentErrorCode
 */
function adaptEventsForTier1(rawEvents) {
  return (rawEvents || []).map((ev) => {
    let eventType = ev.event_type;

    if (eventType === 'cart_add')     eventType = 'add_to_cart';
    if (eventType === 'payment_fail') eventType = 'payment_failed';

    const metadata = { ...(ev.metadata || {}) };
    if (metadata.error_code) {
      metadata.paymentErrorCode = metadata.error_code;
    }

    return { ...ev, eventType, metadata };
  });
}

module.exports = {
  load,
  getAllSessions,
  getSessionById,
  getCustomerById,
  getProductById,
  deriveSessionProduct,
  deriveCartValue,
  adaptEventsForTier1,
};
