const expect = require('chai').expect;

const {
    introspectToken,
    WALLET_AZN_REQUEST_TYPE_SCOPE,
    WALLET_AZN_REQUEST_TYPE_RAR,
    getPreAuthzCode,
    walletPreAznCodeFlow,
} = require('../oauth.js');

// HTTP server acts as the service that received the "txCode" notification
// from the OP.  This simulates out-of-band delivery of the txCode to the user
// during pre-authorized_code flow.
const httpserver = require('../httpserver');

describe('Test OAuth Pre-Authz Code', async function () {

    let AgentsAndTokens = {};
    const walletUserName = "user1";

    // set initial state for wallet user
    AgentsAndTokens[walletUserName] = {
        tokenSet: {},
        info: {},
    };

    before(async function () {
        // Start a simple HTTP server to act as the tx_code delivery
        // address handler
        console.log("Starting OAuth Pre-Authz before  ... ");
        // This http endpoint receives the tx_code delivery
        await httpserver.listen();
        console.log("Completed OAuth Pre-Authz before  ... ");
    });

    after(function () {
        httpserver.close();
    });

    describe('Test get token via pre-authorization_code and RAR', async function () {
        const mockSingleCredOffer = {
            credential_issuer: "https://vcissuer.com/v1.0/oidvc/vci/f0eb3ed9-d44f-4a67-8da5-115bcdcc537c",
            credential_configuration_ids: [
                "ldp_vc:bf1e55fe-df56-44fb-9cd8-b066060a9f92"
            ],
            grants: {
                authorization_code: {
                    authorization_server: "https://isvaopgw:8443/oauth2",
                    issuer_state: "4108ac0b-a016-49db-8cf8-b9c18fdcdba1",
                    client_id: "default_oid4vci_wallet"
                },
                "urn:ietf:params:oauth:grant-type:pre-authorized_code": undefined,  // will be set after we get the pre-auth code from the OP
            }
        };
    
        it(`Should get pre authorization code from OP as cred issuer`, async function () {
            const body = {
                "type": "cred_issuer_assertion",
                "sub": walletUserName,
            };
        
            const res = await getPreAuthzCode(body);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("statusCode");
            expect(res).to.have.property("data");
            expect(res.statusCode).to.equal(200);
            expect(res.data).to.have.property("pre-authorized_code");
            expect(res.data).to.have.property("tx_code");
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'] = res.data;
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].authorization_server = "https://isvaopgw:8443/oauth2",
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].issuer_state = "4108ac0b-a016-49db-8cf8-b9c18fdcdba1",


            console.log(`\nCredential offer:`);
            console.log(`${JSON.stringify(mockSingleCredOffer, undefined, 4)}`);
            return;
        });

        it(`Should get access token using pre-authorized_code flow`, async function () {
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.not.be.undefined;
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.have.property("pre-authorized_code");
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.have.property("tx_code");
            const currentTxCode = httpserver.getCurrentTxCode();
            expect(currentTxCode).to.not.be.undefined;
            expect(currentTxCode).to.have.property("txCode");
            console.log(`\n\nGot tx_code value: ${currentTxCode.txCode}\n\n`);
            if (mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].tx_code.length) {
                expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].tx_code.length).to.equal(currentTxCode.txCode.length);
            }

            const res = await walletPreAznCodeFlow(currentTxCode.txCode, mockSingleCredOffer, WALLET_AZN_REQUEST_TYPE_RAR);
            expect(res.statusCode).to.equal(200);
            expect(res).to.have.property("data");
            expect(res.data).to.have.property("access_token");
            expect(res.data).to.have.property("authorization_details");
            expect(res.data).to.have.property("c_nonce");
            expect(res.data).to.have.property("c_nonce_expires_in");
            expect(res.data.authorization_details).to.have.lengthOf(1);
            expect(res.data.authorization_details[0]).to.have.property("credential_configuration_id");
            expect(res.data.authorization_details[0]).to.have.property("type");
            expect(mockSingleCredOffer.credential_configuration_ids).to.include(res.data.authorization_details[0].credential_configuration_id);
            expect(res.data.authorization_details[0].type).to.have.equal("openid_credential");

            AgentsAndTokens[walletUserName] = {
                tokenSet: res.data,
                info: {},
            };
            
            console.log(`Token response: \n${JSON.stringify(res, undefined, 4)}`);
        });


        it(`Should introspect token issued to wallet holder ${walletUserName} as admin`, async function () {
            console.log("Introspecting wallet access token as vcissuer");
            const res = await introspectToken(global.vcissuer.client,  AgentsAndTokens[walletUserName].tokenSet);
            console.log(`Introspect result\n ${JSON.stringify(res, undefined, 4)}`);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("c_nonce");
            expect(res).to.have.property("authorization_details");
            expect(res).to.have.property("c_nonce_exp");
            expect(res).to.have.property("pre-authorized_code");
            expect(res.c_nonce).to.equal(AgentsAndTokens[walletUserName].tokenSet.c_nonce);
            expect(res.sub).to.equal(walletUserName);
            expect(res.authorization_details[0].credential_configuration_id).to.equal(AgentsAndTokens[walletUserName].tokenSet.authorization_details[0].credential_configuration_id);
            expect(res.authorization_details[0].type).to.equal(AgentsAndTokens[walletUserName].tokenSet.authorization_details[0].type);
            return;
        });
    });


    describe('Test get token via pre-authorization_code and scopes', async function () {
        const mockSingleCredOffer = {
            credential_issuer: "https://vcissuer.com/v1.0/oidvc/vci/f0eb3ed9-d44f-4a67-8da5-115bcdcc537c",
            credential_configuration_ids: [
                "2:ldp_vc:bf1e55fe-df56-44fb-9cd8-b066060a9f92"
            ],
            grants: {
                authorization_code: {
                    authorization_server: "https://isvaopgw:8443/oauth2",
                    issuer_state: "1daf27c9-0f96-4853-ac9f-e65493908372",
                    client_id: "default_oid4vci_wallet"
                },
                "urn:ietf:params:oauth:grant-type:pre-authorized_code": undefined,
            }
        };
    
        it(`Should get pre authorization code from OP as cred issuers`, async function () {
            const body = {
                "type": "cred_issuer_assertion",
                "sub": walletUserName,
                "status":"cred_issuer_assertion",
            };
        
            const res = await getPreAuthzCode(body);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("statusCode");
            expect(res).to.have.property("data");
            expect(res.statusCode).to.equal(200);
            expect(res.data).to.have.property("pre-authorized_code");
            expect(res.data).to.have.property("tx_code");
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'] = res.data;
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].authorization_server = "https://isvaopgw:8443/oauth2",
            mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].issuer_state = "1daf27c9-0f96-4853-ac9f-e65493908372",


            console.log(`\nCredential offer:`);
            console.log(`${JSON.stringify(mockSingleCredOffer, undefined, 4)}`);
            return;
        });

        it(`Should get access token using pre-authorized_code flow`, async function () {
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.not.be.undefined;
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.have.property("pre-authorized_code");
            expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).to.have.property("tx_code");
            const currentTxCode = httpserver.getCurrentTxCode();
            expect(currentTxCode).to.not.be.undefined;
            expect(currentTxCode).to.have.property("txCode");
            console.log(`\n\nGot tx_code value: ${currentTxCode.txCode}\n\n`);
            if (mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].tx_code.length) {
                expect(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].tx_code.length).to.equal(currentTxCode.txCode.length);
            }

            const res = await walletPreAznCodeFlow(currentTxCode.txCode, mockSingleCredOffer, WALLET_AZN_REQUEST_TYPE_SCOPE);
            expect(res.statusCode).to.equal(200);
            expect(res).to.have.property("data");
            expect(res.data).to.have.property("access_token");
            expect(res.data).to.have.property("scope");
            expect(res.data).to.have.property("c_nonce");
            expect(res.data).to.have.property("c_nonce_expires_in");
            expect(mockSingleCredOffer.credential_configuration_ids).to.include(res.data.scope);

            AgentsAndTokens[walletUserName] = {
                tokenSet: res.data,
                info: {},
            };
            
            console.log(`Token response: \n${JSON.stringify(res, undefined, 4)}`);
        });


        it(`Should introspect token issued to wallet holder ${walletUserName} as admin`, async function () {
            console.log("Introspecting wallet access token as vcissuer");
            const res = await introspectToken(global.vcissuer.client,  AgentsAndTokens[walletUserName].tokenSet);
            console.log(`Introspect result\n ${JSON.stringify(res, undefined, 4)}`);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("c_nonce");
            expect(res).to.have.property("scope");
            expect(res).to.have.property("c_nonce_exp");
            expect(res).to.have.property("pre-authorized_code");
            expect(res.c_nonce).to.equal(AgentsAndTokens[walletUserName].tokenSet.c_nonce);
            expect(res["pre-authorized_code"]).to.equal(mockSingleCredOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']["pre-authorized_code"]);
            expect(res.sub).to.equal(walletUserName);
            return;
        });
    });
});
