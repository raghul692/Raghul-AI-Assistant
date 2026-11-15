/**
 * TEST SUITE: PRODUCTION HEALTH, READINESS & SECURITY HEADERS
 */

process.env.PORT = '3099';
import assert from 'assert';
import http from 'http';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 VERIFY PRODUCTION HEALTH, READINESS & SECURITY HEADERS');
  console.log('================================================================\n');

  // Import server.js which will listen on port 3099
  await import('../server.js');
  const baseUrl = 'http://127.0.0.1:3099';

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(body); } catch (_) {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed || body
          });
        });
      });
      req.on('error', reject);
      if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      req.end();
    });
  }

  // Test 1: Liveness Probe (GET /health)
  console.log('--- Test 1: Liveness Probe (GET /health) ---');
  const healthRes = await request('/health');
  assert.strictEqual(healthRes.statusCode, 200, 'GET /health must return status 200');
  assert.strictEqual(healthRes.body.status, 'healthy');
  assert.strictEqual(healthRes.body.service, 'raghul-ai-api');
  assert(typeof healthRes.body.uptime === 'number');
  console.log('✅ [PASS] Liveness probe verified:', healthRes.body, '\n');

  // Test 2: Readiness Probe (GET /ready)
  console.log('--- Test 2: Readiness Probe (GET /ready) ---');
  const readyRes = await request('/ready');
  assert.strictEqual(readyRes.statusCode, 200, 'GET /ready must return status 200');
  assert.strictEqual(readyRes.body.status, 'ready');
  assert(readyRes.body.database && readyRes.body.database.status === 'healthy');
  assert(readyRes.headers['x-request-id'], 'Must inject X-Request-Id header');
  console.log('✅ [PASS] Readiness probe verified with DB status:', readyRes.body.database.driver, '\n');

  // Test 3: CORS Verification with Vercel Origin
  console.log('--- Test 3: Hardened CORS with Vercel Origin ---');
  const corsRes = await request('/health', {
    headers: {
      'Origin': 'https://raghulraja-portfolio.vercel.app'
    }
  });
  assert.strictEqual(corsRes.headers['access-control-allow-origin'], 'https://raghulraja-portfolio.vercel.app');
  assert.strictEqual(corsRes.headers['access-control-allow-credentials'], 'true');
  console.log('✅ [PASS] Vercel origin accepted by CORS headers.\n');

  // Test 4: Jobs API Endpoints
  console.log('--- Test 4: Jobs API Endpoint Inspection ---');
  const jobsRes = await request('/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jobType: 'document_generation',
      payload: { title: 'Health Suite Test' }
    })
  });
  assert.strictEqual(jobsRes.statusCode, 202, 'POST /api/jobs must return 202 Accepted');
  assert(jobsRes.body.jobId, 'Must return jobId');
  assert(jobsRes.body.streamUrl, 'Must return streamUrl');
  console.log('✅ [PASS] Jobs API endpoint verified:', jobsRes.body.jobId, '\n');

  console.log('🎉 Production Health, Readiness & Security verification completed successfully!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Health & Readiness test failed:', err);
  process.exit(1);
});
