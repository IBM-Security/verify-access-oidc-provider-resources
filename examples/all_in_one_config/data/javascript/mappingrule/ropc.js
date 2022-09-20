importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.IDMappingExtUtils);
importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
importClass(Packages.com.ibm.security.access.user.UserLookupHelper);

IDMappingExtUtils.traceString("Starting ROPC JS");

var username = stsuu.getContextAttributes().getAttributeValueByName("username");
var password = stsuu.getContextAttributes().getAttributeValueByName("password");

/**
 * This is an example of how you could verify the username and password with an
 * user registry before the access token is generated, therefore preventing
 * the scenario where access tokens are created for invalid users and stored in
 * the cache with no way to remove them till they expire.
 *
 * A prerequisite for using this example is configuring an ldap configuration
 * in ldapcfg.yml and associated ldap server connection in storage.yml
 * 
 * This example is the default method for verifying the username and password.
 * To enable this example, change the "ropc_registry_validation" variable 
 * to "true".
 */
var ropc_registry_validation = false;

if (ropc_registry_validation) {

    // Assuming there is ldap configuration name "user_registry" in ldapcfg.yml
    var userLookupHelper = new UserLookupHelper("user_registry");

    /**
     * Assuming the users has distinguished name pattern:
     * cn=<username>,dc=ibm,dc=com
     */
    var user = userLookupHelper.getUserByNativeId("cn=" + username + ",dc=ibm,dc=com");
    if (user.hasError()) { // check for error

        /**
         * This is the recommended way to check the error and logging it
         */
        IDMappingExtUtils.traceString("Throw exception - getUserByNativeId failed with error: " + user.getError());
        OAuthMappingExtUtils.throwSTSException("Unable to authenticate user.");

    } else if (!user.authenticate(password)) { // check the password

        IDMappingExtUtils.traceString("Throw exception - failed to authenticate user: " + user.getNativeId());
        OAuthMappingExtUtils.throwSTSException("Invalid user or password.");

    } else {

        /**
         * Populate user metadata in the case of successful authentication
         * The metadata serve as credential attributes that can be used for grant enrichment
         * The metadata at least should contain 'uid' claim or any claim indicated in 'subject_attribute_name'
         * under provider.yml 'authentication' stanza as this will be used as the token 'sub' claim 
         */
        IDMappingExtUtils.traceString("Authentication is successful.");
        userData.uid = username;
        userData.given_name = user.getAttribute("givenName");
        userData.family_name = user.getAttribute("sn");
        userData.preferred_username = username;

    }

} else if (username == "peter" && password == "secret") { // for demo purpose

    userData.uid = "phare@zoo.org";
    userData.given_name = "peter";
    userData.family_name = "hare";
    userData.preferred_username = "Pete Bunny";

} else {
    OAuthMappingExtUtils.throwSTSInvalidGrantMessageException("Invalid user or password.", "Either user or password is not valid.");
}