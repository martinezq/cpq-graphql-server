const { ApolloError, AuthenticationError } = require('apollo-server');

const Axios = require('axios');
const { throttleAdapterEnhancer, cacheAdapterEnhancer, Cache } = require('axios-extensions');
const R = require('ramda');

const MAX_AGE = 5 * 1000;
const THRESHOLD = 5 * 1000;

const axios = Axios.create({
    adapter: throttleAdapterEnhancer(
        cacheAdapterEnhancer(Axios.defaults.adapter, { defaultCache: new Cache({ maxAge: MAX_AGE, max: 100 })}), 
        { threshold: THRESHOLD }
    )
});

async function listTickets({ baseurl, headers }) {
    const adminBaseUrl = baseurl.split('/ticket/')[0];

    const url = `${adminBaseUrl}/api/ticket/list`;
    console.log('GET', url);

    return handleErrors(
        axios.get(url, { 
            headers: { Authorization: headers.authorization },
            cache: false
        })
    );

}

async function listDomains({ baseurl, headers }, { ticket }) {
    const url = `${baseurl}/api/product-modeling/v2/${ticket._id}/domain/list`;
    console.log('GET', url);

    return handleErrors(
        axios.get(url, { 
            headers: { Authorization: headers.authorization }
        })
    );
}

async function listGlobalFeatures({ baseurl, headers }, { ticket }) {
    const url = `${baseurl}/api/product-modeling/v2/${ticket._id}/global-feature/list`;
    console.log('GET', url);

    return handleErrors(
        axios.get(url, { 
            headers: { Authorization: headers.authorization }
        })
    );
}

async function listModules({ baseurl, headers }, { ticket }) {
    const url = `${baseurl}/api/product-modeling/v2/${ticket._id}/module/list`;
    console.log('GET', url);

    return handleErrors(
        axios.get(url, { 
            headers: { Authorization: headers.authorization }
        })
    );
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
    listTickets,
    listDomains,
    listGlobalFeatures,
    listModules
};