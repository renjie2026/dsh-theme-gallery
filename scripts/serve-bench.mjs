#!/usr/bin/env node
/**
 * Serve the visual tuning bench on 127.0.0.1:8171.
 *
 * The bench is a single static page that recreates the DSH shell — titlebar,
 * sidebar, transcript, composer, right panel — with both states (empty
 * conversation, conversation with messages) and both bundled themes, plus
 * sliders for the reading-state parameters. Tune there, then copy the values
 * into a theme's `reading` block.
 *
 * Run with: npm run bench
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const benchDir = join(here, '..', 'tools', 'theme-bench')
const port = Number(process.env.BENCH_PORT ?? 8171)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const file = join(benchDir, path === '/' ? 'index.html' : path.slice(1))
  // Keep the served root inside the bench directory.
  if (!file.startsWith(benchDir) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found\n')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`theme bench: http://127.0.0.1:${port}/`)
  console.log('  ?theme=shan|dream  ?state=idle|reading  ?right=on')
})
