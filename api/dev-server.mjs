import { createServer } from 'node:http';
import { createBackendHandler, createRuntimeDependencies } from './_lib/router.js';

const handler = createBackendHandler(createRuntimeDependencies());

const server = createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error('Unhandled error in backend handler:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: 'Internal Server Error' }));
    }
  });
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on port ${port}`);
});
