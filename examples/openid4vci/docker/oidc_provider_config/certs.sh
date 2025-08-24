#!/bin/bash

OP_PRIVATE_KEY=op_server_priv.key
OP_PUBLIC_CERT=op_server_pub.crt

rm -f $OP_PRIVATE_KEY
rm -f $OP_PUBLIC_CERT

openssl req -x509 -newkey rsa:4096 -keyout $OP_PRIVATE_KEY -out $OP_PUBLIC_CERT -days 365 -config req.conf -nodes

echo
echo "Public key certificate: "
echo

openssl x509 -in $OP_PUBLIC_CERT -text
