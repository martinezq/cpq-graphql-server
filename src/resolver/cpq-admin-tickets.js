const axios = require('axios').default;
const parser = require('xml2json');

async function list(parent, args, context) {
    const resp = await axios.get(`${context.baseUrl}/api/ticket/list`, context);

    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));

    const { tickets } = jsonData;
    
    return Promise.resolve(tickets.ticket);
}

module.exports = {
    list
}