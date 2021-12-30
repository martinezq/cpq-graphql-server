const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const responseCachePlugin = require('apollo-server-plugin-response-cache').default;

const cpq = require('./cpq-client');
const structureParser = require('./structure-parser');
const schemaGenerator = require('./schema-generator');
const resolverGenerator = require('./resolver-generator');
const public = require('../common/public-schema');

// ----------------------------------------------------------------------------

let routes = {};

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

// ----------------------------------------------------------------------------

async function generateSchemaAndResolvers(context) {
    console.log('LOADING schema from', context.baseurl);

    const resp = await cpq.describe(context);
    const structure = structureParser.parseDescribeResponse(resp);

    return {
        schema: await schemaGenerator.generateSchema(structure),
        resolvers: await resolverGenerator.generateResolvers(structure)
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
    const resolvers = {
        Query: {
            ...public.resolvers.Query,
            status: () => routes[path].state
        }
    };
    
    return createApolloServer(path, public.schema, resolvers);
}

async function createApolloServer(path, typeDefs, resolvers) {
    const cache = responseCachePlugin();

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: async ({ req }) => {
            return Promise.resolve({
                baseurl: `https:/${path}`,
                headers: {
                    authorization: req.headers.authorization
                }
            });
        },
        formatError: (err) => {
            console.log(err);
            return err;
        },
        plugins: [cache],
    });

    return Promise.resolve(server);
}

module.exports = {
    handlePath
}