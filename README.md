# IBM Security Verify Access OIDC Provider Enablement Materials

This repository is used to share enablement materials for IBM Security Verify Access OIDC Provider(ISVAOP). 

### 1. Overview

ISVA OIDC Provider requires configuration files before it can operate. The intention here is to provide 
basic configuration that allows you to quickly try some of the features.

The folder structure of the repository is as follows:
```
resources
 |
 - db
 |  | 
 |  - pg
 |     | 
 |     - init_isvaop_0.0.1.sql
 |
 - config_starter_kit

examples
 |
 - all_in_one_config
 |
 - authcode_with_pkce
 |
 - authcode_with_par_pkce
 |
 - ciba

- `resources` contains the database sql required for ISVAOP.
- `resources` also contains `config_startr_kit` to start the ISVAOP container with basic configutation.
- `examples` folder contains the configuration required for all in one configuration with advanced use cases.
- `examples` folder contains sample nodejs relying party code to trigger OAuth2.0/OIDC runtime flows.

For all the release content for `22.09` navigate to the (Releases)[https://github.com/IBM-Security/ibm-security-verify-access-oidc-provider-resources/releases/22.09]
