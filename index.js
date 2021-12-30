const server = require('./src/http/http-server.js');

server.startHttpServer(process.env.PORT || 4000);