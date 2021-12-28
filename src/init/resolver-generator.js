const R = require('ramda');
const parser = require('xml2json');

const cpq = require('../client/cpq-env-client');


async function generateResolvers(structure) {
    
    let Query = {
        status: () => 'ready'
    };

    structure.forEach(r => Query[r.gqlQueryName] = async (parent, args, context, info) => loadResource(context, args, r))

    return { Query }
}

async function loadResource(context, args, structure) {
    // console.log(JSON.stringify(context));
    const resp = await cpq.list(context, structure.apiType, args);

    return parseResponse(resp, structure);
}

async function parseResponse(resp, structure) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = [jsonData.list.resource].flat().filter(R.identity);

    // console.log(JSON.stringify(jsonData, null, 2));
    return Promise.resolve(resources.map(e => parseElement(e, structure)));
}

function parseElement(e, structure) {
    if (!e) return undefined;

    const attributes = e.attributes.attribute;

    let result = {
        _id: e.id,
        _rev: e.revisionId,
        _latestVersion: e.latestVersion,
        _state: e.state,
        _modifiedTime: e.modifiedTime,
        _modifiedBy: e.modifiedBy,
        _owner: e.owner
    };

    attributes.forEach(a => {
        const gqlAttribute = structure.attributes.find(a2 => a2.name === a.name);
        result[gqlAttribute.gqlName] = a.value;
    })

    return result;
}


module.exports = {
    generateResolvers
}