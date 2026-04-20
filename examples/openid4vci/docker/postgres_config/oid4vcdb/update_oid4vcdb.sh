#!/bin/sh

#
# This script will create the new DB with OID4VC support.
#
# This script should be executed after from running isvaopdb container:
#
# ```
# docker exec -it isvaopdb /bin/bash
# prompt> /var/postgres/config/oid4vcdb/update_oid4vcdb.sh
# ```
#
#set -ex

DBNAME=postgres
oid4vcdbExists=`psql -U $POSTGRES_USER -w -l | grep $DBNAME | awk '{ print $1 }'`
if [ -z "$oid4vcdbExists" ] ; then
    echo "Create DB $DBNAME"
    createdb -U $POSTGRES_USER -w $DBNAME
    psql -U $POSTGRES_USER -w -l | grep $DBNAME 
else
    echo "DB '$DBNAME' already exists"
fi

psql -U $POSTGRES_USER -d $DBNAME -w -f `dirname $0`/update_isvaop_24.12.sql
