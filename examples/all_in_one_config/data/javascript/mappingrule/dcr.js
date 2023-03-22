importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);

IDMappingExtUtils.traceString("Starting DCR JS");

/**
 * Possible dcrAction values:
 * "create": Dynamic Client Registration Request
 * "update": Dynamic Client Update Request
 * "read"  : Dynamic Client Read Request
 * "delete": Dynamic Client Delete Request
 */
IDMappingExtUtils.traceString("DCR action is: " + dcrAction);

/**
 * What is expected to be done in this mapping rule:
 * - Set the default values for metadata that are not specified in the request.
 *   For example, if the client metadata does not specify `grant_types`,
 *   then by default the `grant_types` metadata value is the `authorization_code`.
 * - Replace or overwrite metadata values that the authorization server does not support or would like to enforce.
 *   For example, the authorization server want to enforce the `token_endpoint_auth_method` to `private_key_jwt`.
 * - Throw `invalid_client_metadata` error for metadata values that are not supported by the authorization server.
 * - Further metadata validation. For example, in OpenBanking specification, some client metadata need to be bound 
 *   by metadata inside the `software_statement`. Another example is to further check claims inside `software_statement`
 *   such as the issuer, expiry, and other claims.
 */
if (dcrAction === "create" || dcrAction === "update") {

    /**
     * Metadata claims coming from DCR request is available in the STSUU context attributes
     * These claims a
     */

    /**
     * Example of setting default value
     */
    var grant_types = stsuu.getContextAttributes().getAttributeValuesByName("grant_types");
    if (grant_types == null) {
        stsuu.addContextAttribute(new Attribute("grant_types", "urn:ibm:names:ITFIM:oauth:body:param", "authorization_code"));
    }

    /**
     * Example of validating metadata claim
     */
    var ss = stsuu.getContextAttributes().getAttributeValueByName("software_statement");
    if (ss != null) { // Software statement exists
        /**
         * Software statement claim having attribute type 'urn:ibm:names:ITFIM:oauth:ss:param'
         */
        var iss = stsuu.getContextAttributes().getAttributeValueByNameAndType("iss", "urn:ibm:names:ITFIM:oauth:ss:param");
        if (iss != "http://openbankingdirectory.com") {
            OAuthMappingExtUtils.throwSTSCustomUserMessageException("Unexpected software statement issuer.", 400, "invalid_client_metadata");
        }
    }

} else if (dcrAction === "delete") {

    // uncomment the line below to prevent DCR deletion using a JS mapping rule
    // OAuthMappingExtUtils.throwSTSAccessDeniedMessageException("Deletion is not allowed", "You are not allowed to delete a dynamic client.")

}
