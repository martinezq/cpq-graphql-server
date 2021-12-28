const parser = require('xml2json');

async function generateSchema(structure) {

    const types = structure.map(r => {
        const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
        return `
            type ${r.name} {
                ${attributes.join('\n')}
            }
        `;
    });

    const queries = structure.map(r => `    ${r.gqlQueryName}: [${r.gqlName}]`);

    const schema = `
        type Query {
            status: String
            ${queries.join('\n')}
        }

        ${types.join('\n')}
    `;

    // console.log(schema);

    return schema;

}

function parseResponse(resp) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = jsonData.resources.resource;

    return resources.map(r => {
        return {
            name: r.name,
            gqlName: r.name,
            gqlQueryName: r.name + 'List',
            apiType: r.name.toLowerCase(),
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
    parseResponse,
    generateSchema
}