const { Issuer, custom } = require('openid-client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const https = require('https');
const { ENVIRONMENTS } = require('./environments/envs');
const jose = require('jose');
const { join } = require('lodash');

const WALLET_AZN_REQUEST_TYPE_SCOPE = "scope";
const WALLET_AZN_REQUEST_TYPE_RAR = "rar";


function buildRarDetails(credentialOfferPayload) {
    const result = [];
    for (const id of credentialOfferPayload.credential_configuration_ids) {
        const aznDetailsObj = {
            type: "openid_credential",
            credential_configuration_id: id,
        }
        result.push(aznDetailsObj);
    }

    return result;
};


/**
 * Perform the AZN code flow as a wallet.  Uses the grant and OP information in the
 * OID4VCI cred offer to drive the flow.
 */
async function walletAznCodeFlow(walletUserName, credentialOfferPayload, aznRequestType) {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false // (NOTE: this will disable TLS verification)
    });

    Issuer[custom.http_options] = (url, options) => {
        return { agent: httpsAgent };
    };
    
    // OP metadata discovery and instantiate the RP client.
    const agencyOp = await Issuer.discover(credentialOfferPayload.grants.authorization_code.authorization_server);
    console.log('Discovered OP %s', agencyOp.issuer);

    // Get set to invoke the /authorize endpoint
    // Note we pulling the wallets client_id from the credential
    // offer.  This is not complaint with the OID4VCI spec.  
    const walletClient = new agencyOp.Client({
        client_id: credentialOfferPayload.grants.authorization_code.client_id,
        redirect_uris: ['openid-credential-offer://'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',         // no client authentication for "untrusted" wallet/public client
    });

    walletClient[custom.http_options] = (url, options) => {
        return { agent: httpsAgent };
    };

    // Get the authorization URL for this grant.
    // e.g. https://isvaopgw:8443/oauth2/authorize?client_id=default_oid4vci_wallet&scope=2%3Ajsonld%3A6d210eb0-47df-42e2-8e73-8a9548be187b&
    // response_type=code&redirect_uri=openid-credential-offer%3A%2F%2F&issuer_state=d45c381a-445b-4531-b5d5-ff54989f0740

    let body = `client_id=default_oid4vci_wallet`;
    body += `&response_type=code`;
    body += `&redirect_uri=openid-credential-offer://`;
    body += `&state=teststate`;
    body += `&issuer_state=${credentialOfferPayload.grants.authorization_code.issuer_state}`;
    if (aznRequestType === WALLET_AZN_REQUEST_TYPE_RAR) {
        // setup authorization_details parameter if we're doing RAR
        const rar = buildRarDetails(credentialOfferPayload);
        body += `&authorization_details=${encodeURIComponent(`${JSON.stringify(rar)}`)}`;
    } else {
        body += `&scope=${join(credentialOfferPayload.credential_configuration_ids, ', ')}`;
    }

    const aznUrl = `${agencyOp.authorization_endpoint}?${body}`;

    // simulate authenticated user using iv-jwt header.
    const fetchParams = {
        method: "GET",
        headers: {
            "iv-jwt": (await createUnsecuredIvJwt(walletUserName)),
        }
    };
    console.log(`\nGET ${aznUrl}\n`);
    console.log(`${JSON.stringify(fetchParams, undefined, 4)}\n`);

    // Now invoke the /authorize endpoint to get the code.
    // We use the "iv-jwt" hack to simulate an authenticated user at the 
    // /authorize endpoint.  In PROD deployments, our OP will
    // be protected by webseal which will handle this.
    const res = await fetch(aznUrl, {
        ...fetchParams,
        agent: httpsAgent,
        redirect: 'manual',
    });

    console.log(`AZN response location: '${res.headers.get('location')}`);

    console.log(`Response ${aznUrl}\n`);
    console.log(`${JSON.stringify(res, undefined, 4)}\n`);

    // AZN code flow needs to redirect to our RP as the wallet backend.  The RP
    // then uses the code, embedded in the location redirect header, to get an
    // access token.
    console.log(`AZN response location: '${res.headers.get('location')}`);
    const url = new URL(res.headers.get('location'));
    const params = new URLSearchParams(url.search);
    const aznCode = params.get('code');
    console.log(`AZN code: '${aznCode}`);

    // Now get the access token using the code.  Example token response:
    // {
    //   access_token: 'eyJhbGciOiJSU...jlY-4Yi5g',   pragma: allowlist secret
    //   c_nonce: 1727320116666,
    //   expires_at: 1727327318,
    //   scope: '2:jsonld:6d210eb0-47df-42e2-8e73-8a9548be187b',
    //   token_type: 'bearer'
    // }
    const tokenSet = await walletClient.grant({ 
        client_id: credentialOfferPayload.grants.authorization_code.client_id,
        grant_type: "authorization_code",
        code: aznCode,
        redirect_uri: 'openid-credential-offer://',
    });
    console.log('Got agent token set %O', tokenSet);
    await jwtDecode(tokenSet.access_token);
    return tokenSet;
}

async function walletPreAznCodeFlow(txCode, credentialOfferPayload, aznRequestType) {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false // (NOTE: this will disable client verification)
    });

    Issuer[custom.http_options] = (url, options) => {
        return { agent: httpsAgent };
    };
    
    // OP metadata discovery and instantiate the RP client.
    const agencyOp = await Issuer.discover(credentialOfferPayload.grants["urn:ietf:params:oauth:grant-type:pre-authorized_code"].authorization_server);
    console.log('Discovered OP %s', agencyOp.issuer); // , agencyOp);

    const tokenUrl = agencyOp.token_endpoint;

    const rar = buildRarDetails(credentialOfferPayload);

    let body = `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code`;
    body += `&client_id=default_oid4vci_wallet`;
    //body += `&client_secret=secret`;
    body += `&redirect_uri=openid-credential-offer://`;
    // body += `&scope=openid`;
    body += `&pre-authorized_code=${encodeURIComponent(credentialOfferPayload.grants["urn:ietf:params:oauth:grant-type:pre-authorized_code"]["pre-authorized_code"])}`;
    body += `&tx_code=${txCode}`;
    if (aznRequestType === WALLET_AZN_REQUEST_TYPE_RAR) {
        body += `&authorization_details=${encodeURIComponent(`${JSON.stringify(rar)}`)}`; // `&authorization_details=${JSON.stringify(rar)}`;
    } else {
        body += `&scope=${encodeURIComponent(join(credentialOfferPayload.credential_configuration_ids, ', '))}`;
    }

    // console.log(`Going to open url ${tokenUrl}`);
    // console.log(`Body to be sent: ${body}`);
    const fetchParams = {
        method: "POST",
        body,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    };
    console.log(`\nPOST ${tokenUrl}`);
    console.log(`${JSON.stringify(fetchParams, undefined, 4)}\n`);

    // Now invoke the /authorize endpoint to get the code.
    const res = await fetch(tokenUrl, {
        ...fetchParams,
        agent: httpsAgent,
        redirect: 'manual',
    });

    console.log(`Response (${res.status}) ${tokenUrl}`);
    const data = await res.json();
    if (res.status === 200) {
        console.log(`${JSON.stringify(data, undefined, 4)}\n`);
    }
    return {
        statusCode: res.status,
        data,
    };
}

async function introspectToken(oauthClient, tokenSet) {
    console.log(`About to introspect token ${tokenSet.access_token}\n`);
    result = await oauthClient.introspect(tokenSet.access_token);
    return result;
}

async function createUnsecuredIvJwt(username) {
    const unsecuredJwt = new jose.UnsecuredJWT({ uid: username })
    .setIssuedAt()
    .setIssuer('urn:IVIDC:devtest:issuer')
    .setAudience('urn:example:audience')
    .setExpirationTime('2h')
    .encode();
  
    console.log(`Created iv-jwt: ${JSON.stringify(unsecuredJwt, "", 4)})`);

    return unsecuredJwt;
}

async function createUnsecuredPreAuthConsumerJwt(uid) {
    const unsecuredJwt = new jose.UnsecuredJWT({ oidvcissuer: uid })
    .setIssuedAt()
    .setIssuer('urn:oid4vci:issuer')
    .setAudience('urn:isvaopgw:lua:handler')
    .setExpirationTime('2h')
    .encode();
  
    console.log(`Created X-Preauth-Consumer-Jwt: ${JSON.stringify(unsecuredJwt, "", 4)})`);

    return unsecuredJwt;
}

async function jwtDecode(jwt) {
    console.log(`About to decode jwt '${jwt}'`);
    const claims = jose.decodeJwt(jwt);

    console.log(`Decoded '${JSON.stringify(claims, "", 4)}`);

    return claims;
}

// This simulates the cred issuer getting a pre auth code from
// the OP
async function getPreAuthzCode(body, vcIssuerId) {
    const preAuthzEp = `${ENVIRONMENTS.local.opBaseBaseUrl}/preauth`;
    const params = {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Preauth-Consumer-Jwt': createUnsecuredPreAuthConsumerJwt(vcIssuerId),
        },    
        agent: getHttpsAgent(),
    };

    console.log(`Call ${preAuthzEp}\n${JSON.stringify(params, undefined, 4)}`);

    const res = await fetch(preAuthzEp, params);
    const data = await res.json();

    console.log(`\nResponse ${preAuthzEp} (${res.status})\n${JSON.stringify(data, undefined, 4)}`);

    return {
        statusCode: res.status,
        data: data
    };
}

function getHttpsAgent() {
    const agent = new https.Agent({
        rejectUnauthorized: false // (NOTE: this will disable client verification)
    });

    return agent;
}

module.exports = {
    jwtDecode: jwtDecode,
    createUnsecuredIvJwt: createUnsecuredIvJwt,
    createUnsecuredPreAuthConsumerJwt: createUnsecuredPreAuthConsumerJwt,
    walletAznCodeFlow: walletAznCodeFlow,
    introspectToken: introspectToken,
    WALLET_AZN_REQUEST_TYPE_SCOPE: WALLET_AZN_REQUEST_TYPE_SCOPE,
    WALLET_AZN_REQUEST_TYPE_RAR: WALLET_AZN_REQUEST_TYPE_RAR,
    getPreAuthzCode: getPreAuthzCode,
    walletPreAznCodeFlow: walletPreAznCodeFlow,
};

