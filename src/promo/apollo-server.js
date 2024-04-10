const express = require('express');
const { ApolloServer } = require('@apollo/server');
const responseCachePlugin = require('@apollo/server-plugin-response-cache').default;
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');

const schemaGenerator = require('./schema-generator');
const resolverGenerator = require('./resolver-generator');

// ----------------------------------------------------------------------------

let routes = {};

async function handlePath(req, res, next, app) {
    const path = req.path;

    if (!routes[path]) {
        console.log('NOT FOUND apollo server for', path, ', starting...');
        await initializePath(path, req.headers)
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
    console.log('INITIALIZING apollo server with default ProMo schema for path', path);
    return initializePathWithDefaultSchema(path);
}

async function initializePathWithDefaultSchema(path) {
    const server = await createInitialApolloServer(path);
    await registerApolloServer(server, path);
}

async function generateSchemaAndResolvers() {
    return {
        schema: await schemaGenerator.generateSchema(),
        resolvers: await resolverGenerator.generateResolvers()
    }
}                

async function registerApolloServer(server, path) {
    await server.start();
    
    const router = express.Router();

    router.use(
        path,
        cors(),
        express.json(),
        expressMiddleware(server, {
            context: async ({ req }) => ({
                baseurl: `https:/${path.split('/')[1]}`,
                ticket: path.split('/')[2],
                headers: {
                    authorization: req.headers.authorization
                }
            }),
        })
    );

    // await server.applyMiddleware({ app: router, path });
    routes[path] = { router, server, state: 'waiting for auth' };

    return server;
}

async function createInitialApolloServer(path) {
    const { schema, resolvers } = await generateSchemaAndResolvers(path);
    return createApolloServer(path, schema, resolvers);
}

async function createApolloServer(path, typeDefs, resolvers) {
    const cache = responseCachePlugin();

    const server = new ApolloServer({
        typeDefs,
        resolvers,
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