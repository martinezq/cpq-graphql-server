const R = require('ramda');
const parser = require('xml2json');

const cpq = require('./cpq-client');
const public = require('../common/public-schema');

const assemblyMapper = require('./assembly-mapper');
const moduleMapper = require('./module-mapper');

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
        deleteModule,
        upsertDomain,
        upsertModule,
        upsertAssembly
        // deltaUpsertDomain
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

    return data.assemblyResourceList.map(res => assemblyMapper.parseAssemblyResource(res, data));
}

async function listModules(parent, args, context, info) {
    const data = await cpq.listModules(context);

    return data.moduleResourceList.map(moduleResource => moduleMapper.parseModuleResource(moduleResource, data));
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

async function upsertDomain(parent, args, context, info) {
    const data = await cpq.upsertDomain(context, args);
    const id = data.domainNamedReference.id;
    const domain = await cpq.getDomain(context, id);
    return {id: domain.domainResource.domainReference.id, ...domain.domainResource.domain};
}

// async function deltaUpsertDomain(parent, args, context, info) {
//     const oldDomain = await cpq.getDomainByName(context, args.domain.name);

//     let mergedDomain = R.clone({ domain: oldDomain.domainResource.domain });

//     mergedDomain.domain.description = args.domain.description || mergedDomain.domain.description;
    
//     args.domain.enumElementList?.forEach(e => {
//         let existingElement = mergedDomain.domain.enumElementList.find(e2 => e2.name === e.name);

//         if (existingElement) {
//             existingElement.description = e.description || existingElement.description;
//         } else {
//             mergedDomain.domain.enumElementList.push(e);
//         }
//     });

//     const data = await cpq.upsertDomain(context, mergedDomain);
//     const id = data.domainNamedReference.id;

//     return { id };
// }


async function upsertModule(parent, args, context, info) {
    console.log(JSON.stringify(args, null, 2));

    const resource = moduleMapper.buildModuleResource(args.module);

    const data = await cpq.upsertModule(context, resource);
    const id = data.moduleNamedReference.id;
    
    return { id };
}

async function upsertAssembly(parent, args, context, info) {
    const modules = await listModules(parent, args, context, info);

    const assemblyResource = assemblyMapper.buildAssemblyResource(args.assembly, { modules });

    const data = await cpq.upsertAssembly(context, assemblyResource);
    const id = data.assemblyNamedReference.id;

    const resp2 = await cpq.getAssembly(context, id);

    const assembly2 = assemblyMapper.parseAssemblyResource({
        ...resp2.assemblyResource,
        ...R.omit(['assemblyResource'], resp2)
    }, resp2);

    const mergedAssembly = assemblyMapper.mergeAssembly(assembly2, args.assembly);

    const assemblyResource2 = assemblyMapper.buildAssemblyResource(mergedAssembly, { modules }, { includeCombinationRows: true });

    const data2 = await cpq.upsertAssembly(context, assemblyResource2);    
    const id2 = data2.assemblyNamedReference.id;

    const resp3 = await cpq.getAssembly(context, id2);

    const assembly3 = assemblyMapper.parseAssemblyResource({
        ...resp3.assemblyResource,
        ...R.omit(['assemblyResource'], resp3)
    }, resp3);

    return assembly3;
}


module.exports = {
    generateResolvers
}