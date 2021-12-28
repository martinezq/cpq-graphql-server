const axios = require('axios').default;
const parser = require('xml2json');

async function generateSchema(baseUrl, headers) {
    const url = `${baseUrl}/api/describe`;

    console.log('LOADING schema from', url);

    try {
        const resp = await axios.get(url, { headers: { Authorization: headers.authorization } });

        const parsed = parseResponse(resp);

        console.log(JSON.stringify(parsed, null, 2))

        const { data } = resp;
        const jsonData = JSON.parse(parser.toJson(data));
        // const resources = [jsonData.resources.resource[0]];
        const resources = jsonData.resources.resource;

        // console.log(resources);

        const types = parsed.map(r => {
            const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
            return `
                type ${r.name} {
                    ${attributes.join('\n')}
                }
                `;
        });

        const queries = parsed.map(r => `    ${r.gqlQueryName}: [${r.gqlName}]`);

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

function parseResponse(resp) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = jsonData.resources.resource;

    // return resources;

    return resources.map(r => {
        return {
            gqlName: r.name,
            gqlQueryName: r.name + 'List',
            name: r.name,
            attributes: r.attributes.attribute.map(a => {
                return {
                    name: a.name,
                    gqlName: toGraphQLName(a),
                    type: a.type,
                    gqlType: toGraphQLType(a)
                }
            })
        }
    });
}

function toGraphQLName(attribute) {
    return attribute.name.replace(/-/, '');
}

function toGraphQLType(attribute) {
    switch(attribute.type) {
        case 'Reference':
            return attribute.referencedType;
        case 'StrongReference':
            return 'ID';
        case 'Boolean':
            return 'Boolean';
        case 'Integer':
            return 'Int';
    }
    
    return 'String';
}

module.exports = {
    generateSchema
}