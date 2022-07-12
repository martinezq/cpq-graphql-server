const { ApolloError, AuthenticationError } = require('apollo-server');

const Axios = require('axios');
const { throttleAdapterEnhancer, cacheAdapterEnhancer, Cache } = require('axios-extensions');
const qs = require('qs');
const R = require('ramda');

const MAX_AGE = 5 * 1000;
const THRESHOLD = 5 * 1000;

const axios = Axios.create();

// const cache = new Cache({ maxAge: MAX_AGE, max: 100 });

// const axios = Axios.create({
//     headers: { 'Cache-Control': 'no-cache' },
//     adapter: throttleAdapterEnhancer(
//         cacheAdapterEnhancer(Axios.defaults.adapter, { defaultCache: cache, enabledByDefault: true }), 
//         { threshold: THRESHOLD }
//     )
// });

async function describe(context) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api/describe`;

    console.log('GET', url);

    const resp = await handleErrors(
        axios.get(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp;
}

async function headers(context, type, args) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api-v2/${type}/headers`;

    const where = R.toPairs(args.criteria).map(p => `${p[0]}=${p[1]._id || p[1]}`);

    console.log('GET', url, args, where);

    const options = { 
        params: where.length > 0 ? { ...args.params, where } : { ...args.params },
        headers: { Authorization: headers.authorization },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' })
    };

    const resp = await handleErrors(
        axios.get(url, options)
    );

    // console.log('GET Response', resp.data);

    return resp;
}


async function list(context, type, args) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api-v2/${type}/list`;

    const where = R.toPairs(args.criteria).map(p => `${p[0]}=${p[1]._id || p[1]}`);

    console.log('GET', url, args, where);

    const options = { 
        params: where.length > 0 ? { ...args.params, where } : { ...args.params },
        headers: { Authorization: headers.authorization },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' })
    };

    const resp = await handleErrors(
        axios.get(url, options)
    );

    // console.log('GET Response', resp.data);

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

    // console.log('GET Response', resp.data);

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

    const attributesHeader = pairs
        .filter(p => p[0]?.indexOf('_') === 0)
        .map(p => ` ${p[0].substring(1)}="${p[1]}"`);

    const attributesPlainXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => p[1] !== null && isPlain(p[1]))
        .map(p => `<attribute name="${p[0]}" value="${p[1]}"/>`);
    
    const attributesRefXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => p[1]?._id)
        .map(p => `<attribute name="${p[0]}" value="${p[1]._id}"/>`);
    
    const attributesNullXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => p[1] === null)
        .map(p => `<attribute name="${p[0]}"/>`);

    const attributesArrayXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => Array.isArray(p[1]))
        .map(p => `<attribute name="${p[0]}"><${p[0]}>${toXML(p[1])}</${p[0]}></attribute>`);

    const attributesBom = pairs
        .filter(p => p[0] === 'bom')
        .map(p => `<attribute name="bom"><items>${
            p[1].items.map(i => `<item description="${i.description}" qty="${i.qty || 1}"></item>`).join('\n')
        }</items></attribute>`);

    const bodyXml = `
        <resource ${attributesHeader}>
            <attributes>
                ${attributesPlainXml.join('\n')}
                ${attributesRefXml.join('\n')}
                ${attributesNullXml.join('\n')}
                ${attributesArrayXml.join('\n')}
                ${attributesBom.join('\n')}
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
    
    const attributesHeader = pairs
        .filter(p => p[0]?.indexOf('_') === 0)
        .map(p => ` ${p[0].substring(1)}="${p[1]}"`);
    
    const attributesXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => p[1] !== null)
        .map(p => `<attribute name="${p[0]}" value="${p[1]._id || p[1]}"/>`);
    
    const attributesNullXml = pairs
        .filter(p => p[0]?.indexOf('_') !== 0)
        .filter(p => p[1] === null)
        .map(p => `<attribute name="${p[0]}"/>`);

    const bodyXml = `
        <resource ${attributesHeader}>
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

module.exports = {
    describe,
    headers,
    list,
    get,
    copy,
    add,
    update,
    del
};
