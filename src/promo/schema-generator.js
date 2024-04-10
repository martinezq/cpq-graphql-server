const fs = require('fs');
const public = require('../common/public-schema');

async function generateSchema() {

    const schema = `
        ${public.schema}

        type Assembly {
            id: ID
            name: String
        }

        type Query {
            listAssemblies: [Assembly]
        }

        type Mutation {
            test(_id: ID): Boolean
        }
    `;

    // console.log(schema);

    if (!fs.existsSync('out')) {
        fs.mkdirSync('out');
    }
    
    fs.writeFileSync('out/schema-promo.gql', schema);

    return schema;

}

module.exports = {
    generateSchema
}