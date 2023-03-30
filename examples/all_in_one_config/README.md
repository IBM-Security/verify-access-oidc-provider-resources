

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

*Note:* Keystores directory is not created and populated, instruction in the [document](https://docs.verify.ibm.com/ibm-security-verify-access/docs/concepts-keystores) can be followed to add new keystores, keys and certificates.


The IBM Security Verify Access OIDC Provider version 23.03 onwards supports Kubernettes ConfigMap and Secrets natively in the configuration. Hence the configuration can be split into multiple files or can be baked into a single file.



```
data (Top-level Configuration)
 |
 - provider.yml
 - clients.yml (Configuration all the clients)
 |    |
 |    - <clientID1>.yml
 |    - <clientIDn>.yml
 |
 |
 - accesspolicy (Configuration of all the access policies)
 |    |     
 |    - <policy>.js
 |    |
 - mappingrule (Configuration of all the access policies)
 |    |
 |    - <pretoken>.js
 |    - <posttoken>.js
 |
 - keystore (Configuration of all the keystore)
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
 - templates.zip (Configuration of the templates)

```