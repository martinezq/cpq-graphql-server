const axios = require('axios').default;
const parser = require('xml2json');

async function generateSchema(baseUrl, headers) {
    const url = `${baseUrl}/api/describe`;

    console.log('LOADING schema from', url);

    try {
        const resp = await axios.get(url, { headers: { Authorization: 'Basic YXBpOlRhY3RvblBvd2VyMSE=' } });

        const { data } = resp;
        const jsonData = JSON.parse(parser.toJson(data));
        // const resources = [jsonData.resources.resource[0]];
        const resources = jsonData.resources.resource;

        // console.log(resources);

        const types = resources.map(r => {
            const attributes = r.attributes.attribute.map(a => `${normalizeAttributeName(a.name)}: String`);
            return `
                type ${r.name} {
                    ${attributes.join('\n')}
                }
                `;
        });

        const queries = resources.map(r => `    ${r.name}List: [${r.name}]`);

        const schema = `
            type Query {
                status: String
                ${queries.join('\n')}
            }

            ${types.join('\n')}
        `;

        // console.log(schema);

        return schema;

    } catch (e) {
        // console.log(e.message);
        return Promise.reject(e.message);
    }
}

function normalizeAttributeName(name) {
    return name.replace(/-/, '');
}

module.exports = {
    generateSchema
}