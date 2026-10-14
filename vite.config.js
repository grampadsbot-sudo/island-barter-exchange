import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'

const ENDPOINT_TOKEN = '__VITE_SURVEY_ENDPOINT_JSON__'

function surveyEndpointPlugin(endpoint) {
  const literal = JSON.stringify(endpoint).replace(/</g, '\\u003c')
  return {
    name: 'ibe-survey-endpoint',
    transformIndexHtml(html) {
      if (!html.includes(ENDPOINT_TOKEN)) return html
      return html.replaceAll(ENDPOINT_TOKEN, literal)
    },
  }
}

function memberReviewRewrite() {
  const rewrite = (req, _res, next) => {
    if (!req.url) return next()
    const q = req.url.indexOf('?')
    const path = q === -1 ? req.url : req.url.slice(0, q)
    const search = q === -1 ? '' : req.url.slice(q)
    if (path === '/member-review' || path === '/member-review/') {
      req.url = '/member-review.html' + search
    }
    next()
  }
  return {
    name: 'member-review-rewrite',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const endpoint = (env.VITE_SURVEY_ENDPOINT || '').trim()
  return {
    appType: 'mpa',
    plugins: [surveyEndpointPlugin(endpoint), memberReviewRewrite()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          memberReview: resolve(__dirname, 'member-review.html'),
        },
      },
    },
  }
})
