const axios = require('axios').default;
const parser = require('xml2json');
const qs = require('qs');
const R = require('ramda');

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
    const url = `${baseurl}/api/${type}/list`;

    const where = R.toPairs(args.criteria).map(p => `${p[0]}=${p[1]}`);

    console.log('GET', url, args);

    const options = { 
        params: { ...args.params, where },
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
        console.log(e.message);
        return Promise.reject(e.message);
    });
}

module.exports = {
    describe,
    list
};