importClass(Packages.com.tivoli.am.fim.trustserver.sts.utilities.OAuthMappingExtUtils);
importClass(Packages.com.ibm.security.access.user.UserLookupHelper);

/*
 * Retrieve the username and password from the request.
 */

var username = stsuu.getContextAttributes().getAttributeValueByName("username");
var password = stsuu.getContextAttributes().getAttributeValueByName("password");

/*
 * Retrieve the LDAP handle and then perform a lookup on the user DN.
 */

var userLookupHelper = new UserLookupHelper("myldap");  // 'myldap' refers to config in provider.yml
var user = userLookupHelper.getUserByNativeId(
                            "cn="+username+",ou=users,dc=ibm,dc=com");

/*
 * Check the result.  If the user was found we attempt to authenticate using
 * the supplied password.
 */

if (user.hasError()) {
    OAuthMappingExtUtils.throwSTSException("Unable to authenticate user.");
} else if (!user.authenticate(password)) {
    OAuthMappingExtUtils.throwSTSException("Invalid user or password.");
} else {
    userData.uid = user.user.dn;
}

