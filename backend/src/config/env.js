const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/friction_detection',
  TIER1_CONFIDENCE_THRESHOLD: parseFloat(process.env.TIER1_CONFIDENCE_THRESHOLD || '0.75'),
  HIGH_RISK_CART_VALUE_THRESHOLD: parseFloat(process.env.HIGH_RISK_CART_VALUE_THRESHOLD || '100'),
  TIME_ON_PAGE_THRESHOLD_MS: parseInt(process.env.TIME_ON_PAGE_THRESHOLD_MS || '120000', 10),
  CART_ABANDONMENT_TIMEOUT_MS: parseInt(process.env.CART_ABANDONMENT_TIMEOUT_MS || '1200000', 10),
  MAX_FAILED_PAYMENT_ATTEMPTS: parseInt(process.env.MAX_FAILED_PAYMENT_ATTEMPTS || '2', 10),
};
