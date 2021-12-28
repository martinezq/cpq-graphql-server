const tickets = require('./cpq-admin-tickets');
const objects = require('./cpq-ds-object');

// ----------------------------------------------------------------------------

const resolvers = {
    Query: {
        //tickets: tickets.list,
        // accounts: objects.list
    },
    //Mutation: {
        //addTicket: () => console.log('test')
    //}
};

// ----------------------------------------------------------------------------

module.exports = resolvers;