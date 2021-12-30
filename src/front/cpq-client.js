const { ApolloError, AuthenticationError } = require('apollo-server');

const Axios = require('axios');
const { throttleAdapterEnhancer, cacheAdapterEnhancer, Cache } = require('axios-extensions');
const qs = require('qs');
const R = require('ramda');

const MAX_AGE = 5 * 1000;
const THRESHOLD = 5 * 1000;

const axios = Axios.create({
    adapter: throttleAdapterEnhancer(
        cacheAdapterEnhancer(Axios.defaults.adapter, { defaultCache: new Cache({ maxAge: MAX_AGE, max: 100 })}), 
        { threshold: THRESHOLD }
    )
});

async function describe(context) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api/describe`;

    console.log('GET', url);

    const resp = await handleErrors(
        axios.get(url, { headers: { Authorization: headers.authorization } })
    );

    return resp;
}

async function list(context, type, args) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api-v2/${type}/list`;

    const where = R.toPairs(args.criteria).map(p => `${p[0]}=${p[1]}`);

    console.log('GET', url, args);

    const options = { 
        params: where.length > 0 ? { ...args.params, where } : { ...args.params },
        headers: { Authorization: headers.authorization },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
        cache: false
    };

    const resp = await handleErrors(
        axios.get(url, options)
    );

    return resp;
}

async function get(context, type, args) {
    const { baseurl, headers } = context;
    const id = args._id;
    const url = `${baseurl}/api-v2/${type}/${id}`;

    console.log('GET', url, args);

    const options = { 
        // params: { ...args.params, where },
        headers: { Authorization: headers.authorization },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' })
    };

    const resp = await handleErrors(
        axios.get(url, options)
    );

    return resp;
}

async function copy(context, type, args) {
    const { baseurl, headers } = context;
    const id = args._id;
    const url = `${baseurl}/api-v2/${type}/${id}/copy`;

    console.log('POST', url, args);

    const options = { 
        headers: { Authorization: headers.authorization }
    };

    const resp = await handleErrors(
        axios.post(url, null, options)
    );

    return resp;
}

async function add(context, type, args) {
    const { baseurl, headers } = context;
    const id = args._id;
    const url = `${baseurl}/api-v2/${type}`;

    console.log('POST', url, args);

    const pairs = R.toPairs(args.attributes);

    const attributesXml = pairs.filter(p => p[1] !== null).map(p => `<attribute name="${p[0]}" value="${p[1]._id || p[1]}"/>`);
    const attributesNullXml = pairs.filter(p => p[1] === null).map(p => `<attribute name="${p[0]}"/>`);

    const bodyXml = `
        <resource organization="Global Sales">
            <attributes>
                ${attributesXml.join('\n')}
                ${attributesNullXml.join('\n')}
            </attributes>
        </resource>    
    `

    const options = { 
        headers: { Authorization: headers.authorization }
    };

    const resp = await handleErrors(
        axios.post(url, bodyXml, options)
    );

    return resp;
}

async function update(context, type, args) {
    const { baseurl, headers } = context;
    const id = args._id;
    const url = `${baseurl}/api-v2/${type}/${id}`;

    console.log('PUT', url, args);

    const pairs = R.toPairs(args.attributes);

    const attributesXml = pairs.filter(p => p[1] !== null).map(p => `<attribute name="${p[0]}" value="${p[1]._id || p[1]}"/>`);
    const attributesNullXml = pairs.filter(p => p[1] === null).map(p => `<attribute name="${p[0]}"/>`);

    const bodyXml = `
        <resource organization="Global Sales">
            <attributes>
                ${attributesXml.join('\n')}
                ${attributesNullXml.join('\n')}
            </attributes>
        </resource>    
    `


    const options = { 
        headers: { Authorization: headers.authorization }
    };

    const resp = await handleErrors(
        axios.put(url, bodyXml, options)
    );

    return resp;
}

async function del(context, type, args) {
    const { baseurl, headers } = context;
    const id = args._id;
    const url = `${baseurl}/api-v2/${type}/${id}`;

    console.log('DELETE', url, args);

    const options = { 
        headers: { Authorization: headers.authorization }
    };

    const resp = await handleErrors(
        axios.delete(url,options)
    );

    return resp;
}

async function handleErrors(promise) {
    return promise.catch(e => {
        let error = { message: e.message }

        if (e.response) {
            const r = e.response;
            const status = r.status;
            
            switch(status) {
                case 403:
                    return Promise.reject(new AuthenticationError('Authentication error, check "Authorization" header!'));
            };

            return Promise.reject(new ApolloError(r.data, status));

        }

        return Promise.reject(new ApolloError(error.message, error.status));
    });
}

module.exports = {
    describe,
    list,
    get,
    copy,
    add,
    update,
    del
};