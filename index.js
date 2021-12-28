const server = require('./src/init/server');

// ----------------------------------------------------------------------------

server.startHttpServer(process.env.PORT || 4000);