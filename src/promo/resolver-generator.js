const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');
const { parse } = require('qs');


async function generateResolvers() {

    let Query = {
        ...public.resolvers.Query,
        status: () => 'ready',
        listDomains,
        listAssemblies
    };

    let Mutation = {
        ...public.resolvers.Mutation
    };

    let typeResolvers = {
        AssemblyAttribute: {
            domain: async (parent, args, context, info) => resolveType(parent, args, context, info, parent.domainNamedReference)
        }
    };

    return {Query, Mutation, ...typeResolvers};
}

// ----------------------------------------------------------------------------

async function resolveType(parent, args, context, info, obj) {
    const requestedAttributes = info.fieldNodes[0].selectionSet.selections.map(s => s.name.value);
    const notJustIdOrName = Boolean(requestedAttributes.find(x => (x !== 'id') && (x !== 'name')));

    if (notJustIdOrName) {
        const domain = await cpq.getDomain(context, obj.id);
        return {id: domain.domainResource.domainReference.id, ...domain.domainResource.domain};
    }

    return obj;
}

async function listDomains(parent, args, context, info) {
    const data = await cpq.listDomains(context);

    return data.domainResourceList.map(x => ({id: x.domainReference.id, ...x.domain}));
}


async function listAssemblies(parent, args, context, info) {
    const data = await cpq.listAssemblies(context);

    return data.assemblyResourceList.map(assemblyResource => {
        const id = assemblyResource.assemblyReference.id;

        const attributes = 
            data.attributeResourceList
            .filter(attributeResource => attributeResource.attribute.parentAssemblyNamedReference.id === id)
            .map(attributeResource => ({
                id: attributeResource.attributeReference.id,
                ...attributeResource.attribute,
                category: attributeResource.attribute.attributeCategoryNamedReference,
                aggregateList: attributeResource.attribute.aggregateList?.map(x => ({
                    attribute: x.attributeNamedReference,
                    feature: x.featureNamedReference,
                    position: x.positionNamedReference
                }))
            }));

        const positions = 
            data.positionResourceList
            .filter(positionResource => positionResource.position.parentAssemblyNamedReference.id === id)
            .map(positionResource => ({
                id: positionResource.positionReference.id,
                ...positionResource.position,
                module: positionResource.position.moduleNamedReference,
                assembly: positionResource.position.assemblyNamedReference,
            }));            

        return {
            id, 
            ...assemblyResource.assembly,
            attributes,
            positions
        };
    });
}

module.exports = {
    generateResolvers
}