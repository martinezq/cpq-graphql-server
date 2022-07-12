const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const responseCachePlugin = require('apollo-server-plugin-response-cache').default;

const cpq = require('./cpq-client');
const structureParser = require('./structure-parser');
const schemaGenerator = require('./schema-generator');
const resolverGenerator = require('./resolver-generator');
const public = require('../common/public-schema');

// ----------------------------------------------------------------------------

const KILL_AFTER_MS = 60 * 60 * 1000;
const PROBE_DELAY_MS = 30 * 1000;

let routes = {};

async function handlePath(req, res, next, app) {
    const path = req.path;

    if (!routes[path]) {
        console.log('NOT FOUND apollo server for', path, ', starting...');
        await initializePath(path, req.headers)
    }

    if (routes[path].state === 'waiting for auth' && req.headers?.authorization) {
        await initializePath(path, req.headers);
    }

    const router = routes[path].router;
    
    if (router) {
        router(req, res, next);
        routes[path].lastUsedTime = (new Date()).getTime();
    } else {
        res.sendStatus(400);
    }
}

// ----------------------------------------------------------------------------

async function initializePath(path, headers) {
    if (headers?.authorization) {
        console.log('INITIALIZING apollo server with remote schema for path', path);
        return initializePathWithRemoteSchema(path, headers);
    } else {
        console.log('INITIALIZING apollo server with default schema for path', path);
        return initializePathWithDefaultSchema(path);
    }
}

async function initializePathWithRemoteSchema(path, headers) {
    try {
        const { schema, resolvers } = await generateSchemaAndResolvers(path, headers);
        const server = await createApolloServer(path, schema, resolvers);

        await createOrReplaceApolloServer(server, path);
        console.log('RECREATED apollo server for', path);

        routes[path] = routes[path] || {};
        routes[path].state = 'ready';
        routes[path].lastUsedTime = Date.now();
        routes[path].schemaHash = schema;
        
        async function probe() {
            if (Date.now() - routes[path]?.lastUsedTime > KILL_AFTER_MS) {
                console.log('KILLING unused apollo server for', path, 'after', KILL_AFTER_MS, 'ms');
                await routes[path].server.stop();
                routes[path] = undefined;
            } else {
                const last = routes[path]?.lastUsedTime;
                const { schema, resolvers } = await generateSchemaAndResolvers(path, headers);

                if (schema !== routes[path].schemaHash) {
                    const server = await createApolloServer(path, schema, resolvers);
                    await createOrReplaceApolloServer(server, path);
                    routes[path].lastUsedTime = last;
                    console.log('REFRESHED apollo server for', path);
                }
        
                setTimeout(() => probe(), PROBE_DELAY_MS);
            }
        }

        setTimeout(() => probe(), PROBE_DELAY_MS);
        
    } catch (e) {
        console.log(e);
        routes[path] = routes[path] || {};
        routes[path].state = `error: ${e.message}`;

        setTimeout(() => routes[path].state = 'waiting for auth', 5000);
    }        
}

async function initializePathWithDefaultSchema(path) {
    const server = await createInitialApolloServer(path);
    await registerApolloServer(server, path);
}

async function generateSchemaAndResolvers(path, headers) {
    const baseurl = `https:/${path}`
    console.log('LOADING schema from', baseurl);

    const resp = await cpq.describe({ baseurl, headers });
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
    routes[path] = { router, server, state: 'waiting for auth' };

    return server;
}

async function createOrReplaceApolloServer(server, path) {
    const oldRoute = routes[path];

    if (oldRoute) {
        await oldRoute.server.stop();
    }
    
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