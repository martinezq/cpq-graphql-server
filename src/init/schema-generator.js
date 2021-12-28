const axios = require('axios').default;
const parser = require('xml2json');

async function generateSchema(baseUrl, headers) {
    const url = `${baseUrl}/api/describe`;

    console.log('LOADING schema from', url);

    try {
        const resp = await axios.get(url, { headers: { Authorization: 'Basic YXBpOlRhY3RvblBvd2VyMSE=' } });

        const { data } = resp;
        const jsonData = JSON.parse(parser.toJson(data));
        const resources = jsonData.resources.resource;

        console.log(resources);

        const types = resources.map(r => `
            type ${r.name} {
                id: ID!
                revisionId: ID!
                name: String                
            }
        `);

        const queries = resources.map(r => `    ${r.name.toLowerCase()}: [${r.name}]`);

        const schema = `
            type Query {
                status: String
                ${queries}
            }

            ${types.join('\n')}
        `;

        return schema;

    } catch (e) {
        // console.log(e.message);
        return Promise.reject(e.message);
    }
}

module.exports = {
    generateSchema
}