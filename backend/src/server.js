const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const dataLoader = require('./services/dataLoader');

const PORT = env.PORT || 5000;

const startServer = async () => {
  // Bootstrap synthetic data into memory before accepting requests
  try {
    const counts = dataLoader.load();
    console.log(
      `[DataLoader] Loaded synthetic data: ${counts.sessions} sessions, ` +
      `${counts.customers} customers, ${counts.products} products`
    );
  } catch (err) {
    console.error('[DataLoader] Failed to load synthetic_data.json:', err.message);
    process.exit(1);
  }

  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Friction Detection Backend running in ${env.NODE_ENV} mode on port ${PORT}`);
    console.log(`[Server] Endpoints: GET /sessions/at-risk | GET /sessions/:id/friction | GET /dashboard/summary`);
  });
};


if (require.main === module) {
  startServer();
}

module.exports = startServer;
