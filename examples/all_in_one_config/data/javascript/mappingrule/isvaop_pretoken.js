importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);

IDMappingExtUtils.traceString("Starting Pre Token JS");

/**
 * Use this mapping rule to enrich the session:
 * - Resolve the claims requested for id_token (and userinfo)
 *   Populate resolved claims into 'idtokenData' context
 * - Adding extra claims for token introspection (and JWT access token)
 *   Populate the extra claims into 'tokenData' context
 * 
 * User Metadata:
 * Depending on the flow, user metadata may come from 'iv-jwt' or populated in
 * ROPC javascript mapping rule or by CIBA endpoints / javascript mapping rule.
 * But all the user metadata collected will be made availabe in STSUU attribute container.
 * 
 * Attribute Source:
 * The system will resolve any attribute source mappings prior to this mapping rule execution.
 * If the mapping should contain a value, it will be available in STSUU attribute container.
 * 
 * Claims to be resolved:
 * The 'claims' context contains some helper method to retrieve id_token/userinfo
 * voluntary or essential claims that need to be resolved.
 */

IDMappingExtUtils.traceString("STSUU content: " + stsuu.toString());

var requestType = stsuu.getContextAttributes().getAttributeValueByName("request_type");
var grant_type = stsuu.getContextAttributes().getAttributeValueByName("grant_type");

for (const claim of claims.getAllClaims()) {

    IDMappingExtUtils.traceString("Resolving claim: " + claim);
    if (claim == "email_verified") {
        idtokenData["email_verified"] = true;
    } else if (claim == "updated_at") {
        idtokenData["updated_at"] = Date.now();
    } else {
        /**
         * Trying to resolve the requested claim using user metadata or attribute source mapping
         * that is made available in STSUU attribute container
         */
        var value = stsuu.getAttributeContainer().getAttributeValueByName(claim);
        if (value != null) {
            idtokenData[claim] = value;
        }
    }
}

/**
 * Example of adding 'acr' and 'amr' claim based on AUTHENTICATION_LEVEL attribute
 */
var authLevel = stsuu.getAttributeValueByName("AUTHENTICATION_LEVEL");
if (authLevel == null || authLevel == "1") {
    idtokenData.amr = "password";
    idtokenData.acr = "urn:ibm:basic";
} else {
    idtokenData.amr = "mmfa";
    idtokenData.acr = "urn:ibm:mmfa";
}

if (requestType == "authorize") {
    /**
     * In OpenBanking requirement, the 'openbanking_intent_id' received in the 'claims'
     * need to appear in the id_token.
     */
    var intentId = claims.getIDTokenClaimValues("openbanking_intent_id");
    if (intentId != null && intentId != undefined) {
        idtokenData.openbanking_intent_id = intentId[0];
    }

    /**
     * Example of extra validation that can be done in this mapping rule
     */
    var state = stsuu.getContextAttributes().getAttributeValueByName("state");
    if (state != null && state.length > 255) {
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("State is too long", 400, "invalid_request");
    } 
}

/**
 * Example of enriching introspection result
 */
tokenData.groups = ["support", "user"];