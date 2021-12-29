const parser = require('xml2json');

async function generateSchema(structure) {

    const types = structure.map(r => {
        const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
        const attributesPlain = r.attributes.filter(a => a.gqlName[0] !== '_').map(a => `${a.gqlName}: ${a.gqlTypeInput}`);
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

            input ${r.name}Attributes {
                ${attributesPlain.join('\n')}
            }

            input ${r.name}Ref {
                _id: ID
                lookup: ${r.name}Attributes
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
        "Get list of ${r.gqlNamePlural}"
        ${r.gqlListQueryName}(criteria: ${r.gqlListQueryName}QueryCriteria, params: ${r.gqlListQueryName}QueryParams): [${r.gqlName}]

        "Get ${r.gqlName} by id"
        ${r.gqlGetQueryName}(_id: ID!): ${r.gqlName}
    `);

    const mutations = structure.map(r => `
        "Copy existing ${r.gqlName}"
        ${r.gqlCopyMutationName}(_id: ID!): ${r.gqlName}

        "Add new ${r.gqlName}"
        ${r.gqlAddMutationName}(attributes: ${r.name}Attributes!): ${r.gqlName}

        "Update ${r.gqlName}"
        ${r.gqlUpdateMutationName}(_id: ID!, attributes: ${r.name}Attributes!): ${r.gqlName}

        "Update many ${r.gqlNamePlural}"
        ${r.gqlUpdateManyMutationName}(criteria: ${r.gqlListQueryName}QueryCriteria!, attributes: ${r.name}Attributes!): Int

        "Delete many ${r.gqlNamePlural}"
        ${r.gqlDeleteManyMutationName}(criteria: ${r.gqlListQueryName}QueryCriteria!): Int
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

        type Mutation {
            ${mutations.join('\n')}
        }

        ${types.join('\n')}

        input Ref {
            _id: ID!
        }

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

    let result = resources.map(r => {
        return {
            name: r.name,
            gqlName: r.name,
            gqlNamePlural: toPlural(r.name),
            gqlListQueryName: r.name + 'List',
            gqlGetQueryName: r.name,
            gqlAddMutationName: 'add' + r.name,
            gqlCopyMutationName: 'copy' + r.name,
            gqlUpdateMutationName: 'update' + r.name,
            gqlUpdateManyMutationName: 'updateMany' + toPlural(r.name),
            gqlDeleteManyMutationName: 'deleteMany' + toPlural(r.name),
            apiType: r.name.toLowerCase(),
            attributes: r.attributes.attribute.map(a => {
                return {
                    name: a.name,
                    referencedType: a.referencedType,
                    gqlName: toGraphQLName(a),
                    type: a.type,
                    gqlType: toGraphQLType(a),
                    gqlTypeInput: toGraphQLTypeInput(a)
                }
            })
        }
    });

    result.forEach(r => {
        r.attributes.forEach(a => {
            if (a.referencedType) {
                a.resource = result.find(x => x.name === a.referencedType);
            }
        });
    });

    return result;
}

function toGraphQLName(attribute) {
    return attribute.name.replace(/-/, '');
}

function toPlural(val) {
    const lastIndex = val.length - 1;
    if (val[lastIndex] === 'y') {
        return val.slice(0, lastIndex) + 'ies'
    } else {
        return val + 's';
    }
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

function toGraphQLTypeInput(attribute) {
    switch(attribute.type) {
        case 'Reference':
            return attribute.referencedType + 'Ref';
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