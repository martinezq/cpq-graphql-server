const fs = require('fs');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');

const cpq = require('../client/cpq-env-client');
const schema = require('./schema-generator');
const resolver = require('./resolver-generator');

let routes = {};

// ----------------------------------------------------------------------------

async function startHttpServer(port) {
    const app = express();

    const httpServer = app.listen(port, async () => {
        const host = httpServer.address().host || 'localhost';
        const port = httpServer.address().port;

        app.use(async (req, res, next) => handlePath(req, res, next, app));
        
        console.log(`🚀 Server ready at http://${host}:${port}`);
    });
}

async function handlePath(req, res, next, app) {
    const path = req.path;

    if (routes[path]) {
        // console.log('FOUND apollo server for', path);

        if (routes[path].state === 'init' && req.headers.authorization) {

            routes[path].state = 'fetching';
            const context = routes[path].context;

            try {
                const serverParams = await generateSchemaAndResolvers({ ...context, headers: req.headers });

                const server = await createApolloServer(path, serverParams.schema, serverParams.resolvers);
            
                await replaceApolloServer(server, path);
                console.log('RECREATED apollo server for', path);

                routes[path].state = 'ready';
            } catch (e) {
                console.log(e);
                routes[path].state = 'error';

                setTimeout(() => routes[path].state = 'init', 5000);
            }
        };

        routes[path].router(req, res, next);

    } else {
        console.log('NOT FOUND apollo server for', path, ', starting...');

        const server = await createInitialApolloServer(path);
        await registerApolloServer(server, path);

        console.log('STARTED apollo server under', path)
        
        const router = routes[path].router;
        router(req, res, next);
    }
}

async function generateSchemaAndResolvers(context) {
    console.log('LOADING schema from', context.baseurl);

    const resp = await cpq.describe(context);
    const structure = schema.parseResponse(resp);

    return {
        schema: await schema.generateSchema(structure),
        resolvers: await resolver.generateResolvers(structure)
    }
}

async function registerApolloServer(server, path) {
    await server.start();
    
    const router = express.Router();

    await server.applyMiddleware({ app: router, path });
    routes[path] = { router, server, state: 'init', context: { baseurl: `https:/${path}`} };

    return server;
}

async function replaceApolloServer(server, path) {
    const oldRoute = routes[path];
    await oldRoute.server.stop();
    
    return registerApolloServer(server, path);
}

async function createInitialApolloServer(path) {
    const typeDefs = 'type Query { status: String, _a: String }'
    const resolvers = {
        Query: {
            status: () => routes[path].state
        }
    };
    return createApolloServer(path, typeDefs, resolvers);
}

async function createApolloServer(path, typeDefs, resolvers) {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => ({
            baseurl: `https:/${path}`,
            headers: {
                authorization: req.headers.authorization
            }
        })
    });

    return Promise.resolve(server);
}

module.exports = {
    startHttpServer
}