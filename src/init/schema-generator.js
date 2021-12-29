const parser = require('xml2json');

async function generateSchema(structure) {

    const types = structure.map(r => {
        const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
        const attributeNames = r.attributes.map(a => `${a.gqlName}`);
        const criteria = r.attributes.map(a => `${a.gqlName}: String`);
        
        return `
            enum ${r.gqlListQueryName}QuerySortBy {
                ${attributeNames.join('\n')}
            }

            input ${r.gqlListQueryName}QueryParams {
                limit: Int
                offset: Int
                sort: ${r.gqlListQueryName}QuerySortBy
                order: Order
            }

            input ${r.gqlListQueryName}QueryCriteria {
                ${criteria.join('\n')}
            }

            type ${r.name} @cacheControl(maxAge: 5) {
                _id: ID
                _rev: ID
                _latestVersion: ID
                _state: String
                _modifiedTime: String
                _modifiedBy: String
                _owner: String
                ${attributes.join('\n')}
            }
        `;
    });

    const queries = structure.map(r => `
        "Get list of ${r.gqlName}s"
        ${r.gqlListQueryName}(criteria: ${r.gqlListQueryName}QueryCriteria, params: ${r.gqlListQueryName}QueryParams): [${r.gqlName}]

        "Get ${r.gqlName} by id"
        ${r.gqlGetQueryName}(_id: ID!): ${r.gqlName}
    `);

    const schema = `
        enum Order {
            asc
            desc
        }

        type Query {
            status: String
            ${queries.join('\n')}
        }

        ${types.join('\n')}

        enum CacheControlScope {
            PUBLIC
            PRIVATE
          }
          
          directive @cacheControl(
            maxAge: Int
            scope: CacheControlScope
            inheritMaxAge: Boolean
          ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION
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
            gqlListQueryName: r.name + 'List',
            gqlGetQueryName: r.name,
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