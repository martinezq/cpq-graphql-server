const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');

async function generateResolvers() {

    let Query = {
        ...public.resolvers.Query,
        status: () => 'ready',
        listDomains,
        listAssemblies,
        listModules
    };

    let Mutation = {
        ...public.resolvers.Mutation,
        deleteDomain,
        deleteAssembly,
        deleteModule
    };

    let typeResolvers = {
        AssemblyAttribute: {
            domain: async (parent, args, context, info) => resolveType(parent, args, context, info, parent.domainNamedReference)
        },
        Feature: {
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

async function listModules(parent, args, context, info) {
    const data = await cpq.listModules(context);

    return data.moduleResourceList.map(moduleResource => {
        const id = moduleResource.moduleReference.id;

        const features = 
            data.featureResourceList
            .filter(featureResource => featureResource.feature.parentModuleNamedReference.id === id)
            .map(featureResource => ({
                id: featureResource.featureReference.id,
                ...featureResource.feature
            }));

        const variants = 
            data.variantResourceList
            .filter(variantResource => variantResource.variant.parentModuleNamedReference.id === id)
            .map(variantResource => {
                const variantValues = 
                    variantResource.variant.variantValueList
                    .map(variantValue => ({
                        ... variantValue,
                        feature: variantValue.featureNamedReference
                    }));
                
                 return {
                    id: variantResource.variantReference.id,
                    ...variantResource.variant,
                    values: variantValues
                }
            });      
           
        
        return {
            id: moduleResource.moduleReference.id, 
            ...moduleResource.module,
            features,
            variants
        };
    });
}

async function deleteDomain(parent, args, context, info) {
    await cpq.deleteDomain(context, args.id);
    return true;
}

async function deleteAssembly(parent, args, context, info) {
    await cpq.deleteAssembly(context, args.id);
    return true;
}


async function deleteModule(parent, args, context, info) {
    await cpq.deleteModule(context, args.id);
    return true;
}

module.exports = {
    generateResolvers
}