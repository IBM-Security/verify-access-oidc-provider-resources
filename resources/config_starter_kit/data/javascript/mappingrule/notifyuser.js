/**
 * Copyright contributors to the IBM Security Verify Access OIDC Provider Resources project
 */
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
 
IDMappingExtUtils.traceString("Starting NotifyUser JS");
 
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
 * When it comes from 'login_hint', it will be available under attribute 'sub'.
 * An 'id_token_hint' should have 'sub' or any other claims inside it.
 * However 'login_hint_token' is a free-format JWT, so it may not contain 'sub'.
 * Tips: print the STSUU to find out what information is available from the hint.
 * 
 * For 'login_hint' or 'id_token_hint', at this point, the system has validate the signature of JWT.
 * Further claims such as 'exp' or 'iss' can be validated here if necessary.
 */
IDMappingExtUtils.traceString("Print STSUU to check available hint: " + stsuu.toString());
var hint = stsuu.getAttributeValueByName("sub");
 
/**
 * Based on the hint, may want to load the user information here.
 * There are LDAP utility or UserLookupHelper that can be used.
 * You can copy the example from ropc.js of how to retrieve information using UserLookupHelper
 */
 
/**
 * Printing some information to the log
 */
IDMappingExtUtils.traceString("Auth Request ID: " + ciba.getAuthRequestID());
 
// This information should be sent as part of notification message to the user
IDMappingExtUtils.traceString("User Authorize endpoint: " + ciba.getUserAuthorizeEndpoint());
 
// These information should be sent to external authenticator to do callback later on
IDMappingExtUtils.traceString("Status Update endpoint: " + ciba.getStatusUpdateEndpoint());
IDMappingExtUtils.traceString("Bearer token: " + ciba.getBearerToken());
 
/**
 * Validating binding_message and user_code
 */
var bindMsg = stsuu.getContextAttributes().getAttributeValueByName("binding_message");
var userCode = stsuu.getContextAttributes().getAttributeValueByName("user_code");
 
if (bindMsg != null && bindMsg.length > 50) { // Example of checking the binding_message and throw the appropriate error
    OAuthMappingExtUtils.throwSTSCustomUserMessageException("Binding message is more than 50 characters.", 400, "invalid_binding_message");
}
 
if (userCode != null && userCode == "invalidCode") { // Example of checking the user_code and throw the appropriate error
    OAuthMappingExtUtils.throwSTSCustomUserMessageException("User code is invalid.", 400, "invalid_user_code");
}

if (hint == "checkstatuspass@test.com") {
    ciba.setAuthenticator(new ExternalAuthenticatorWithCheckStatusEndpoint("https://checkstatus.com?status=pass", ""));
} else if (hint == "checkstatusfail@test.com") {
    ciba.setAuthenticator(new ExternalAuthenticatorWithCheckStatusEndpoint("https://checkstatus.com?status=fail", ""));
} else {
    ciba.setAuthenticator(new ExternalAuthenticatorWithCheckStatusEndpoint("https://checkstatus.com?status=pending", ""));
}