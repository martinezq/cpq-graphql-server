
const { GraphQLScalarType } = require('graphql');

const schema = `
    input Credentials {
        user: String!
        password: String!
    }

    type AuthHeader {
        key: String!
        value: String!
    }

    type Query {
        "Check status"
        status: String

        "Generate authorization header from username and password"
        authorizationHeader(credentials: Credentials!): AuthHeader!
    }

    scalar Long
`;

const LongScalar = new GraphQLScalarType({
    name: 'Long',
    description: 'Long integer',
    serialize(value) {
      return Number(value);
    },
    parseValue(value) {
      return value;
    },
    parseLiteral(value) {
        if (ast.kind === Kind.INT) {
            return Number(ast.value, 10);
        }
    },
  });

const resolvers = {
    Query: {
        status: () => routes[path].state,
        authorizationHeader: (_, args) => generateAuthHeader(args)
    },
    LongScalar
};

function generateAuthHeader(args) {
    const { user, password } = args.credentials;
    const str = `${user}:${password}`;

    const value = Buffer.from(str).toString('base64');

    return {
        key: 'Authorization',
        value: `Basic ${value}`
    }
}

module.exports = {
    schema,
    resolvers
}