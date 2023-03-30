importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
importClass(Packages.com.ibm.security.access.httpclient.HttpClient);

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

    /**
     * This is provided as an example how to do HTTP callout to check the authentication status
     */
    let header = new Headers();
    header.addHeader("Content-Type", "application/json");

    let resp = HttpClientV2.httpPut(ciba.getCheckStatusEndpoint(), header, {}, null, null, null, null, null, null, null, null, true, null);
    if (resp.hasError()) { // check for error

        IDMappingExtUtils.traceString("HTTP callout has error: " + resp.getError());
        ciba.pending(); // since this is polling, assume no status change, try again next time

    } else {

        IDMappingExtUtils.traceString("StatusCode: " + resp.getCode());
        IDMappingExtUtils.traceString("Body: " + resp.getBody());
    
        if (resp.getCode() == 204) {

            IDMappingExtUtils.traceString("User has been authenticated");

            /**
             * These metadata might come from the check status endpoint
             * Or might be populated using LDAP call
             */
            var meta = {};
            meta["uid"] = "25202QWRUA";
            meta["email"] = "asmith@test.com";
            meta["preferred_username"] = "asmith";
            meta["given_name"] = "Alex";
            meta["family_name"] = "Smith";
            ciba.success(meta);

        } else if (resp.getCode() == 200) {

            /**
             * Assume this means the authentication is not done
             * But for the next check, need to hit different url indicated in 'location' claim
             */
            let pl = JSON.parse(resp.getBody());
            ciba.pending(pl.location);

        } else {

            /**
             * Assume this means user has rejected the authentication
             */
            ciba.failed();

        }
    }
}