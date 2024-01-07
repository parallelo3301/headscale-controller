import { Hono, HonoRequest } from 'https://deno.land/x/hono@v3.9.0/mod.ts'
import { Context } from 'https://deno.land/x/hono@v3.9.0/context.ts'
import { cors, logger, secureHeaders } from 'https://deno.land/x/hono@v3.9.0/middleware.ts'
import { Agent, fetch } from 'npm:undici@5.25.3'

const log = (...args: any[]) => console.log(`[${new Date().toISOString()}]`, ...args)
const errorLog = (...args: any[]) => console.error(`[${new Date().toISOString()}]`, ...args)

const headscaleServerUrl = Deno.env.get('HEADSCALE_SERVER_URL')
if (!headscaleServerUrl) {
	errorLog('HEADSCALE_SERVER_URL is not set')
	Deno.exit(1)
}

const dispatcher = {
	dispatcher: new Agent({
		connect: {
			socketPath: '/var/run/docker.sock',
		},
	}),
}

const app = new Hono()
app.use('*', secureHeaders())
app.use('*', logger())
app.use('*', cors())

async function verifyHeadscaleAuthorization(req: HonoRequest) {
	try {
		const headers = new Headers()
		headers.set('Content-Type', 'application/json')
		headers.set('Authorization', req.header(`authorization`) ?? '')

		const api = await fetch(`${headscaleServerUrl}/api/v1/user`, { headers })
		return api.status === 200
	} catch (e) {
		errorLog(e)
		return false
	}
}

app.get('/', (c: Context) => c.text('Ready'))

app.post('/sighup', async (c: Context) => {
	if (!await verifyHeadscaleAuthorization(c.req)) {
		return c.json({ data: 'Unauthorized' }, 401)
	}

	const filter = encodeURIComponent(JSON.stringify({ ancestor: ['headscale/headscale'] }))

	try {
		const resp = await fetch(`http://localhost/containers/json?filters=${filter}`, {
			...dispatcher,
		})

		const containers = await resp.json()
		if (containers?.length !== 1) {
			return c.json({ errors: [{ message: 'Unable to find headscale container or multiple containers returned' }] }, 500)
		}

		const containerId = containers[0].Id

		await fetch(`http://localhost/containers/${containerId}/kill?signal=SIGHUP`, {
			method: 'POST',
			...dispatcher,
		})

		return c.json({ data: 'ok' })
	} catch (e) {
		errorLog(e)
		return c.json({ errors: [{ message: 'Canno update ACLs', error: e }] }, 500)
	}
})

app.post('/update-acls', async (c: Context) => {
	if (!await verifyHeadscaleAuthorization(c.req)) {
		return c.json({ data: 'Unauthorized' }, 401)
	}

	const filter = encodeURIComponent(JSON.stringify({ ancestor: ['headscale/headscale'] }))

	try {
		const resp = await fetch(`http://localhost/containers/json?filters=${filter}`, {
			...dispatcher,
		})

		const containers = await resp.json()
		if (containers?.length !== 1) {
			return c.json({ errors: [{ message: 'Unable to find headscale container or multiple containers returned' }] }, 500)
		}

		const containerId = containers[0].Id

		// TODO get body.config from request

		// TODO make a local (in-memory?) of /app/acls.json
		// TODO write new content to /app/acls.json

		// TODO: check for the result of it, as the update may fail.. probably check logs of the container?
		// it's the same behavior as the /sighup right now
		await fetch(`http://localhost/containers/${containerId}/kill?signal=SIGHUP`, {
			method: 'POST',
			...dispatcher,
		})

		// TODO if update failed, revert the /app/acls.json to the previous version and return error

		return c.json({ data: 'ok' })
	} catch (e) {
		errorLog(e)
		return c.json({ errors: [{ message: 'Cannot update ACLs', error: e }] }, 500)
	}
})

// initiate web server
const port = parseInt(Deno.env.get('PORT') || '6000', 10)
Deno.serve({ port }, app.fetch)
