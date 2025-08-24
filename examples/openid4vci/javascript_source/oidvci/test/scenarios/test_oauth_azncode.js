const expect = require('chai').expect;

const {
    walletAznCodeFlow,
    introspectToken,
    WALLET_AZN_REQUEST_TYPE_SCOPE,
    WALLET_AZN_REQUEST_TYPE_RAR,
} = require('../oauth.js');

//
// Sample authorization_code flow based on OpenId4VCI.  This
// sample shows only the flows associated with obtain the access token as
// a wallet.  The Credential Issuer aspects are mocked.
//
describe('Test OAuth AZN Code', async function () {

    // Store wallet state in memory
    let WalletsAndToken = {};
    const walletUserName = "user1";

    WalletsAndToken[walletUserName] = {
        tokenSet: {},
        info: {},
    };

    // Mock VCI offer from a credential issuer
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
            }
        }
    };

    after(function () {
        // Nothing for now
    });

    before(async function () {
        // Nothing for now
    });

    describe('Test access tokens via scope', async function () {


        it(`Should get access token from offer as wallet holder ${walletUserName} using scope`, async function () {
            //
            // Simulate an OID4VCI authorization_code flow as a wallet
            //
            console.log("Getting access token as wallet user");
            const res = await walletAznCodeFlow(walletUserName, mockSingleCredOffer, WALLET_AZN_REQUEST_TYPE_SCOPE);
            expect(res).to.not.be.undefined;
            expect(res.access_token).to.not.be.undefined;
            expect(res.scope).to.not.be.undefined;
            expect(mockSingleCredOffer.credential_configuration_ids).to.include(res.scope);
            expect(res.c_nonce).to.not.be.undefined;
            expect(res.c_nonce_expires_in).to.not.be.undefined;

            // Simulate wallet storing the token set
            WalletsAndToken[walletUserName] = {
                tokenSet: res,
                info: {},
            };

            console.log("Completed getting access token as wallet user");

            console.log(`Wallet user state: ${JSON.stringify(WalletsAndToken[walletUserName], "", 4)}`);
            return;
        });

        it(`Should introspect token issued to wallet holder ${walletUserName} as admin`, async function () {
            console.log("Introspecting wallet access token as vcissuer");
            const res = await introspectToken(global.vcissuer.client,  WalletsAndToken[walletUserName].tokenSet);
            console.log(`Introspect result\n ${JSON.stringify(res, undefined, 4)}`);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("issuer_state");
            expect(res.issuer_state).to.equal(mockSingleCredOffer.grants.authorization_code.issuer_state);
            expect(res).to.have.property("c_nonce");
            expect(res).to.have.property("c_nonce_exp");
            return;
        });
    });


    describe('Test access tokens via RAR', async function () {


        it(`Should get access token from offer as wallet holder ${walletUserName}`, async function () {
            console.log("Getting access token as wallet user");
            const res = await walletAznCodeFlow(walletUserName, mockSingleCredOffer, WALLET_AZN_REQUEST_TYPE_RAR);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("access_token");
            expect(res).to.have.property("c_nonce");
            expect(res).to.have.property("c_nonce_expires_in");

            WalletsAndToken[walletUserName] = {
                tokenSet: res,
                info: {},
            };

            console.log("Completed getting access token as wallet user");

            console.log(`Wallet user state: ${JSON.stringify(WalletsAndToken[walletUserName], "", 4)}`);
            return;
        });

        it(`Should introspect token issued to wallet holder ${walletUserName}`, async function () {
            console.log("Introspecting wallet access token as vcissuer");
            const res = await introspectToken(global.vcissuer.client,  WalletsAndToken[walletUserName].tokenSet);
            console.log(`Introspect result\n ${JSON.stringify(res, undefined, 4)}`);
            expect(res).to.not.be.undefined;
            expect(res).to.have.property("issuer_state");
            expect(res).to.have.property("c_nonce");
            expect(res).to.have.property("c_nonce_exp");
            expect(res).to.have.property("authorization_details");
            return;
        });
    });


});
