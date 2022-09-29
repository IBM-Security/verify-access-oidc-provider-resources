/**
 * Copyright contributors to the IBM Security Verify Access OIDC Provider Resources project
 */
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
 
IDMappingExtUtils.traceString("Starting CheckStatus JS");
IDMappingExtUtils.traceString("Auth Request ID: " + ciba.getAuthRequestID());
 
/**
 * What is expected to be done here:
 * - Calling the configured check status endpoint to get the latest authentication status
 *   Use http module to make http callout
 * - Populate user metadata in the case of successful authentication
 *   The metadata serve as credential attributes that can be used for grant enrichment
 *   At least the metadata should contain 'uid' claim (or claim indicated in 'subject_attribute_name')
 *   as this will be used as the 'sub' in id_token
 * - Send the status back using one of the method: pending(), failed() or success()
 */
if (ciba.getCheckStatusEndpoint() == "https://checkstatus.com?status=fail") { // for demo 
    ciba.failed(); // user rejected
} else if (ciba.getCheckStatusEndpoint() == "https://checkstatus.com?status=pass") { // for demo

    var meta = {};
    meta["uid"] = "25202QWRUA";
    meta["email"] = "asmith@test.com";
    meta["preferred_username"] = "asmith";
    meta["given_name"] = "Alex";
    meta["family_name"] = "Smith";
    ciba.success(meta); // user has been authenticated

} else {
    ciba.pending(); // waiting for user's response
}