const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');

const PORT = env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Friction Detection Backend running in ${env.NODE_ENV} mode on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = startServer;
