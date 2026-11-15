/**
 * TEST SUITE: Real-Time Voice Mode & Voice Input (ChatGPT Style)
 * Validates endpoint latency, spoken formatting, zero-markdown enforcement,
 * bilingual Tamil/English response, and DOM components.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runVoiceTests() {
  console.log('================================================================');
  console.log('🎙️ RAGHUL AI — REAL-TIME VOICE MODE & DICTATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  // 1. DOM Components Verification
  console.log('1. DOM Components & Controls');
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'public/index.html'), 'utf8');
  assert(indexHtml.includes('id="micBtn"'), 'Microphone dictation button (#micBtn) exists');
  assert(indexHtml.includes('id="micLangToggleBtn"'), 'Dictation language toggle (#micLangToggleBtn) exists');
  assert(indexHtml.includes('id="voiceModeBtn"'), 'Real-time voice mode button (#voiceModeBtn) exists');
  assert(indexHtml.includes('id="voiceModeOverlay"'), 'Voice mode overlay (#voiceModeOverlay) exists');
  assert(indexHtml.includes('id="voiceOrbCenterBtn"'), 'Voice orb center tap target (#voiceOrbCenterBtn) exists');
  assert(indexHtml.includes('id="voiceLiveWaveform"'), 'Dynamic audio waveform (#voiceLiveWaveform) exists');
  assert(indexHtml.includes('id="voiceLangToggleBtn"'), 'Voice overlay language switch (#voiceLangToggleBtn) exists');
  assert(indexHtml.includes('id="voiceMuteToggleBtn"'), 'Voice overlay mute button (#voiceMuteToggleBtn) exists');
  assert(indexHtml.includes('id="voiceEndCallBtn"'), 'Voice overlay end call button (#voiceEndCallBtn) exists');

  // 2. Client Engine Functions
  console.log('\n2. Frontend Engine (public/app.js)');
  const appJs = fs.readFileSync(path.join(PROJECT_ROOT, 'public/app.js'), 'utf8');
  assert(appJs.includes('startVoiceRecognition'), 'Continuous voice dictation (startVoiceRecognition) implemented');
  assert(appJs.includes('stopVoiceRecognition'), 'Dictation terminator (stopVoiceRecognition) implemented');
  assert(appJs.includes('updateDictationLangUI'), 'Dictation language switcher (updateDictationLangUI) implemented');
  assert(appJs.includes('initVoiceAudioVisualizer'), 'Live Web Audio Analyser visualizer (initVoiceAudioVisualizer) implemented');
  assert(appJs.includes('startAdvancedVoiceMode'), 'ChatGPT-style Voice Mode (startAdvancedVoiceMode) implemented');
  assert(appJs.includes('handleVoiceQuery'), 'Low-latency dialogue loop (handleVoiceQuery) implemented');

  // 3. Backend /api/voice/chat Endpoint
  console.log('\n3. Live Backend API (/api/voice/chat)');
  
  // Validation: Missing message returns 400
  const emptyRes = await postJson('http://localhost:3000/api/voice/chat', { message: ' ' });
  assert(emptyRes.status === 400, 'POST /api/voice/chat returns 400 on empty message');

  // English query latency and zero-markdown verification
  const enRes = await postJson('http://localhost:3000/api/voice/chat', {
    message: 'Hello Raghul AI, can you hear me clearly?',
    language: 'en'
  });
  assert(enRes.status === 200, 'POST /api/voice/chat returns 200 OK for English query');
  assert(Boolean(enRes.data?.reply), `Received spoken reply: "${enRes.data?.reply}"`);
  assert(!/[*#`_~>]/.test(enRes.data?.reply || ''), 'English reply contains ZERO markdown formatting (clean spoken text)');
  assert(typeof enRes.data?.latencyMs === 'number' && enRes.data?.latencyMs < 35000, `High-speed latency: ${enRes.data?.latencyMs}ms (< 35000ms threshold)`);

  // Tamil/Tanglish query verification
  const taRes = await postJson('http://localhost:3000/api/voice/chat', {
    message: 'portfolio la enna project iruku sollu',
    language: 'ta'
  });
  assert(taRes.status === 200, 'POST /api/voice/chat returns 200 OK for Tamil query');
  assert(taRes.data?.isTamil === true, 'Tamil/Tanglish auto-detected (isTamil: true)');
  assert(Boolean(taRes.data?.reply), `Received Tamil spoken reply: "${taRes.data?.reply}"`);
  assert(!/[*#`_~>]/.test(taRes.data?.reply || ''), 'Tamil reply contains ZERO markdown formatting (clean spoken text)');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVoiceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
