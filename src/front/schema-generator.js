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

        input Credentials {
            user: String!
            password: String!
        }

        type AuthHeader {
            key: String!
            value: String!
        }

        type Query {
            status: String
            authorizationHeader(credentials: Credentials!): AuthHeader
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

module.exports = {
    generateSchema
}