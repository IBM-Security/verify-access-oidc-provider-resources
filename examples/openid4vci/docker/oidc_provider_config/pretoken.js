importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
/*
 * We want to set the scope based on the client identifier and grant type.  Of
 * particular concern are administrative users.
 */

var grantType = stsuu.getContextAttributes().getAttributeValueByName(
                                                    "grant_type");
var clientID  = stsuu.getContextAttributes().getAttributeValueByName(
                                                    "client_id");

IDMappingExtUtils.traceString("Starting PRE TOKEN JS");
// IDMappingExtUtils.traceString("CONTEXT ATTRIBUTES\n: " + stsuu.toString());
IDMappingExtUtils.traceString("clientID: " + clientID);
IDMappingExtUtils.traceString("grantType: " + grantType);

/*
 * If the grant type is a pre-authorized code then we need to add the
 * pre-authorized code to the token data so that it can introspected
 * by the credential issuer later.  It is likely the credential issuer
 * will need to correlate a credential offer with the pre-authorized code
 * value.
 */
if (grantType === "urn:ietf:params:oauth:grant-type:pre-authorized_code") {
    var preAuthorizedCode  = stsuu.getContextAttributes().getAttributeValueByName("pre-authorized_code");
    IDMappingExtUtils.traceString("pre-authorized_code: " + preAuthorizedCode);
    tokenData["pre-authorized_code"] = preAuthorizedCode;
}

/*
 * Next section just to demonstrate how the token data can be augmented
 * in such a way the introspections may include processing.  In this example
 * we're simply adding "vcissuer" to the scope value.
 */
const excludeAznClientCheck = new Set(["default_oid4vci_wallet"]);
if (!excludeAznClientCheck.has(clientID)) {

    const oidvcIssuerClients = new Set(["vcissuer"]);

    if (grantType == "client_credentials" && oidvcIssuerClients.has(clientID)) {
        tokenData.scope = "vcissuer";
    }
}