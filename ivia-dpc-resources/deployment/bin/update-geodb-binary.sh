#!/bin/sh

# Get the input parameter
LICENSE_KEY="$1"
BASE_URL="https://download.maxmind.com/app/geoip_download"
usage="$(basename "$0") <LICENSE_KEY>"

[ -z "${LICENSE_KEY}" ] && echo "License key required for geodb update, is empty." && echo "Usage: $usage" && exit 1

# Paths are relative to the bin/ directory this script lives in.
# Output goes to ../geolite2/ (i.e. beta/geolite2/).
GEODB_WORKSPACE_DIR="../geolite2"
GEODB_TMP_DIR="geodb-latest"
GEOLITE2_DB="geolite2-db-latest.tar.gz"
GEOLITE2_CSV="geolite2-csv-latest.zip"

GEODB_WORKSPACE_DIR_ABS="$(cd "$(dirname "${GEODB_WORKSPACE_DIR}")" && pwd)/$(basename "${GEODB_WORKSPACE_DIR}")"
mkdir -p "${GEODB_WORKSPACE_DIR_ABS}"

[ -d ${GEODB_TMP_DIR} ] && rm -rf ${GEODB_TMP_DIR}
mkdir -p ${GEODB_TMP_DIR}
cd ${GEODB_TMP_DIR}

# Download the latest GeoLite2 db from the Maxmind website
echo "Downloading GeoLite2 database..."
curl --fail -L -o "${GEOLITE2_DB}" "${BASE_URL}?edition_id=GeoLite2-City&license_key=${LICENSE_KEY}&suffix=tar.gz"
tar -xvzf "${GEOLITE2_DB}"

# Find the extracted MMDB directory
MMDB_DIR=$(find . -type d -name "GeoLite2-City_*" | head -n 1)
if [ -z "$MMDB_DIR" ]; then
    echo "No GeoLite2-City_* directory found."
    exit 1
fi
cp -f "${MMDB_DIR}/GeoLite2-City.mmdb" "${GEODB_WORKSPACE_DIR_ABS}"
echo "GeoLite2-City.mmdb copied successfully"

# Download the latest GeoLite2 csv from the Maxmind website
echo "Downloading GeoLite2 CSV..."
curl --fail -L -o "${GEOLITE2_CSV}" "${BASE_URL}?edition_id=GeoLite2-City-CSV&license_key=${LICENSE_KEY}&suffix=zip"
unzip -q "${GEOLITE2_CSV}"

# Find the extracted CSV directory
CSV_DIR=$(find . -type d -name "GeoLite2-City-CSV_*" | head -n 1)
if [ -z "$CSV_DIR" ]; then
    echo "No GeoLite2-City-CSV_* directory found!"
    exit 1
fi
cp -f "${CSV_DIR}/GeoLite2-City-Locations-en.csv" "${GEODB_WORKSPACE_DIR_ABS}"
echo "GeoLite2-City-Locations-en.csv copied successfully"

cd ..

# Check if the pre-built binary exists
if [ ! -f "./dataprep-go" ]; then
    echo "Error: dataprep-go binary not found in current directory (bin/)."
    echo "Please build it first: cd ../utilities/geodb-updates/dataprep-go && go build -o ../bin/dataprep-go ."
    exit 1
fi

# Check if binary is executable
if [ ! -x "./dataprep-go" ]; then
    echo "Making dataprep-go executable..."
    chmod +x ./dataprep-go
fi

echo "Running data preparation using pre-built binary..."
./dataprep-go
if [ "$?" != "0" ]; then
    echo "Failed to run the geodb update. RC=$?"
    exit 1
fi

# Cleanup
[ -d ${GEODB_TMP_DIR} ] && rm -rf ${GEODB_TMP_DIR}

echo "GeoDB update completed successfully!"
