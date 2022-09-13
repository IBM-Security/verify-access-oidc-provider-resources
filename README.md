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

#### 3.3 Starting ISVA OP

- Download `docker-compose.yml` from this repo into `$ISVAOP`
- Execute: `docker-compose -f docker-compose.yml up`

### 4. Quick test

#### 4.1 Pre-requisite

- Postman (https://www.postman.com)

#### 4.2 Steps

- Download and import both `IBM Security Verify Access OIDC Provider.postman_collection.json` and `IBM Security Verify Access OIDC Provider.postman_environment.json`
- You should be able to execute each command in the collection. There is documentation inside the postman collection itself.




