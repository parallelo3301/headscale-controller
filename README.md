# Headscale controller

Uses `docker.sock` to manage ACLs / reload the service gracefully.

Provides API consumed by
[headscale-management](https://github.com/parallelo3301/headscale-management).

Server tries to find a single container running `headscale/headscale` image. If there's none or multiple of them, it will return an error.
If there's only one, it will use it to send `SIGHUP` to reload the service.

## API

To authorize the requests, `Authorization` header must be provided with valid
API key.

E.g.: `Authorization: Bearer <API_KEY>`

### POST /sighup

Sends `SIGHUP` to the headscale service.

> Warning: It simply sends the signal without guaranteeing that the service was
> reloaded successfully.

### POST /update-acls

Set Content-Type to `application/json`

Body:

```json
{
	"config": "{\"acls\": ... }"
}
```

As the ACLs are a huJSON, we cannot send it directly, and it has to be a text.

It makes a copy of current file, updates it and then sends `SIGHUP` to reload
the configuration. If this fails, it restores the previous file and returns an
error.

## Requirements / Configuration

- `docker.sock` must be mounted at `/var/run/docker.sock` OR ENV `USE_SOCAT` must be set, e.g. `tcp://socat:2375`
- ACLs must be mounted at `/app/acls.json` and be writeable
- ENV `HEADSCALE_SERVER_URL` must be set to the URL of the headscale server

Optional:

- ENV `PORT` can be used to change the port the API listens on (default: `6000`)
