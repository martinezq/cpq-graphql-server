const fs = require('fs');
const public = require('../common/public-schema');

async function generateSchema(structure) {

    const types = structure.map(r => {
        const attributes = r.attributes.map(a => `${a.gqlName}: ${a.gqlType}`);
        const attributesPlain = r.attributes.filter(a => a.gqlName[0] !== '_' && a.gqlTypeInput !== undefined).map(a => `${a.gqlName}: ${a.gqlTypeInput}`);
        const searchableAttributesPlain = r.attributes.filter(a => a.searchable).filter(a => a.gqlName[0] !== '_' && a.gqlTypeInput !== undefined).map(a => `${a.gqlName}: ${a.gqlTypeInput}`);
        const attributeNames = r.attributes.map(a => `${a.gqlName}`);
        const transitionIds = r.transitions.map(t => t.gqlId);
        const transitionNames = r.transitions.map(t => t.gqlName);

        return `
            enum ${r.gqlListQueryName}QuerySortBy {
                ${attributeNames.join('\n')}
            }

            enum ${r.gqlName}TransitionId {
                ${transitionIds.length > 0 ? transitionIds.join('\n') : '_NO_TRANSITIONS'}
            }

            enum ${r.gqlName}TransitionName {
                ${transitionNames.length > 0 ? transitionNames.join('\n') : '_NO_TRANSITIONS'}
            }

            input ${r.gqlListQueryName}QueryParams {
                limit: Int
                offset: Int
                page: Int
                sort: ${r.gqlListQueryName}QuerySortBy
                order: Order
                from: String
                to: String
            }

            input MassMutationQueryParams {
                from: String
                to: String
            }


            input ${r.gqlListQueryName}QueryCriteria {
                ${searchableAttributesPlain.length > 0 ? searchableAttributesPlain.join('\n') : '_no_searchable_attributes: Int'}
            }

            input ${r.gqlListQueryName}FilterCriteria {
                _organization: String
                _state: String
                _text: String
                ${attributesPlain.join('\n')}
            }

            input ${r.gqlName}Selector {
                criteria: ${r.gqlListQueryName}QueryCriteria!
                filter: ${r.gqlListQueryName}FilterCriteria
            }

            input ${r.name}Attributes {
                _organization: String
                ${attributesPlain.join('\n')}
            }

            input ${r.name}Ref {
                _id: ID
                lookup: ${r.name}Attributes
            }

            input ${r.gqlName}TransitionArgument {
                id: ${r.gqlName}TransitionId
                ids: [${r.gqlName}TransitionId]
                name: ${r.gqlName}TransitionName
                names: [${r.gqlName}TransitionName]
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
                _stateId: Int
                ${attributes.join('\n')}
                ${r.name === 'ConfiguredProduct' ? 'bomStructure: BomStructure' : ''}
                _expressionResult: String
            }
        `;
    });

    const queries = structure.map(r => `
        "Get list of ${r.gqlNamePlural}"
        ${r.gqlListQueryName}(criteria: ${r.gqlListQueryName}QueryCriteria, filter: ${r.gqlListQueryName}FilterCriteria, params: ${r.gqlListQueryName}QueryParams, expression: String): [${r.gqlName}]

        "Get ${r.gqlName} by id"
        ${r.gqlGetQueryName}(_id: ID!): ${r.gqlName}
    `);

    const mutations = structure.map(r => `
        "Copy existing ${r.gqlName}"
        ${r.gqlCopyMutationName}(_id: ID!): ${r.gqlName}

        "Add new ${r.gqlName}"
        ${r.gqlAddMutationName}(attributes: ${r.name}Attributes!): ${r.gqlName}

        "Add new ${r.gqlName} if doesn't exist already (works bad with cache - use with caution)"
        ${r.gqlAddIfDoesntExistMutationName}(check: ${r.gqlName}Ref, attributes: ${r.name}Attributes!): ${r.gqlName}


        "Update ${r.gqlName}"
        ${r.gqlUpdateMutationName}(_id: ID!, attributes: ${r.name}Attributes!): ${r.gqlName}

        ${r.gqlTransitionMutationName}(_id: ID!, transition: ${r.gqlName}TransitionArgument!, opts: MassOperationOptions): MassOperationStatus

        """Update many ${r.gqlNamePlural} (up to 1000 at once) \n\n
            *params*: server side params \n
            *criteria*: server side filtering, works only for indexed attributes \n
            *filter*: implemented in middleware, slower but works for all attributes  \n
        """
        ${r.gqlUpdateManyMutationName}(params: MassMutationQueryParams, criteria: ${r.gqlListQueryName}QueryCriteria!, filter: ${r.gqlListQueryName}FilterCriteria, opts: MassOperationOptions, attributes: ${r.name}Attributes!): MassOperationStatus

        """Delete many ${r.gqlNamePlural} (up to 1000 at once) \n\n
            *criteria*: server side filtering, works only for indexed attributes \n
            *filter*: implemented in middleware, slower but works for all attributes  \n
        """
        ${r.gqlDeleteManyMutationName}(criteria: ${r.gqlListQueryName}QueryCriteria!, filter: ${r.gqlListQueryName}FilterCriteria, opts: MassOperationOptions): MassOperationStatus

        """Transition many ${r.gqlNamePlural} (up to 1000 at once) \n\n
        *criteria*: server side filtering, works only for indexed attributes \n
        *filter*: implemented in middleware, slower but works for all attributes  \n
        """
        ${r.gqlTransitionManyMutationName}(
            selector: ${r.gqlName}Selector,
            transition: ${r.gqlName}TransitionArgument!,
            opts: MassOperationOptions
        ): MassOperationStatus

    `);

//            // 
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

        input MassOperationOptions {
            ignoreErrors: Boolean,
            parallel: Int
        }

        type Query {
            status: String
            authorizationHeader(credentials: Credentials!): AuthHeader
            ${queries.join('\n')}
        }

        type Mutation {
            ${mutations.join('\n')}
            recalculatePricing(_id: ID!): Boolean
            configureSolutionProducts(_id: ID!): Boolean
        }

        type MassOperationStatus {
            totalCount: Int
            successCount: Int
            errorCount: Int
            errors: [String]
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

        type BomStructure {
            items: [BomItem]
        }

        type BomItem {
            attributes: [BomAttribute]
            items: [BomItem]
        }

        type BomAttribute {
            name: String
            value: String
        }
    `;

    // console.log(schema);

    if (!fs.existsSync('out')) {
        fs.mkdirSync('out');
    }
    
    fs.writeFileSync('out/schema.gql', schema);

    return schema;

}

module.exports = {
    generateSchema
}