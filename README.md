# IBM Security Verify Access OIDC Provider Enablement Materials

This repository is used to share enablement materials for IBM Security Verify Access (ISVA) OIDC Provider. 

### 1. Overview

ISVA OIDC Provider requires configuration files before it can operate. The intention here is to provide 
basic configuration that allows you to quickly try some of the features.

### 2. Pre-requisite

- You have `docker` and `docker-compose` installed in your system
- You have downloaded the docker image of ISVA OIDC Provider
- You have installed Postgres database in your system

### 3. Quick start

#### 3.1 Setting up configuration file

- Assume `$ISVAOP` points to your working directory
- Create a directory `$ISVAOP/config`
- Download `config.zip` from this repository into `$ISVAOP/config` folder
- Extract it using `unzip config.zip`. After extraction you should have `$ISVAOP/config/data` and all the sub-folders.
- You may delete the `config.zip`

#### 3.2 Modify storage.yml

- Modify `$ISVAOP/config/data/storage.yml` using your preferred editor
- Ensure the credentials to connect to your Postgres database is correct
- The LDAP server connection is not required at this point

#### 3.3 (Optional) Modify provider.yml

- If ISVA OP is behind a standard junction, you need to ensure the `definition/base_url` contain the junction.

#### 3.4 Starting ISVA OP

- Download `docker-compose.yml` from this repo into `$ISVAOP`
- Check the version of downloaded ISVA OP image, and modify this `docker-compose.yml` accordingly
- Execute: `docker-compose -f docker-compose.yml up`

### 4. Quick test

#### 4.1 Pre-requisite

- Postman (https://www.postman.com)

#### 4.2 Steps

- Download and import both `IBM Security Verify Access OIDC Provider.postman_collection.json` and `IBM Security Verify Access OIDC Provider.postman_environment.json`
- If you directly test against the ISVA OP container, you can leave the `junction` environment variable empty.
- If ISVA OP is behind a standard junction, you need to set the `junction` environment variable (example: `/isvaop`).
- You should be able to execute each command in the collection. There is documentation inside the postman collection itself.

#### 4.3 Keys

- The postman collection is using key and certificates to sign `request object` JWT or `client assertion` JWT or doing MTLS.
- If you need to recreate the JWT or doing MTLS, you can find it inside the `keys.zip`.
- The private-public keys are separated into folders that indicate how it is used.

##### 4.3.1 Recreate JWT

- Usually you need to recreate JWT because the JWT has expired
- From the postman environment, copy the JWT that you want to recreate, for example `private_key_jwt`
- Paste into [jwt.io](https://jwt.io), the jwt header and payload will be extracted on the right section.
- Copy the private-public key from (in this case) `keys/private_key_jwt` folder - into jwt.io private-public key section.
- You only need to change the `iat` or `exp` without changing anything else
- Copy the new JWT back to the postman environment and re-run the flow.
