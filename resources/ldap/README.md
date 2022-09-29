# Setting Up LDAP

If you want to test using LDAP and you don't have one, you can use the following steps to setup one.
As a pre-requisite you need to have *docker* and *docker-compose* installed.

You can start the LDAP container by doing the following command:
```
$ docker-compose -f docker-compose.yml up
```

A docker container named *ldap* should start unless there is a clash in container name or port.

To add some users into the LDAP follow these steps:
```
$ docker exec -it ldap bash

root@05dae9fa1878:/# cd ldif
root@05dae9fa1878:/ldif# ldapadd -x -H ldap://localhost -D "cn=admin,dc=ibm,dc=com" -f users.ldif -w passw0rd
```

Note: if you stop the container you need to repeat the whole steps again.