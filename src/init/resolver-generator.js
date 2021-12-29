const R = require('ramda');
const parser = require('xml2json');

const cpq = require('../client/cpq-env-client');


async function generateResolvers(structure) {
    
    let resolvers;

    let Query = {
        status: () => 'ready'
    };

    structure.forEach(r => {
        Query[r.gqlListQueryName] = async (parent, args, context, info) => listResources(context, args, r);
        Query[r.gqlGetQueryName] = async (parent, args, context, info) => getResource(context, args, r);
    });

    resolvers = {
        Query
    }

    structure.forEach(r => {
        const references = r.attributes.filter(a => a.type === 'Reference');
       
        let referenceResolvers = {};

        references.forEach(ar => {
            referenceResolvers[ar.gqlName] = async (parent, args, context, info) => {
                const requestedAttributes = info.fieldNodes[0].selectionSet.selections.map(s => s.name.value);
                const notJustId = Boolean(requestedAttributes.find(x => x !== '_id'));
                const args2 = parent[ar.gqlName];

                if (args2._id) {
                    if (notJustId) {
                        const struct2 = structure.find(x => x.gqlName === ar.gqlType);
                        return getResource(context, args2, struct2);
                    } else {
                        return Promise.resolve({ _id: args2._id });
                    }
                }
            }
        })

        resolvers[r.gqlName] = referenceResolvers
    });

    return resolvers;
}

async function listResources(context, args, structure) {
    // console.log(JSON.stringify(context));
    const resp = await cpq.list(context, structure.apiType, args);

    return parseResponse(resp, structure);
}

async function getResource(context, args, structure) {
    // console.log(JSON.stringify(args));
    const resp = await cpq.get(context, structure.apiType, args);

    const result = await parseResponse(resp, structure);

    return R.head(result);
}

async function parseResponse(resp, structure) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    
    // console.log(JSON.stringify(jsonData, null, 2));
    
    const resources = jsonData.list ? [jsonData.list.resource].flat().filter(R.identity) : [jsonData.resource];
    
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

        if (gqlAttribute.type === 'Reference') {
            result[gqlAttribute.gqlName] = {
                _id: a.value
            };
        } else {
            result[gqlAttribute.gqlName] = a.value;
        }
    })

    return result;
}


module.exports = {
    generateResolvers
}