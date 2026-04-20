const {
    init_globals,
    create_issuer_context,
} = require('./test_setup');

exports.mochaHooks = {
    beforeAll: async function () {
        console.log('Starting: beforeAll...');
        await init_globals();
        await create_issuer_context();
        console.log('Completed: beforeAll...');
    }
};
