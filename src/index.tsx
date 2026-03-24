// src/index.tsx - 主入口
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { visitorRoutes } from './routes/visitor'
import { ownerRoutes } from './routes/owner'
import { apiRoutes } from './routes/api'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// 静态资源
app.use('/static/*', serveStatic({ root: './' }))

// API 路由
app.route('/api', apiRoutes)

// 主人后台路由
app.route('/owner', ownerRoutes)

// 访客路由（放最后，避免覆盖）
app.route('/', visitorRoutes)

export default app
