const fs = require('fs');
const express = require('express');
const { ApolloServer } = require('@apollo/server');

const { resolvers } = require('./resolvers');
const public = require('../common/public-schema');

// ----------------------------------------------------------------------------

let routes = {};

async function handlePath(req, res, next, app) {
    const path = req.path;

    if (routes[path]) {
        // console.log('FOUND apollo server for', path);
        routes[path].router(req, res, next);
    } else {
        console.log('NOT FOUND apollo server for', path, ', starting...');

        const adminSchema = fs.readFileSync(`schema/cpq-admin.graphql`)
        const schema = `
            ${public.schema}
            ${adminSchema}
        `;

        const server = await createApolloServer(path, schema, resolvers);
        await registerApolloServer(server, path);

        console.log('STARTED apollo server under', path)
        
        const router = routes[path].router;
        router(req, res, next);
    }
}

// ----------------------------------------------------------------------------

async function registerApolloServer(server, path) {
    await server.start();
    
    const router = express.Router();

    await server.applyMiddleware({ app: router, path });
    routes[path] = { router, server, state: 'init', context: { baseurl: `https:/${path}`} };

    return server;
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