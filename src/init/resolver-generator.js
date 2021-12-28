const R = require('ramda');
const parser = require('xml2json');

const cpq = require('../client/cpq-env-client');


async function generateResolvers(structure) {
    
    let Query = {
        status: () => 'ready'
    };

    structure.forEach(r => Query[r.gqlQueryName] = async (parent, args, context, info) => loadResource(context, r))

    return { Query }
}

async function loadResource(context, structure) {
    // console.log(JSON.stringify(context));
    const resp = await cpq.list(context, structure.apiType);

    return parseResponse(resp, structure);
}

async function parseResponse(resp, structure) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = jsonData.list.resource;

    console.log(JSON.stringify(jsonData, null, 2));

    return Promise.resolve(resources.map(e => parseElement(e, structure)));
}

function parseElement(e, structure) {
    const attributes = e.attributes.attribute;

    let result = {};

    attributes.forEach(a => {
        const gqlAttribute = structure.attributes.find(a2 => a2.name === a.name);
        result[gqlAttribute.gqlName] = a.value;
    })

    return result;
}


module.exports = {
    generateResolvers
}