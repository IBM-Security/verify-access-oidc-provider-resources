# OpenID For Verifiable Credential Issuance Samples

This folder contains samples and docker runtime configuration that enable
the issuance of access tokens according to [OpenID for Verifiable Credential Issuance - draft 14](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-14.html)

## Prerequisites 

Access to the following ISVA docker containers is required:

*  bitnami/openldap:latest
*  icr.io/ivia/ivia-postgresql:11.0.0.0
*  icr.io/ivia/ivia-oidc-provider:24.12
*  icr.io/ibmappgateway/ibm-application-gateway:latest (or 24.12)
*  NodeJS v20 and NPM

## Clone this GIT repository

Clone this GIT repository to a machine hosting a docker runtime

## Setup

1. Ensure docker is logged into to container registries, specifically **icr.io**
2. Create a docker sub network as follows:
   
   ```shell
   docker network create --subnet 172.80.0.0/24 isvaopnw-default
   ```

3. Start the docker containers with `docker-compose`
   
    ```shell
    cd <project clone root>/verify-access-oidc-provider-resources/examples/openid4vci/docker
    docker-compose up -d
    ```
4. Update the DB for OpenID4VCI

    ```shell
    docker exec -it isvaopdb /bin/bash -c "/var/postgres/config/oid4vcdb/update_oid4vcdb.sh"
    ```

5. Update the /etc/hosts of the docker host where the container hostnames are mapped to localhost:

    ```
    127.0.0.1       localhost isvaop isvaopgw isvaopldap isvaopdb
    ```

6. Install the javascript package dependencies
   
   ```shell
    cd <project clone root>/verify-access-oidc-provider-resources/openid4vci/javascript_source/oidvci
    npm install
    ```



## Run the sample code (mocha tests)

Examples of token grant flows simulated as an OID4VCI wallet are contained in the `<project clone root>/verify-access-oidc-provider-resourcesopenid4vci/javascript_source/oidvci/test`
directory.

Execute the samples as follows:

```shell
cd <project clone root>/verify-access-oidc-provider-resources/openid4vci/javascript_source/oidvci
npm run test -- -b
```

