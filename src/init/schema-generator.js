const axios = require('axios').default;
const parser = require('xml2json');

async function generateSchema(baseUrl, headers) {
    if (!headers) {
        return Promise.resolve('type Query { ping: String }');
    }
    const resp = await axios.get(`${baseUrl}/api/describe`, { headers });

    // const { data } = resp;
    // const jsonData = JSON.parse(parser.toJson(data));

    console.log('z');
    
    return Promise.resolve(`
        type Query {
            account: [Account]
        }

        type Account {
            id: ID!
            revisionId: ID!
            name: String
        }
    `);
}

module.exports = {
    generateSchema
}