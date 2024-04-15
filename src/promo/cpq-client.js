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

// ----------------------------------------------------------------------------

async function getDomain(context, id) {
    return getObjectById(context, 'domain', id);
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

async function upsertModule(context, obj) {
    return upsertObject(context, 'module', obj);
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

            console.log('REQUEST DATA', body);
            return Promise.reject(new GraphQLError([e.message, e.response.message, e.response.data.message].join('\n'), { code: status })); 

        }

        return Promise.reject(new GraphQLError(e.message, { code: error.status })); 
    });
}

function isPlain(x) {
    return (typeof x === 'string') || (typeof x === 'number') || (typeof x === 'boolean');
}

function toXML(json, tag) {
    if (tag) {
        if (Array.isArray(json)) {
            json = json.map(x => ({ [tag]: x }));
        } else {
            json = { [tag]: json };
        }
    }

    if (Array.isArray(json)) {
        return json.map(x => toXML(x)).join('');
    } else {
        const keys = R.keys(json)
        const tagName = R.head(keys)

        const child = json[tagName];

        const childKeys = R.keys(child);

        const plainAttributes = childKeys
            .filter(k => isPlain(child[k]))
            .map(k => `${k}="${child[k]}"`)

        const objectAttributes = childKeys
            .filter(k => !isPlain(child[k]))
            .map(k => toXML(child[k], k));

        return `<${tagName} ${plainAttributes.join(' ')}>
                    ${objectAttributes.join('\n')}
                </${tagName}>`;
    }

}

function escapeString(val) {
    if (typeof val !== 'string') return val;

    return val?.replaceAll('&', '&amp;')?.replaceAll('"', '&quot;')?.replaceAll('\\"', '&quot;');
}

async function wait(ms) {
    ms = ms || 1000;
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

module.exports = {
    getDomain,
    listDomains,
    listAssemblies,
    listModules,
    deleteDomain,
    deleteAssembly,
    deleteModule,
    upsertDomain,
    upsertModule
};
