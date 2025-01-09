const https = require('https');
const { Issuer, custom } = require('openid-client');
const { ENVIRONMENTS } = require('./environments/envs');
const {
    Agent,
    setGlobalDispatcher,
} = require('undici');

async function create_issuer_context () {
    console.log('Starting: create_issuer_context...');
    if (global.vcissuer !== undefined) {
        return;
    }

    const agent = new https.Agent({
        rejectUnauthorized: false // (NOTE: this will disable client verification)
    });

    Issuer[custom.http_options] = (url, options) => {
        return { agent: agent };
    };
    
    const agencyOp = await Issuer.discover(ENVIRONMENTS.local.opBaseBaseUrl);
    // console.log('Discovered OP %s\n %O', agencyOp.issuer, agencyOp.metadata);
    console.log('Discovered OP %s\n %O', agencyOp.issuer);

    const vcissuerClient = new agencyOp.Client({
        client_id: ENVIRONMENTS.local.vcissuer_client_id,
        client_secret: ENVIRONMENTS.local.vcissuer_client_secret,
    });

    vcissuerClient[custom.http_options] = (url, options) => {
        return { agent: agent };
    };

    const tokenSet = await vcissuerClient.grant({ 
        client_id: ENVIRONMENTS.local.vcissuer_client_id,
        client_secret: ENVIRONMENTS.local.vcissuer_client_secret,
        grant_type: "client_credentials",
    });

    console.log('Got vcissuer token set %O', tokenSet);

    const vcissuer = {
        tokenSet: tokenSet,
        client: vcissuerClient,
    };
    
    // Set global variable for admin
    global.vcissuer = vcissuer;
    console.log('Completed: create_issuer_context');
}

async function init_globals () {
    console.log('Starting: init_globals...');
    const agent = new Agent({
        connect: {
          rejectUnauthorized: false
        }
    })
      
    setGlobalDispatcher(agent)
    console.log('Completed: init_globals');
}

module.exports = {
    create_issuer_context,
    init_globals,
};
