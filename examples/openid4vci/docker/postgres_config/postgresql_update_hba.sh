#!/bin/sh

#
# This script will allow TLS access to the database.
#

hbaConf=$PGDATA/pg_hba.conf

echo "hostssl postgres $POSTGRES_USER all md5" >> $hbaConf
echo "hostssl isvaopdb $POSTGRES_USER all md5" >> $hbaConf

