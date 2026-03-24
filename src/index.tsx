// src/index.tsx
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { visitorRoutes } from './routes/visitor'
import { ownerRoutes } from './routes/owner'
import { apiRoutes } from './routes/api'

type Bindings = {
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.use('/static/*', serveStatic({ root: './' }))

app.route('/api', apiRoutes)
app.route('/owner', ownerRoutes)
app.route('/', visitorRoutes)

export default app
