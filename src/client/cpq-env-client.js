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
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' })
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
    get
};