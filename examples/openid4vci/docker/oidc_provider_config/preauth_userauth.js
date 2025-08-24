importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
importClass(Packages.com.ibm.security.access.httpclient.HttpClient);

IDMappingExtUtils.traceString("JS: ENTERED PREAUTH_USERAUTH::");
var payload = preauth.getPayload();
IDMappingExtUtils.traceString("payload: " + JSON.stringify(payload));
IDMappingExtUtils.traceString("CallbackURL::" + preauth.getCallbackURL());
if (payload["type"] === "cred_issuer_assertion") {
    var subject = payload.sub;
    if (subject === undefined || subject === "") {
        IDMappingExtUtils.traceString("denied due to missing subject fromcred_issuer_assertion");
        preauth.denied();
    } else {
        var metadata = {};
        metadata.uid = (payload.sub ? payload.sub : "prabbit");
        metadata.given_name = "peter";
        metadata.family_name = "rabbit";
        metadata.preferred_username = "peter@zoo.org";
        preauth.approved(metadata);
    }
} else if(payload["type"] === "externalHttpAuth") {
    // this path represents an option whereby the 
    // credential issuer is indicating that this handler should "authorize" the user
    // by some external service
    var headers = new Headers();

    headers.addHeader('Content-Type','application/json');
    var payload = preauth.getPayload();
    // the "callbackURL" is included in the payload to the external authorization
    // service.  The URL should be used by the external service to re-enter this handler.
    // On re-entry, the "if (preauth.isCallback())" path will be executed
    payload["callbackURL"] = preauth.getCallbackURL()
    IDMappingExtUtils.traceString("payload: " + JSON.stringify(payload));

    let resp = HttpClientV2.httpPost("http://localhost:8080/userauth", headers, JSON.stringify(payload), null, null, null, null, null, null, null, null, true, null)
    if (resp.hasError()) {//getError
        IDMappingExtUtils.traceString("resp.getError(): " + resp.getError());
    } else {
        IDMappingExtUtils.traceString("StatusCode: " + resp.getCode());
        if(resp.getCode() == 200){
            IDMappingExtUtils.traceString("hERE: ");
            var metadata = {};
            metadata.uid = "prabbit";
            metadata.given_name = "peter";
            metadata.family_name = "rabbit";
            metadata.preferred_username = "peter@zoo.org";
            IDMappingExtUtils.traceString("approved: ");
            preauth.approved(metadata);
        }
    }
} else {
    if (preauth.isCallback()) {
        if (payload.status === "approved") {
            var metadata = {};
            metadata.uid = "prabbit";
            metadata.given_name = "peter";
            metadata.family_name = "rabbit";
            metadata.preferred_username = "peter@zoo.org";
            preauth.approved(metadata);
        } else if (payload.status === "denied") {
            IDMappingExtUtils.traceString("denied " );
            preauth.denied();
        } else {
            OAuthMappingExtUtils.throwSTSCustomUserMessageException("Expecting authentication status", 400, "invalid_request");
        }
    } else {
        if (payload.status === "denied"){
            IDMappingExtUtils.traceString("denied " );
            preauth.denied();
        } else {
            IDMappingExtUtils.traceString("pending " );
            IDMappingExtUtils.traceString("CallbackURL:::" + preauth.getCallbackURL() + ':::');
            preauth.pending();
        }
    }
}