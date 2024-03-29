const parser = require('xml2json');

const public = require('../common/public-schema');
const cpq = require('./cpq-client');

const resolvers = {
    Query: {
        ...public.resolvers.Query,
        status: () => 'ready',
        listTickets,
        listDomains,
        listGlobalFeatures,
        listModules
    }
};

// ----------------------------------------------------------------------------

async function listTickets(parent, args, context) {
    const resp = await cpq.listTickets(context);

    if (resp.headers['content-type'] !== 'text/xml; charset=utf-8') {
        throw "Expected XML response, got something else - check Authorization header!";
    }

    const jsonData = JSON.parse(parser.toJson(resp.data));

    const list = [jsonData.tickets.ticket].flat();

    return list.map(e => ({ _id: e.id, summary: e.summary }));
}

async function listDomains(parent, args, context) {
    const resp = await cpq.listDomains(context, args);
    const list = resp.data.domainResourceList;

    return list.map(e => ({
        _id: e.domainReference.id,
        name: e.domain.name,
        description: e.domain.description,
        elements: e.domain.enumElementList
    }));
}

async function listGlobalFeatures(parent, args, context) {
    const resp = await cpq.listGlobalFeatures(context, args);
    const list = resp.data.featureResourceList;

    return list.map(e => ({
        _id: e.featureReference.id,
        name: e.feature.name,
        description: e.feature.description,
        initialValue: e.feature.initialValue,
        domain: e.feature.domainNamedReference && {
            _id: e.feature.domainNamedReference.id,
            name: e.feature.domainNamedReference.name
        }
    }));
}

async function listModules(parent, args, context) {
    const resp = await cpq.listModules(context, args);
    const list = resp.data.moduleResourceList;
    
    const featureList = resp.data.featureResourceList;

    return list.map(e => ({
        _id: e.moduleReference.id,
        name: e.module.name,
        description: e.module.description,
        features: featureList.filter(f => f.feature.parentModuleNamedReference.id === e.moduleReference.id).map(f => ({
            _id: f.featureReference.id,
            name: f.feature.name,
            description: f.feature.description,
            domain: f.feature.domainNamedReference && {
                _id: f.feature.domainNamedReference.id,
                name: f.feature.domainNamedReference.name
            }
        })),
        // initialValue: e.feature.initialValue,
        // domain: e.feature.domainNamedReference && {
        //     _id: e.feature.domainNamedReference.id,
        //     name: e.feature.domainNamedReference.name
        // }
    }));
}


module.exports = {
    resolvers
}