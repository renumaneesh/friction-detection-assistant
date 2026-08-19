const express = require('express');
const cors = require('cors');
const loggerMiddleware = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const eventsRoutes = require('./routes/events.routes');
const frictionRoutes = require('./routes/friction.routes');
const insightsRoutes = require('./routes/insights.routes');
const automationRoutes = require('./routes/automation.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const apiDocs = require('../docs/openapi.json');

const app = express();

// Core Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'friction-detection-backend',
  });
});

// API Documentation Endpoint
app.get('/api/docs', (req, res) => {
  res.json(apiDocs);
});

// Mount Feature API Routes
app.use('/api', eventsRoutes);
app.use('/api', frictionRoutes);
app.use('/api', insightsRoutes);
app.use('/api', automationRoutes);
// New session pipeline routes (synthetic data -> tier1 -> Gemini)
app.use('/', sessionsRoutes);

// 404 Handler for unhandled routes
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
