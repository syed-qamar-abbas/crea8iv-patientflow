require('dotenv').config();

const http = require('http');
const app = require('./gatewayApp');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || undefined;
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  const address = HOST ? `${HOST}:${PORT}` : `port ${PORT}`;
  console.log(`PatientFlow Node gateway listening on ${address}`);
  console.log(`Health check: /api/v1/node-health`);
});
