#!/bin/bash

PG_PRIVATE_KEY=pg_priv.key
PG_PUBLIC_CERT=pg_pub.crt
PG_KEYDB=pg_keydb.pem

rm -f $PG_PRIVATE_KEY
rm -f $PG_PUBLIC_CERT
rm -f $PG_KEYDB

openssl req -x509 -newkey rsa:4096 -keyout $PG_PRIVATE_KEY -out $PG_PUBLIC_CERT -days 365 -config req.conf -nodes

cat $PG_PRIVATE_KEY $PG_PUBLIC_CERT > $PG_KEYDB

echo
echo "Public key certificate: "
echo

openssl x509 -in $PG_KEYDB -text

echo
echo "Private key details: "
echo

openssl rsa -in $PG_KEYDB -text