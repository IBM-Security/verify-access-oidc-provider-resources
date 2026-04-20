#!/bin/bash

IAG_PRIVATE_KEY=iag_priv.key
IAG_PUBLIC_CERT=iag_pub.crt
IAG_KEYDB=iag_keydb.pem

rm -f $IAG_PRIVATE_KEY
rm -f $IAG_PUBLIC_CERT
rm -f $IAG_KEYDB

openssl req -x509 -newkey rsa:4096 -keyout $IAG_PRIVATE_KEY -out $IAG_PUBLIC_CERT -days 365 -config req.conf -nodes

cat $IAG_PRIVATE_KEY $IAG_PUBLIC_CERT > $IAG_KEYDB

echo
echo "Public key certificate: "
echo

openssl x509 -in $IAG_KEYDB -text

echo
echo "Private key details: "
echo

openssl rsa -in $IAG_KEYDB -text