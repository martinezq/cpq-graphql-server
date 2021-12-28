const axios = require('axios').default;
const parser = require('xml2json');

async function describe(context) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api/describe`;

    console.log('GET', url);

    const resp = await handleErrors(
        axios.get(url, { headers: { Authorization: headers.authorization } })
    );

    return resp;
}

async function list(context, type) {
    const { baseurl, headers } = context;
    const url = `${baseurl}/api/${type}/list`;

    console.log('GET', url, headers);

    const resp = await handleErrors(
        axios.get(url, { headers: { Authorization: headers.authorization } })
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