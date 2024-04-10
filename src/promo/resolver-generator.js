const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');
const { parse } = require('qs');


async function generateResolvers() {

    let Query = {
        ...public.resolvers.Query,
        status: () => 'ready',

        listAssemblies: async (parent, args, context, info) => {
            const data = await cpq.listAssemblies(context);

            return data.assemblyResourceList.map(x => x.assembly);
        }
    };

    let Mutation = {
        ...public.resolvers.Mutation
    };

    return {Query, Mutation};
}

module.exports = {
    generateResolvers
}