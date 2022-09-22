

The IBM Security Verify Access OIDC Provider configuration for the container is supplied as YAML files, template files, JavaScript files along with other keystore. 

The configuration for the container will need to be placed in the local directory which will then be mounted when the container is started.

When the container first starts it will apply the configuration found within the local directory.

The folder structure is as follows:
```
data
 |
 - provider.yml
 - attributesources.yml
 - storage.yml
 - ldapcfg.yml
 - clients
 |    |
 |    - <clientID1>.yml
 |    - <clientIDn>.yml
 |
 - javascript
 |    |
 |    - accesspolicy
 |    |     |
 |    |     - <policy>.js
 |    |
 |    - mappingrule
 |          |
 |          - <pretoken>.js
 |          - <posttoken>.js
 |
 - keystore
 |    |
 |    - <keystoreName>
 |          |
 |          - personal
 |          |   |
 |          |   - <personal_label1>.pem
 |          |   - <personal_labeln>.pem
 |          |
 |          - signer
 |              |
 |              - <signer_label1>.pem
 |              - <signer_labeln>.pem
 |
 - templates
      |
      - C
         |
         - static
         |     |
         |     - ibm-logo.png
         |     - styles.css
         |
         - user_consent.html
         - user_error.html
         - user_authorize_success.html
         - user_authorize_failed.html

```

For deatiled documentation refer to the [documentation](https://docs.verify.ibm.com/ibm-security-verify-access/docs)