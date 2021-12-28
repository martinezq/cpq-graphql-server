const fs = require('fs');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');

const { generateSchema } = require('./schema-generator');

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

        if (routes[path].state === 'init' && req.headers.baseurl) {

            const typeDefs = 'type Query { status: String }'
            const resolvers = {
                Query: {
                    status: () => 'ready'
                }
            };

            routes[path].state = 'fetching';

            try {
                const schema = await generateSchema(`https:/${path}`, req.headers);

                const typeDefsMerged = typeDefs + '\n' + schema;

                const server = await createApolloServer(path, typeDefsMerged, resolvers);
            
                await replaceApolloServer(server, app, path);
                console.log('RECREATED apollo server for', path);

                routes[path].state = 'ready';
            } catch (e) {
                console.log(e);
                routes[path].state = 'error';
            }
        };

        routes[path].router(req, res, next);

    } else {
        console.log('NOT FOUND apollo server for', path, ', starting...');

        const server = await createInitialApolloServer(path);
        await registerApolloServer(server, app, path);

        console.log('STARTED apollo server under', path)
        
        const router = routes[path].router;
        router(req, res, next);
    }
}


async function registerApolloServer(server, app, path) {
    await server.start();
    
    const router = express.Router();

    await server.applyMiddleware({ app: router, path });
    routes[path] = { router, server, state: 'init' };

    return server;
}

async function replaceApolloServer(server, app, path) {
    const oldRoute = routes[path];
    await oldRoute.server.stop();
    
    return registerApolloServer(server, app, path);
}

async function createInitialApolloServer(path) {
    const typeDefs = 'type Query { status: String, _a: String }'
    const resolvers = {
        Query: {
            status: () => 'init'
        }
    };
    return createApolloServer(path, typeDefs, resolvers);
}

async function createApolloServer(path, typeDefs, resolvers) {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => ({
            baseUrl: `http:/${path}`,
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