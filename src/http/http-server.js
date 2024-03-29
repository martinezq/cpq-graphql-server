const fs = require('fs');
const express = require('express');
const session = require('express-session');


const frontServer = require('../front/apollo-server');
const adminServer = require('../admin/apollo-server');
const promoServer = require('../promo/apollo-server');

// ----------------------------------------------------------------------------

async function startHttpServer(port) {
    const app = express();

    const httpServer = app.listen(port, async () => {
        const host = httpServer.address().host || 'localhost';
        const port = httpServer.address().port;

        const frontRouter = express.Router();
        const adminRouter = express.Router();
        // const promoRouter = express.Router();

        frontRouter.use(async (req, res, next) => frontServer.handlePath(req, res, next, app));
        adminRouter.use(async (req, res, next) => adminServer.handlePath(req, res, next, app));
        // promoRouter.use(async (req, res, next) => promoServer.handlePath(req, res, next, app));
        
        app.use(express.static('public'))

        // session

        const sess = {
            secret: 'keyboard cat',
            cookie: {}
        }
        
        if (app.get('env') === 'production') {
            app.set('trust proxy', 1) // trust first proxy
            sess.cookie.secure = true // serve secure cookies
        }
        
        // app.use(session(sess));

        // routes

        app.use('/front', frontRouter);
        app.use('/admin', adminRouter);
        // app.use('/promo', promoRouter);

        console.log(`🚀 Server ready at http://${host}:${port}`);
    });
}



module.exports = {
    startHttpServer
}