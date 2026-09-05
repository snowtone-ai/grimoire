import { createServer } from 'node:http'

export const FIXTURE_SAFETY_TOKEN = 'resilience-fixture-v1'

const page = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Resilience fixture</title>
  </head>
  <body data-storage-failures="" data-storage-recovered="false" data-initialized="false">
    <nav><a href="/a">A</a><a href="/b">B</a></nav>
    <output data-testid="counter">0</output>
    <button data-testid="rapid" type="button">Increment</button>
    <form data-testid="submit-form">
      <button data-testid="submit" type="submit">Submit once</button>
    </form>
    <button data-testid="storage-write" type="button">Write storage</button>
    <script>
      const counter = document.querySelector('[data-testid="counter"]')
      const renderCounter = () => { counter.textContent = localStorage.getItem('fixture-counter') || '0' }
      renderCounter()
      addEventListener('storage', renderCounter)
      document.querySelector('[data-testid="rapid"]').addEventListener('click', () => {
        const next = Number(localStorage.getItem('fixture-counter') || '0') + 1
        localStorage.setItem('fixture-counter', String(next))
        renderCounter()
      })

      let submitting = false
      document.querySelector('[data-testid="submit-form"]').addEventListener('submit', async (event) => {
        event.preventDefault()
        if (submitting) return
        submitting = true
        try {
          await fetch('/api/submit', {
            method: 'POST',
            headers: { 'idempotency-key': 'fixture-submit-v1' },
          })
        } finally {
          submitting = false
        }
      })

      const request = (operation) => new Promise((resolve, reject) => {
        operation.onsuccess = () => resolve(operation.result)
        operation.onerror = () => reject(operation.error)
      })
      const transactionDone = (transaction) => new Promise((resolve, reject) => {
        transaction.oncomplete = resolve
        transaction.onabort = () => reject(transaction.error)
        transaction.onerror = () => reject(transaction.error)
      })
      const openDatabase = async () => {
        const operation = indexedDB.open('resilience-fixture', 1)
        operation.onupgradeneeded = () => operation.result.createObjectStore('records')
        return request(operation)
      }

      async function recoverStorage() {
        let recovered = false
        try {
          const preference = JSON.parse(localStorage.getItem('fixture-preference') || '{"mode":"safe"}')
          if (preference.mode !== 'safe') throw new Error('invalid preference')
        } catch {
          recovered = true
          localStorage.setItem('fixture-preference', '{"mode":"safe"}')
        }
        const database = await openDatabase()
        const readTransaction = database.transaction('records', 'readonly')
        const readDone = transactionDone(readTransaction)
        const current = await request(readTransaction.objectStore('records').get('stable'))
        await readDone
        if (!current || current.payload !== 'ok') {
          recovered = true
          const writeTransaction = database.transaction('records', 'readwrite')
          const writeDone = transactionDone(writeTransaction)
          writeTransaction.objectStore('records').put({ payload: 'ok' }, 'stable')
          await writeDone
        }
        database.close()
        document.body.dataset.storageRecovered = String(recovered)
        document.body.dataset.initialized = 'true'
      }

      document.querySelector('[data-testid="storage-write"]').addEventListener('click', async () => {
        const failures = []
        try { localStorage.setItem('fixture-pressure', 'value') } catch (error) { failures.push(error.name) }
        try {
          const database = await openDatabase()
          const transaction = database.transaction('records', 'readwrite')
          const done = transactionDone(transaction)
          transaction.objectStore('records').put({ payload: 'pressure' }, 'pressure')
          await done
          database.close()
        } catch (error) { failures.push(error.name) }
        document.body.dataset.storageFailures = failures.sort().join(',')
      })

      recoverStorage().catch((error) => setTimeout(() => { throw error }))
    </script>
  </body>
</html>`

export async function startResilienceFixture() {
  const logicalSubmits = new Set()
  let submitRequests = 0
  let probeRequests = 0

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname === '/.well-known/resilience-test') {
      response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json' })
      response.end(JSON.stringify({ resilienceTest: true, environment: 'test', token: FIXTURE_SAFETY_TOKEN }))
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/submit') {
      submitRequests += 1
      logicalSubmits.add(request.headers['idempotency-key'])
      await new Promise((resolve) => setTimeout(resolve, 25))
      response.writeHead(204, { 'cache-control': 'no-store' })
      response.end()
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/probe') {
      probeRequests += 1
      response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/state') {
      response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json' })
      response.end(JSON.stringify({ logicalSubmits: logicalSubmits.size, probeRequests, submitRequests }))
      return
    }
    if (request.method === 'GET' && ['/', '/a', '/b'].includes(url.pathname)) {
      response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' })
      response.end(page)
      return
    }
    response.writeHead(404, { 'cache-control': 'no-store' })
    response.end('not found')
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}
