importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
importClass(Packages.com.ibm.security.access.httpclient.HttpClient);
importClass(Packages.com.ibm.security.access.user.UserLookupHelper);

/**
 * What is expected to be done in this javascript:
 * - Based on user hint, retrieve more information about this user, such as:
 *    + Notification preference
 *    + User device information
 *    + Email or phone number
 * - Validate the incoming user_code (if any)
 * - Validate whether binding_message is acceptable (when notifying user via sms vs email may have different requirement)
 * - Decide the type of authenticator used, and notify the user. Some of the possible scenarios are:
 *    + When using internal authenticator, send the user authorization endpoint as part of the notification message to the user.
 *      The notification message may depend on notification preference such as email or sms.
 *    + When using external authenticator with check status endpoint, make a call to the external authenticator
 *      with user information to be notified and expect the external authenticator returns with the URL to check the status.
 *      Set this URL in the ExternalAuthenticatorWithCheckStatusEndpoint() object.
 *    + When using external authenticator without check status endpoint, make a call to the external authenticator
 *      with user information to be notified, along with the status update endpoint and bearer token to be used.
 *      The expectation here, the external authenticator will do a callback to the status update endpoint once the authentication is done.
 */


/**
 * valid the auth request here
 * @param username
 * @param bindMsg
 * @param userCode
 */
function validateAuthRequest(username, bindMsg, userCode) {
    /*
    TODO: implement auth request validation here
     */
    let isInvalidBindMsg = false;
    let isInvalidUserCode = false;

    if (isInvalidBindMsg) {
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Invalid binding", 400, "invalid_binding_message");
    }
    if (isInvalidUserCode) {
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Invalid user code", 400, "invalid_user_code");
    }
}


/**
 * get user mobile number from ldap
 * @param userId
 * @returns string
 */
function getMobileNumberFromLdap(userId) {
    let ulh = new UserLookupHelper("ldap");
    if (!ulh.init()) {
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Ldap server failure", 500, "server_error");
    }
    let user = ulh.getUser(userId);
    if (user.hasError()) {
        // TODO: handle error here
        OAuthMappingExtUtils.throwSTSCustomUserMessageException(user.getError(), 400, "invalid_request");
    }
    let mobile = user.getAttribute("mobile");

    // TODO: mobile number validation
    if (mobile === undefined || mobile == null || mobile === "") {
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Invalid mobile number", 400, "invalid_request");
    }

    return mobile;
}

/**
 * Send sms message
 * @param username
 * @param phone
 * @param message
 */
function smsKickoff(username, phone, message) {
    // SMS is sent directly to a gateway with a HTTP call.
    // The format will be dependent on particular SMS gateway
    // TODO: implement base on the particular SMS gateway going to be used
    let smsGatewayURL = "http://smsGateway:8080";
    let fromNumber = "+12345678";

    //from = +12345678, to = $DEST_NO$, message = $MSG$
    let headers = new Headers();
    headers.addHeader("Accept", "application/json");
    let params = new Parameters();
    params.addParameter("from", "+12345678");
    params.addParameter("to", phone);
    params.addParameter("message", getBindingMessageWithLink(deviceFlowState));

    let header = new Headers();
    header.addHeader("Accept", "application/json");

    let payload = {
        "from": fromNumber,
        "to": phone,
        "message": message
    }

    let resp = HttpClientV2.httpPost(smsGatewayURL, header, JSON.stringify(payload), null, null, null, null, null, null, null, null, true, null);
    if (resp.hasError()) {
        // TODO: handle error here
        OAuthMappingExtUtils.throwSTSCustomUserMessageException(resp.getError(), 400, "invalid_request");
    } else if (resp.getCode() !== 201) {
        // TODO: handle error here
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Failed to send sms to phone: " + phone, 400, "invalid_request");
    } else {
        IDMappingExtUtils.traceString("Sending SMS worked for phone: " + phone);
    }
}

/**
 * Send notification to start internal auth
 *
 * @param username
 * @param phone
 */
function internalAuthNotify(username, phone) {
    /**
     * Below is a sample flow to notify user using SMS
     * TODO: update the sample implementation as needed
     */
    let userAuthorizeEndpoint = ciba.getUserAuthorizeEndpoint();
    let message = "Use this link to login: " + userAuthorizeEndpoint;
    smsKickoff(username, phone, message);

    ciba.setAuthenticator(new InternalAuthenticator());
}

/**
 * Send notification to start external auth using an external auth server
 *
 * @param username
 * @param phone
 */
function externalAuthNotify(username, phone) {
    /**
     * Below is a sample flow
     * TODO: update the sample implementation as needed
     */

    let authServerBaseUrl = "https://externalAuthServer:8080";
    let authRequestId = ciba.getAuthRequestID(); // stsuu.getContextAttributes().getAttributeValueByName("requestId");
    let statusUpdateEndpoint = ciba.getStatusUpdateEndpoint();
    let bearerToken = ciba.getBearerToken();

    /**
     * Notify the external auth server there is a new auth request
     * The external auth server can have it own mechanism to notify user about the auth request
     * If the auth server cannot notify user about the new auth request, notify user can be done in this JavaScript.
     * Please refer the Optional section
     *
     * Sample payload to notify the external auth server.
     * TODO: update the payload accordingly base on the auth server going to be used
     *
     * @param authReqId the auth request id
     * @param statusUpdateEndpoint allows the external auth server to notify isva oidc provider about the auth result
     * @param bearerToken the external auth server need to provider the bear token in to request Authorization header
     *                    when notifying isva oidc provider about the auth result
     * @param username the username to login (login hint)
     *
     */
    let externalAuthNotificationEndpoint = authServerBaseUrl + "/authRequest";
    let header = new Headers();
    header.addHeader("Content-Type", "application/json");
    let payload = {
        "authReqId": authRequestId,
        "statusUpdateEndpoint": statusUpdateEndpoint,
        "bearerToken": bearerToken,
        "username": username
    }
    let resp = HttpClientV2.httpPost(externalAuthNotificationEndpoint, header, JSON.stringify(payload), null, null, null, null, null, null, null, null, true, null)
    if (resp.hasError()) {//getError
        // TODO: handle error here
        OAuthMappingExtUtils.throwSTSCustomUserMessageException(resp.getError(), 400, "invalid_request");
    } else if (resp.getCode() !== 201) {
        // TODO: handle error here
        OAuthMappingExtUtils.throwSTSCustomUserMessageException("Failed to connect to external auth server", 400, "invalid_request");
    }

    /**
     * Optional
     * Notify the user using SMS instead of letting the auth server to notify the user
     * TODO: update the sample notify user as needed
     */
    // let externalAuthEndpoint = authServerBaseUrl + "/authEndpoint?authReqId=" + authRequestId + "&username=" + username;
    // let message = "Use this link to login: " + externalAuthEndpoint;
    // smsKickoff(username, phone, message);

    ciba.setAuthenticator(new ExternalAuthenticator());
}

/**
 * When it comes from 'login_hint', it will be available under attribute 'sub'.
 * An 'id_token_hint' likely will have 'sub' as well.
 * However 'login_hint_token' is a free-format JWT, so it may not contain 'sub'.
 * Tips: print the STSUU to find out what information is available from the hint.
 *
 * For 'login_hint' or 'id_token_hint', at this point, the system has validate the signature of JWT.
 * Further claims such as 'exp' or 'iss' can be validated here if necessary.
 */
IDMappingExtUtils.traceString("STSUU: " + stsuu.toString());
let hint = stsuu.getAttributeValueByName("sub");

/**
 * Based on the hint, may want to load the user information here.
 * There are LDAP utility or UserLookupHelper that can be used.
 */
let bindMsg = stsuu.getContextAttributes().getAttributeValueByName("binding_message");
let userCode = stsuu.getContextAttributes().getAttributeValueByName("user_code");
validateAuthRequest(hint, bindMsg, userCode);

let mobile = getMobileNumberFromLdap(hint);


/**
 * TODO: implement notify user base on using internal auth or external auth
 */

// Use this for internal auth
// internalAuthNotify(hint, mobile);

// Or use this for external auth
// externalAuthNotify(hint, mobile);
