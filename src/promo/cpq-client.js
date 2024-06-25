const Axios = require('axios');
const R = require('ramda');

const { GraphQLError } = require('graphql');

const ENDPOINT = 'api/product-modeling/v2';

const axios = Axios.create({
    timeout: 180000
});

async function listObjects(context, objectType) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}/list`;

    console.log('GET', url);

    const resp = await handleErrors(
        () => axios.get(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}

async function getObjectById(context, objectType, id) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}/${id}`;

    console.log('GET', url);

    const resp = await handleErrors(
        () => axios.get(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}

async function getObjectByName(context, objectType, name) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}?name=${name}`;

    console.log('GET', url);

    const resp = await handleErrors(
        () => axios.get(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}


async function deleteObject(context, objectType, id) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}/${id}`;

    console.log('DELETE', url);

    const resp = await handleErrors(
        () => axios.delete(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}

async function upsertObject(context, objectType, obj) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}`;

    console.log('POST', url);

    const resp = await handleErrors(
        () => axios.post(url, obj, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}

async function upsertObjects(context, objectType, obj) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/${objectType}/list`;

    console.log('POST', url);

    const resp = await handleErrors(
        () => axios.post(url, obj, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}


// ----------------------------------------------------------------------------

async function getDomain(context, id) {
    return getObjectById(context, 'domain', id);
}

async function getAssembly(context, id) {
    return getObjectById(context, 'assembly', id);
}

async function getDomainByName(context, name) {
    return getObjectByName(context, 'domain', name);
}

async function getModule(context, id) {
    return getObjectById(context, 'module', id);
}

async function getModuleByName(context, name) {
    return getObjectByName(context, 'module', name);
}

async function getAttributeCategory(context, id) {
    return getObjectById(context, 'attribute-category', id);
}

async function listDomains(context) {
    return listObjects(context, 'domain');
}

async function listAssemblies(context) {
    return listObjects(context, 'assembly');
}

async function listModules(context) {
    return listObjects(context, 'module');
}

async function listGlobalFeatures(context) {
    return listObjects(context, 'global-feature');
}

async function listAttributeCategories(context) {
    return listObjects(context, 'attribute-category');
}

async function deleteDomain(context, id) {
    return deleteObject(context, 'domain', id);
}

async function deleteAssembly(context, id) {
    return deleteObject(context, 'assembly', id);
}

async function deleteModule(context, id) {
    return deleteObject(context, 'module', id);
}

async function upsertDomain(context, obj) {
    return upsertObject(context, 'domain', obj);
}

async function upsertDomains(context, obj) {
    return upsertObjects(context, 'domain', obj);
}

async function upsertModule(context, obj) {
    return upsertObject(context, 'module', obj);
}

async function upsertModules(context, obj) {
    return upsertObjects(context, 'module', obj);
}

async function upsertGlobalFeature(context, obj) {
    return upsertObject(context, 'global-feature', obj);
}

async function upsertGlobalFeatures(context, obj) {
    return upsertObjects(context, 'global-feature', obj);
}

async function upsertAssembly(context, obj) {
    return upsertObject(context, 'assembly', obj);
}

async function upsertAssemblies(context, obj) {
    return upsertObjects(context, 'assembly', obj);
}

async function upsertAttributeCategory(context, obj) {
    return upsertObject(context, 'attribute-category', obj);
}

async function upsertAttributeCategories(context, obj) {
    return upsertObjects(context, 'attribute-category', obj);
}


// ----------------------------------------------------------------------------

async function handleErrors(func, body, retries) {
    retries = retries !== undefined ? retries : 1;
    const delay = 1000;
    const promise = func();

    return promise.catch(e => {
        let error = { message: e.message }

        console.log('ERROR', e);

        if (e.response) {
            const r = e.response;
            const status = r.status;
            
            switch(status) {
                case 502:
                    if (retries > 0) {
                        console.log('...Retrying last command');
                        return wait(delay).then(() => handleErrors(func, body, retries - 1));
                    } else {
                        return Promise.reject(new GraphQLError(e.message, { code: status, data: r.data })); 
                    }
                case 403:
                    return Promise.reject(new GraphQLError('Authentication error, check "Authorization" header and CPQ permissions!', { code: status }));
            };

            // console.log('REQUEST DATA', body);
            return Promise.reject(new GraphQLError([e.message, e.response.message, e.response.data.message].join('\n'), { code: status })); 

        }

         return Promise.reject(new GraphQLError(e.message, { code: error.status })); 
    });
}


async function wait(ms) {
    ms = ms || 1000;
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

module.exports = {
    getDomain,
    getAssembly,
    getDomainByName,    
    getModule,
    getModuleByName,
    getAttributeCategory,
    listDomains,
    listAssemblies,
    listModules,
    listGlobalFeatures,
    listAttributeCategories,
    deleteDomain,
    deleteAssembly,
    deleteModule,
    upsertDomain,
    upsertModule,
    upsertAssembly,
    upsertAttributeCategory,
    upsertDomains,
    upsertModules,
    upsertGlobalFeature,
    upsertGlobalFeatures,
    upsertAssemblies,
    upsertAttributeCategories
};
