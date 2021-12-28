const axios = require('axios').default;
const parser = require('xml2json');

async function list(parent, args, context) {
    const resp = await axios.get(`${context.baseUrl}/api/Account/list`, context);

    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));

    const { list } = jsonData;
    
    return Promise.resolve(list.resource);
}

module.exports = {
    list
}