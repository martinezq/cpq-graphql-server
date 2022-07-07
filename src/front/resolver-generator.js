const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');


async function generateResolvers(structure) {
    
    let resolvers;

    let Query = {
        ...public.resolvers.Query,
        status: () => 'ready',
    };

    let Mutation = {
        ...public.resolvers.Mutation,
        copyAccount: async (parent, args, context, info) => {
            console.log(parent, args, context, info);
        }
    };

    structure.forEach(r => {
        Query[r.gqlListQueryName] = async (parent, args, context, info) => listResources(context, args, r);
        Query[r.gqlGetQueryName] = async (parent, args, context, info) => getResource(context, args, r);

        Mutation[r.gqlCopyMutationName] = async (parent, args, context, info) => copyResource(context, args, r)
        Mutation[r.gqlAddMutationName] = async (parent, args, context, info) => addResource(context, args, r)
        Mutation[r.gqlAddIfDoesntExistMutationName] = async (parent, args, context, info) => addResourceIfDoesntExist(context, args, r)
        Mutation[r.gqlUpdateMutationName] = async (parent, args, context, info) => updateResource(context, args, r)
        Mutation[r.gqlUpdateManyMutationName] = async (parent, args, context, info) => updateManyResource(context, args, r)
        Mutation[r.gqlDeleteManyMutationName] = async (parent, args, context, info) => deleteManyResource(context, args, r)
    });

    resolvers = {
        Query, Mutation
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

async function listResources(context, args, structure, onlyHeaders = false) {
    // console.log(JSON.stringify(context));
    const criteria2 = await resolveLookups(context, { attributes: args.criteria }, structure);
    const args2 = { ...args, criteria: criteria2.attributes };

    const resp = onlyHeaders ? await cpq.headers(context, structure.apiType, args2) : await cpq.list(context, structure.apiType, args2);
    const parsed = await parseResponse(resp, structure);
    
    return args.filter ? filterResources(parsed, args.filter) : parsed;
}

async function filterResources(parsed, filter) {
    const rules = R.mapObjIndexed((v, k) => {
        if (v === null) return x => x === undefined;
        return R.equals(v);
    }, filter)
    
    const pred = R.where(rules);

    const result = parsed.filter(pred);

    return result;
}

async function getResource(context, args, structure) {
    // console.log(JSON.stringify(args));
    const resp = await cpq.get(context, structure.apiType, args);

    const result = await parseResponse(resp, structure);

    return R.head(result);
}

async function copyResource(context, args, structure) {
    const resp = await cpq.copy(context, structure.apiType, args);
    const _id = extractIdFromLocationHeader(resp.headers);
    return getResource(context, { _id }, structure);
}

async function addResource(context, args, structure) {
    const args2 = await resolveLookups(context, args, structure);

    const resp = await cpq.add(context, structure.apiType, args2);
    const _id = extractLatestIdFromLocationHeader(resp.headers);
    return getResource(context, { _id }, structure);
}

async function addResourceIfDoesntExist(context, args, structure) {
    if (args.check._id) {
        const res = await getResource(context, { _id: args.check._id}, structure);
        if (res) {
            return res;
        }
    }

    if (args.check.lookup) {
        const args2 = { criteria: args.check.lookup, params: { limit: 1 } };
        const res = await listResources(context, args2, structure, true);
        if (res.length === 1) {
            return getResource(context, { _id: res[0]._id }, structure);;
        }
    }
    
    return addResource(context, args, structure);
}

async function updateResource(context, args, structure) {
    const resource = await getResource(context, args, structure);

    const args2 = await resolveLookups(context, args, structure);
    const args3 = { ...args2, _id: resource._latestVersion };

    const resp = await cpq.update(context, structure.apiType, args3);
    const _id = extractLatestIdFromLocationHeader(resp.headers);
    return getResource(context, { _id }, structure);
}

async function updateManyResource(context, args, structure) {
    const list = await listResources(context, { ...args, params: { limit: 1000 }}, structure);

    const args2 = await resolveLookups(context, args, structure);

    let count = 0;

    // One at a time
    await list.reduce((p, c) => p.then(async () => {
        const args3 = { ...args2, _id: c._latestVersion };
        const resp = await cpq.update(context, structure.apiType, args3);
        count++;
        return resp;
    }), Promise.resolve());

    return count;
}

async function deleteManyResource(context, args, structure) {
    const list = await listResources(context, { ...args, params: { limit: 1000 }}, structure, true);

    let count = 0;

    // One at a time
    await list.reduce((p, c) => p.then(async () => {
        const args2 = { _id: c._latestVersion, attributes: args.attributes };
        const resp = await cpq.del(context, structure.apiType, args2);
        count++;
        return resp;
    }), Promise.resolve());

    return count;
}

async function resolveLookups(context, args, structure) {
    const pairs = R.toPairs(args.attributes);
    const lookups = pairs.filter(p => p[1].lookup && !p[1]._id).map(p => ({ name: p[0], lookup: p[1].lookup }));

    const lookupResult = await Promise.all(lookups.map(async (l) => {
        const lookupStructure = structure.attributes.find(a => a.name === l.name).resource;
        const resp = await listResources(context, { criteria: l.lookup, params: { limit: 1 } }, lookupStructure, true);

        return { key: l.name, value: R.head(resp) };
    }));

    const attributes2 = R.mapObjIndexed((v, k) => {
        if (v.lookup) return { _id: lookupResult.find(x => x.key === k)?.value._id }
        return v;
    }, args.attributes);

    return { ...args, attributes: attributes2};
}

function extractLatestIdFromLocationHeader(headers) {
    const { location } = headers;
    const parsed = location.match(/\/[a-zA-Z0-9]+\/([a-z0-9]+-[a-z0-9]+)/);

    if (parsed) {
        return parsed[1];
    }
}

async function parseResponse(resp, structure) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    
    // console.log(JSON.stringify(jsonData, null, 2));
    
    const resources = jsonData.list ? [jsonData.list.resource].flat().filter(R.identity) : [jsonData.resource];
    const headers = jsonData.headers ? [jsonData.headers.header].flat().filter(R.identity) : [jsonData.header];
    
    const list = [].concat(resources).concat(headers).filter(R.identity);

    return Promise.resolve(list.map(e => parseElement(e, structure)));
}

function parseElement(e, structure) {
    if (!e) return undefined;

    let result = {
        _id: e.id,
        _rev: e.revisionId,
        _latestVersion: e.latestVersion,
        _state: e.state,
        _modifiedTime: e.modifiedTime,
        _modifiedBy: e.modifiedBy,
        _owner: e.owner,
        _organization: e.organization
    };

    if (e.attributes) {

        const attributes = [e.attributes.attribute].flat();

        attributes.forEach(a => {
            const gqlAttribute = structure.attributes.find(a2 => a2.name === a.name);

            if (!gqlAttribute) return;

            if (gqlAttribute?.type === 'Reference') {
                result[gqlAttribute.gqlName] = {
                    _id: a.value
                };
            } else if (gqlAttribute?.type === 'XML') {
                if (gqlAttribute?.name === 'profiles') {
                    result[gqlAttribute.gqlName] = [a.profiles.organization].flat().map(o => ({ organization: { name: o.name, role: [o.role].flat() } }));
                } else {
                    result[gqlAttribute.gqlName] = JSON.stringify(a);
                }
            } else {
                result[gqlAttribute.gqlName] = a.value;
            }
        });
    }

    return result;
}

module.exports = {
    generateResolvers
}