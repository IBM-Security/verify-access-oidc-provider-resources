importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.fedmgr2.trust.util.LocalSTSClient);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);

IDMappingExtUtils.traceString("Starting Post Token JS");

var requestType = stsuu.getContextAttributes().getAttributeValueByName("request_type");

/**
 * Use this mapping rule to enrich the response.
 * In general there should not be a lot of customization here.
 * You can enrich the response parameter or header.
 * For example in FAPI there's requirement to output certain HTTP header received in the header.
 */

var interactionID = stsuu.getContextAttributes().getAttributeValueByName("x-fapi-interaction-id");
if (interactionID != null) {
    headersOverride["x-fapi-interaction-id"] = interactionID;
}