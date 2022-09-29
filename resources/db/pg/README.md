# Setting Up Postgres Database

If you prefer to setup your own instance of postgres, you can follow these steps.
As a pre-requisite you need to have *docker* installed.

Assuming you have *postgres* folder in your home directory to store the postgres files,
execute this command to start a postgres container:

```
docker run --rm --name pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=passw0rd -d -p 5432:5432 -v ~/postgres:/var/lib/postgresql/data postgres:alpine
```

After that, apply the schema provided in *init_isvaop_0.0.1.sql*.

Note: if you stop the container, use the same command above to start it again. There is no need to re-apply the schema.
