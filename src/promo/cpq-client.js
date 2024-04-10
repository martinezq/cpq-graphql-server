const Axios = require('axios');
const R = require('ramda');

const ENDPOINT = 'api/product-modeling/v2';

const axios = Axios.create({
    timeout: 180000
});

async function listAssemblies(context) {
    const { baseurl, ticket, headers } = context;
    const url = `${baseurl}/${ENDPOINT}/${ticket}/assembly/list`;

    console.log('GET', url);

    const resp = await handleErrors(
        () => axios.get(url, { headers: { Authorization: headers?.authorization } })
    );

    return resp.data;
}

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
                        return Promise.reject(new ApolloError(r.data, status)); 
                    }
                case 403:
                    return Promise.reject(new AuthenticationError('Authentication error, check "Authorization" header and CPQ permissions!'));
            };

            console.log('REQUEST DATA', body);
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

function escapeString(val) {
    if (typeof val !== 'string') return val;

    return val?.replaceAll('&', '&amp;')?.replaceAll('"', '&quot;')?.replaceAll('\\"', '&quot;');
}

async function wait(ms) {
    ms = ms || 1000;
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

module.exports = {
    listAssemblies
};
