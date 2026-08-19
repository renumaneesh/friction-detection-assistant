const morgan = require('morgan');

// Use standard morgan logger formatted for development/production
const loggerMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms');

module.exports = loggerMiddleware;
