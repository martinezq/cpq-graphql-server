const public = require('../common/public-schema');

async function generateSchema(structure) {

    const types = structure.map(r => {
        const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
        const attributesPlain = r.attributes.filter(a => a.gqlName[0] !== '_' && a.gqlTypeInput !== undefined).map(a => `${a.gqlName}: ${a.gqlTypeInput}`);
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
                _organization: String
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
                _organization: String
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

        """Update many ${r.gqlNamePlural} (up to 1000 at once) \n\n
            *criteria*: server side filtering, works only for indexed attributes \n
            *filter*: implemented in middleware, slower but works for all attributes  \n
        """
        ${r.gqlUpdateManyMutationName}(criteria: ${r.gqlListQueryName}QueryCriteria!, filter: ${r.gqlListQueryName}QueryCriteria, attributes: ${r.name}Attributes!): Int

        """Delete many ${r.gqlNamePlural} (up to 1000 at once) \n\n
            *criteria*: server side filtering, works only for indexed attributes \n
            *filter*: implemented in middleware, slower but works for all attributes  \n
        """
        ${r.gqlDeleteManyMutationName}(criteria: ${r.gqlListQueryName}QueryCriteria!, filter: ${r.gqlListQueryName}QueryCriteria): Int
    `);


    const schema = `
        ${public.schema}

        enum Order {
            asc
            desc
        }

        type UserProfile {
            organization: Organization
        }

        type Organization {
            name: String
            role: [Role]
        }

        type Role {
            name: String
        }

        input UserProfileInput {
            organization: OrganizationInput
        }

        input OrganizationInput {
            name: String
            role: [RoleInput]
        }

        input RoleInput {
            name: String
        }        

        input BOMInput {
            items: [BOMItemInput]!
        }

        input BOMItemInput {
            description: String
            qty: Int
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