# IBM Verify Information Access (IVIA) - Data Privacy & Consent Management (DPC) Deployment Guide

This directory contains automated scripts and configuration files to deploy the **IVIA DPC** stack with **PostgreSQL** and **IBM Application Gateway (IAG)** using Docker Compose.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [What `setup.sh` Does](#what-setupsh-does)
3. [Prerequisites](#prerequisites)
   - [1. MaxMind GeoLite2 License Key (Optional for Geo-Rules)](#1-maxmind-geolite2-license-key-optional-for-geo-rules)
   - [2. Obtain DPC Activation Code from IBM Passport Advantage](#2-obtain-dpc-activation-code-from-ibm-passport-advantage)
   - [3. Configure `activation_code` in `config/dpcm-config.yaml`](#3-configure-activation_code-in-configdpcm-configyaml)
   - [4. IBM Security Verify SaaS Tenant & OIDC / API Client Configuration](#4-ibm-security-verify-saas-tenant--oidc--api-client-configuration)
4. [Deployment Steps](#deployment-steps)
5. [Testing & Verifying the Deployment](#testing--verifying-the-deployment)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────┐
│      API Client / Browser       │
└────────────────┬────────────────┘
                 │ (HTTPS: 8443 / Bearer Token)
                 ▼
┌─────────────────────────────────┐
│     IBM Application Gateway     │ ◄──────────► ┌─────────────────────────┐
│              (IAG)              │  OAuth/OIDC  │   IBM Security Verify   │
└────────────────┬────────────────┘  Validation  │      (SaaS Tenant)      │
                 │ (HTTPS: 8438 + `iv-jwt` header) └─────────────────────────┘
                 ▼
┌─────────────────────────────────┐
│            IVIA DPC             │
│        (Privacy Engine)         │
└────────────────┬────────────────┘
                 │ ( TLS: 5432)
                 ▼
┌─────────────────────────────────┐
│        PostgreSQL 16 DB         │
└─────────────────────────────────┘
```

- **PostgreSQL**: Stores privacy policies, rules, data items, purposes, access types, and user consents.
- **IVIA DPC**: Privacy engine enforcing runtime data usage approvals (DUA), data subject presentation (DSP), and management APIs.
- **IAG (IBM Application Gateway)**: Secure reverse proxy authenticating client tokens against IBM Security Verify via OAuth/OIDC introspection and injecting identity headers (`iv-jwt`, `iv_user`, `iv_groups`) downstream to DPC.

---

## What `setup.sh` Does

The `setup.sh` script automates the complete initialization and launch of the stack:

1. **MaxMind GeoLite2 Database Download (Optional)**:
   - Uses the architecture-appropriate `dataprep-go` utility (`bin/amd64`, `bin/arm64`, etc.).
   - Downloads the latest MaxMind GeoLite2 database and compiles `geodb.db` and `GeoLite2-City.mmdb` into `geolite2/` (if `MAXMIND_LICENSE_KEY` is set).
2. **TLS Certificate Generation**:
   - Generates self-signed TLS certificates and private keys for:
     - PostgreSQL database (`certs/postgres/server.crt`, `certs/postgres/server.key`).
     - DPC HTTPS listener (`certs/dpcm/httpservercert.crt`, `certs/dpcm/httpserverkey.key`).
     - IAG front-end HTTPS server (`certs/iag/server.pem`).
     - IAG JWT signing keypair (`certs/iag/jwt-signing.pem`).
3. **Generates `iag-config.yaml`**:
   - Dynamically creates `iag-config.yaml` embedding the generated certificates as Base64 strings (`B64:` notation).
   - Injects your IBM Security Verify tenant URL, Client ID, and Client Secret for token introspection.
4. **Environment Cleanup**:
   - Tears down any existing containers and removes previous Docker volumes for a clean start.
5. **Starts Database & DPC**:
   - Launches `dpcm-postgres` and waits until the database health check passes.
   - Applies the database schema (`init-db.postgres.sql`).
   - Launches `ivia-dpc` and waits for `"Starting HTTPS server"` in the container logs.
6. **Starts IAG**:
   - Launches `ivia-dpc-iag` listening on HTTPS port `8443`.

---

## Prerequisites

### 1. MaxMind GeoLite2 License Key (Optional for Geo-Rules)

If you plan to use geographic-based consent evaluation (e.g., GDPR rules based on subject IP address), a MaxMind license key is required to download the GeoLite2 database.

#### How to get a free MaxMind License Key:
1. Sign up for a free account at [MaxMind GeoLite2 Signup](https://www.maxmind.com/en/geolite2/signup).
2. Verify your email address and log in to the MaxMind Account Portal.
3. In the navigation menu, select **Manage License Keys**.
4. Click **Generate New License Key**.
5. Give the key a description, choose **No** for "Will this key be used for GeoIP Update?", and click **Confirm**.
6. Copy the generated license key.
7. Set the key in your environment or in `.env`:
   ```bash
   export MAXMIND_LICENSE_KEY="your_maxmind_license_key"
   ```
> *Note:* If you already have `GeoLite2-City.mmdb` and `geodb.db`, place them in `geolite2/` to skip the download step.

---

### 2. Obtain DPC Activation Code from IBM Passport Advantage

IVIA DPC requires an activation code for enterprise runtime features and license compliance.

#### How to obtain your activation code:
1. Log in to [IBM Passport Advantage Online](https://www.ibm.com/software/passportadvantage/pao_customer.html).
2. Go to **Software download & media access**.
3. Locate your **IBM Verify Information Access (IVIA)** or **IBM Security Verify Access** entitlement.
4. Download the DPC component package or locate your product activation code in the license credentials section.

---

### 3. Configure `activation_code` in `config/dpcm-config.yaml`

Before starting DPC, update the configuration file with your activation code:

1. Open `config/dpcm-config.yaml`.
2. Locate the `activation_code` field at the bottom of the file.
3. Paste your activation code between the quotes:
   ```yaml
   activation_code: "YOUR_ACTIVATION_CODE_FROM_PASSPORT_ADVANTAGE"
   ```

---

### 4. IBM Security Verify SaaS Tenant & OIDC / API Client Configuration

IAG verifies incoming Bearer tokens using IBM Security Verify OAuth Introspection.

#### Step 4.1: Access Your Verify Tenant
Ensure you have administrative access to your IBM Security Verify tenant:
`https://<tenant-name>.ice.ibmcloud.com`

#### Step 4.2: Create an API Client Application
1. In the IBM Security Verify Admin Console, go to **Applications** → **API Access** (or **Applications** → **Add Application** → **API Client**).
2. Click **Add API Client**.
3. Set **Name** to `DPC-API-Client` (or your preferred name).
4. Under **Entitlements / Grant types**, check **Client credentials**.
5. Under **API Permissions / Scopes**, enable the necessary DPC scopes:
   - `ibm.dpc.read_dataitems`
   - `ibm.dpc.manage_dataitems`
   - `ibm.dpc.read_accesstypes`
   - `ibm.dpc.manage_accesstypes`
   - `ibm.dpc.read_purposes`
   - `ibm.dpc.manage_purposes`
   - `ibm.dpc.read_rules`
   - `ibm.dpc.manage_rules`
   - `ibm.dpc.read_policies`
   - `ibm.dpc.manage_policies`
   - `ibm.dpc.read_geo`
   - `ibm.dpc.read_consents`
6. Click **Save**.
7. Note down:
   - **Tenant URL**: `https://<tenant-name>.ice.ibmcloud.com`
   - **Client ID**: `<your_client_id>`
   - **Client Secret**: `<your_client_secret>`

---

## Deployment Steps

### 1. Create `.env` Configuration File
Create a `.env` file in this directory (`deployment/.env`):

```env
# IBM Security Verify SaaS Credentials
VERIFY_TENANT_URL=https://<your-tenant>.ice.ibmcloud.com
VERIFY_CLIENT_ID=<your_client_id>
VERIFY_CLIENT_SECRET=<your_client_secret>

# MaxMind GeoLite2 License Key (Optional)
MAXMIND_LICENSE_KEY=<your_maxmind_license_key>

# PostgreSQL DB Password (Optional - defaults to dpcm_password)
DB_PASSWORD=dpcm_password
```

### 2. Run `setup.sh`
Execute the automated setup script:

```bash
bash setup.sh
```

The script will generate certificates, generate `iag-config.yaml`, deploy the containers, and verify readiness.

---

## Testing & Verifying the Deployment

### 1. Request an OAuth Token from IBM Security Verify
```bash
TENANT_URL="https://<your-tenant>.ice.ibmcloud.com"
CLIENT_ID="<your_client_id>"
CLIENT_SECRET="<your_client_secret>"

TOKEN_RESPONSE=$(curl -s -X POST "$TENANT_URL/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=ibm.dpc.read_purposes ibm.dpc.read_dataitems")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "Access Token: $ACCESS_TOKEN"
```

### 2. Test Management API via IAG
```bash
curl -k -X GET "https://localhost:8443/dpcm-mgmt/config/v1.0/privacy/purposes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json"
```

### 3. Check Direct DPC Health Check
```bash
curl -k https://localhost:8438/health
```

---

## API Endpoints Reference

### Proxied through IAG (Port `8443` - Requires Bearer Token)
- **Management APIs**: `https://localhost:8443/dpcm-mgmt/config/v1.0/privacy/...`
- **Runtime APIs**: `https://localhost:8443/dpcm/v1.0/privacy/...`
- **Credential Viewer (Debug)**: `https://localhost:8443/credview`

### Direct DPC Endpoints (Port `8438` - Backend)
- **Health Check**: `GET https://localhost:8438/health`
- **Purposes**: `GET/POST /dpcm-mgmt/config/v1.0/privacy/purposes`
- **Rules**: `GET/POST /dpcm-mgmt/config/v1.0/privacy/rules`
- **Policies**: `GET/PUT /dpcm-mgmt/config/v1.0/privacy/policies/default`
- **Data Usage Approval (DUA)**: `POST /dpcm/v1.0/privacy/data-usage-approval`
- **Data Subject Presentation (DSP)**: `POST /dpcm/v1.0/privacy/data-subject-presentation`
- **Consents**: `POST/GET /dpcm/v1.0/privacy/consents`

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `dpc container exited` / `activation code invalid` | Activation code is missing or expired in `dpcm-config.yaml` | Add a valid Passport Advantage activation code to `config/dpcm-config.yaml` under `activation_code`. |
| `PostgreSQL connection refused / TLS error` | Certificates not matching or PostgreSQL container unhealthy | Check `docker logs dpcm-postgres` and ensure `certs/postgres/server.crt` matches `config/server.crt`. |
| `IAG 502 Bad Gateway` | IAG cannot trust DPC certificate | Confirm `certs/dpcm/httpservercert.crt` is mapped to `/var/iag/config/dpcm.crt` in `docker-compose.yml`. |
| `401 Unauthorized` through IAG | Invalid Verify credentials or expired token | Verify `VERIFY_CLIENT_ID` / `VERIFY_CLIENT_SECRET` in `.env` and re-run `setup.sh`. |
| `GeoIP resolution unavailable` | `MAXMIND_LICENSE_KEY` unset or database not downloaded | Set `MAXMIND_LICENSE_KEY` in `.env` and re-run `setup.sh`. |
