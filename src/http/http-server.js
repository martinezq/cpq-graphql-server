const fs = require('fs');
const express = require('express');

const frontServer = require('../front/apollo-server');
const adminServer = require('../admin/apollo-server');

// ----------------------------------------------------------------------------

async function startHttpServer(port) {
    const app = express();

    const httpServer = app.listen(port, async () => {
        const host = httpServer.address().host || 'localhost';
        const port = httpServer.address().port;

        const frontRouter = express.Router();
        const adminRouter = express.Router();

        frontRouter.use(async (req, res, next) => frontServer.handlePath(req, res, next, app));
        adminRouter.use(async (req, res, next) => adminServer.handlePath(req, res, next, app));
        
        app.use('/front', frontRouter);
        app.use('/admin', adminRouter);

        console.log(`🚀 Server ready at http://${host}:${port}`);
    });
}



module.exports = {
    startHttpServer
}