const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');
const { parse } = require('qs');


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
        Mutation[r.gqlTransitionMutationName] = async (parent, args, context, info) => transitionResource(context, args, r)
        Mutation[r.gqlUpdateManyMutationName] = async (parent, args, context, info) => updateManyResources(context, args, r)
        Mutation[r.gqlDeleteManyMutationName] = async (parent, args, context, info) => deleteManyResources(context, args, r)
        Mutation[r.gqlTransitionManyMutationName] = async (parent, args, context, info) => transitionManyResources(context, args, r)
        Mutation['recalculatePricing'] = async (parent, args, context, info) => recalculatePricing(context, args, r),
        Mutation['configureSolutionProducts'] = async (parent, args, context, info) => configureSolutionProducts(context, args, r)
    });

    resolvers = {
        Query, Mutation, 
        Long: public.resolvers.LongScalar
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
    if (args.params?.offset !== undefined && args.params?.page !== undefined) {
        throw 'Query params: offset and page cannot be used together';
    }

    if (args.params?.limit > 1000 && args.params?.page === undefined) {
        throw 'Query params: if limit > 1000, use page param, not offset';
    }
    
    // console.log(JSON.stringify(context));
    const page = args.params?.page || 1000;
    
    const criteria2 = await resolveLookups(context, { attributes: args.criteria }, structure);
    const args2 = { ...args, criteria: criteria2.attributes };

    const listOrHeaders = async (args3) => onlyHeaders ? await cpq.headers(context, structure.apiType, args3) : await cpq.list(context, structure.apiType, args3); 

    const listRecursiveAndParse = async (offset = 0, limit = args.params?.limit || 10) => {

        const resp = await listOrHeaders({ ...args2, params: { ...args2.params, limit: limit > page ? page : limit, offset }});
        const parsed = await parseResponse(resp, args2, structure);

        if (parsed.length === page) {
            const rest = await listRecursiveAndParse(offset + page, limit - parsed.length);
            return parsed.concat(rest);
        }

        return parsed;
    }

    let parsed = [];

    if (args.params?.limit > 1000) {
        parsed = await listRecursiveAndParse();
    } else {
        const resp = await listOrHeaders({ ...args2 });
        parsed = await parseResponse(resp, args2, structure);
    }
    
    return args.filter ? filterResources(parsed, args.filter) : parsed;
}

async function filterResources(parsed, filter) {
    const rules = R.mapObjIndexed((v, k) => {
        if (k === '_text') return x => true;

        if (v === null) return x => x === undefined;
        return R.equals(v);

    }, filter)
    
    const pred = R.where(rules);

    const result = parsed.filter(pred);
        
    if (filter._text) {
        const result2 = result.filter(x => JSON.stringify(x).indexOf(filter._text) > -1);
        return result2;
    } else {
        return result;
    }
}

async function getResource(context, args, structure) {
    // console.log(JSON.stringify(args));
    const resp = await cpq.get(context, structure.apiType, args);

    const result = await parseResponse(resp, args, structure);

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

    // todo: based on requested attributes!
    return {
        _id: _id.split('-')[0]
    };

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

async function transitionResource(context, args, structure) {
    if (!args.transition.id && !args.transition.ids && !args.transition.name && !args.transition.names) {
        return Promise.reject('No transition information provided!')
    }

    const transitionIds = args.transition.id ? [args.transition.id] : args.transition.ids;
    const transitionNames = args.transition.name ? [args.transition.name] : args.transition.names;
    
    const transitionResolvedIds = transitionIds ? 
        transitionIds.map(id => structure.transitions.find(t => t.gqlId === id)?.id) :
        transitionNames.map(name => structure.transitions.find(t => t.gqlName === name)?.id);

    let count = 0;
    let errors = [];

    await transitionResolvedIds.reduce((p, c) => p.then(async () => {
        const args2 = { _id: args._id, transitionId: c };
        const resp = await cpq.transition(context, structure.apiType, args2)
            .then(() => count++)
            .catch(e => {
                if (args.opts?.ignoreErrors) {
                    errors.push(e);
                    return Promise.resolve();
                } else {
                    return Promise.reject(e);
                }
            });
        return resp;
    }), Promise.resolve());    

    return {
        totalCount: transitionResolvedIds.length,
        successCount: count,
        errorCount: transitionResolvedIds.length - count,
        errors
    };
}

async function executeMassOperation(args, list, func) {
    const ignoreErrors = args.opts?.ignoreErrors || false;
    const parallel = args.opts?.parallel || 1;

    let errors = [];
    let count = 0;

    const buckets = R.splitEvery(parallel, list);

    await buckets.reduce((p, bucket) => p.then(() => {
        return Promise.all(bucket.map(async c => {
            try {
                await func(c);
                count++;
            } catch (e) {
                if (ignoreErrors) {
                    errors.push(e.toString());
                } else {
                    throw e;
                }
            }            
        })); 
    }), Promise.resolve());

    return {
        totalCount: list.length,
        successCount: count,
        errorCount: errors.length,
        errors
    };
}

async function updateManyResources(context, args, structure) {
    const list = await listResources(context, { ...args, params: { ...(args.params), limit: 1000000, page: 1000 }}, structure, !Boolean(args.filter));
    const args2 = await resolveLookups(context, args, structure);

    return await executeMassOperation(args, list, async (current) => {
        const localArgs = { ...args2, _id: current._latestVersion };
        return await cpq.update(context, structure.apiType, localArgs);
    });
}

async function deleteManyResources(context, args, structure) {
    const list = await listResources(context, { ...args, params: { limit: 1000000, page: 1000 }}, structure, !Boolean(args.filter));

    return await executeMassOperation(args, list, async (current) => {
        const localArgs = { _id: current._latestVersion, attributes: args.attributes };
        return await cpq.del(context, structure.apiType, localArgs);
    });

    // const ignoreErrors = args.opts?.ignoreErrors || false;

    // let deletedCount = 0;

    // let errors = [];

    // // One at a time
    // await list.reduce((p, c) => p.then(async () => {
    //     const args2 = { _id: c._latestVersion, attributes: args.attributes };
    //     try {
    //         const resp = await cpq.del(context, structure.apiType, args2);
    //         deletedCount++;
    //         return resp;
    //     } catch (e) {
    //         if (ignoreErrors) {
    //             errors.push(e.toString());
    //         } else {
    //             throw e;
    //         }
    //     }
    // }), Promise.resolve());

    // return {
    //     totalCount: list.length,
    //     successCount: deletedCount,
    //     errorCount: errors.length,
    //     errors
    // };
}

async function transitionManyResources(context, args, structure) {
    const list = await listResources(context, { ...args.selector, params: { limit: 1000 }}, structure, true);

    return await executeMassOperation(args, list, async (c) => {
        const args2 = { _id: c._id, ...args};
        return await transitionResource(context, args2, structure);
    });

    // let totalCount = 0;
    // let successCount = 0;
    // let errors = [];

    // // One at a time
    // await list.reduce((p, c) => p.then(async () => {
    //     const args2 = { _id: c._id, ...args};
    //     const resp = await transitionResource(context, args2, structure)
    //         .then(r => {
    //             totalCount += r.totalCount;
    //             successCount += r.successCount;
    //             r.errors.forEach(e => errors.push(e));
    //         })
    //         .catch(e => {
    //             if (args.opts?.ignoreErrors) {
    //                 errors.push(e);
    //                 return Promise.resolve();
    //             } else {
    //                 return Promise.reject(e);
    //             }
    //         });

    //     return resp;
    // }), Promise.resolve());

    // return {
    //     totalCount,
    //     successCount,
    //     errorCount: totalCount - successCount,
    //     errors
    // };
}

async function recalculatePricing(context, args, structure) {
    await cpq.recalculatePricing(context, 'solution', args);
    return true;
}

async function configureSolutionProducts(context, args, structure) {
    await cpq.configureSolutionProducts(context, 'solution', args);
    return true;
}

async function resolveLookups(context, args, structure) {
    const pairs = R.toPairs(args.attributes);
    const lookups = pairs.filter(p => p[1]?.lookup && !(p[1]?._id)).map(p => ({ name: p[0], lookup: p[1].lookup }));

    const lookupResult = await Promise.all(lookups.map(async (l) => {
        const lookupStructure = structure.attributes.find(a => a.name === l.name).resource;
        const resp = await listResources(context, { criteria: l.lookup, params: { limit: 1 } }, lookupStructure, true);

        return { key: l.name, value: R.head(resp) };
    }));

    const attributes2 = R.mapObjIndexed((v, k) => {
        if (v?.lookup) return { _id: lookupResult.find(x => x.key === k)?.value?._id }
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

async function parseResponse(resp, args, structure) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    
    // console.log(JSON.stringify(jsonData, null, 2));
    
    const resources = jsonData.list ? [jsonData.list.resource].flat().filter(R.identity) : [jsonData.resource];
    const headers = jsonData.headers ? [jsonData.headers.header].flat().filter(R.identity) : [jsonData.header];
    
    const list = [].concat(resources).concat(headers).filter(R.identity);

    return Promise.resolve(list.map(e => parseElement(e, args, structure)));
}

function parseElement(e, args, structure) {
    if (!e) return undefined;

    let result = {
        _id: e.id,
        _rev: e.revisionId,
        _latestVersion: e.latestVersion || (e.id + '-' + e.revisionId),
        _state: e.state,
        _modifiedTime: e.modifiedTime,
        _modifiedBy: e.modifiedBy,
        _owner: e.owner,
        _organization: e.organization,
        _state: e.state,
        _stateId: e.stateId
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
                } else if (gqlAttribute?.name === 'bom') {
                    result[gqlAttribute.gqlName] = JSON.stringify(a);
                    result['bomStructure'] = parseBomStructure(a);
                } else {
                    result[gqlAttribute.gqlName] = JSON.stringify(a);
                }
            } else if (gqlAttribute?.type === 'Boolean') {
                result[gqlAttribute.gqlName] = a.value === 'true';
            } else {
                result[gqlAttribute.gqlName] = a.value;
            }
        });
    }

    result._expressionResult = args.expression;

    return result;
}

function parseBomStructure(bom) {

    function parseItem(item) {
        const keys = R.keys(item)
        const attributeKeys = keys.filter(k => k !== 'items');
        
        let result = { attributes: []};

        attributeKeys.forEach(a => {
            result.attributes.push({
                name: a,
                value: item[a]
            });
        });

        if (keys.indexOf('items') > -1) {
            result.items = R.flatten([item.items.item]).map(parseItem);
        }

        return result;
    }

    return { items: R.flatten([bom.items.item]).map(parseItem)};
}

module.exports = {
    generateResolvers
}