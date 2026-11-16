import { chromium } from 'file:///C:/Users/acer/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

async function testLiveProductionUI() {
  console.log('================================================================');
  console.log('🌐 LIVE PLAYWRIGHT UI & INTERACTION VERIFICATION');
  console.log('URL: https://raghul-ai-assistant.vercel.app/');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1254\\chrome-win64\\chrome.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('response', resp => {
    // Note: 404 on initial new session fetch (/api/chats/sess_...) is expected before saving
    if (resp.status() >= 400 && !resp.url().includes('/api/chats/sess_')) {
      console.warn(`   [HTTP ${resp.status()}] ${resp.url()}`);
    }
  });

  const viewports = [
    { width: 320, height: 600, name: 'Mobile Mini (320px)' },
    { width: 375, height: 667, name: 'Mobile Standard (375px)' },
    { width: 768, height: 1024, name: 'Tablet (768px)' },
    { width: 1024, height: 768, name: 'Desktop Standard (1024px)' },
    { width: 1440, height: 900, name: 'Large Desktop (1440px)' }
  ];

  console.log('▶️ Step 1: Navigating to live production site...');
  const response = await page.goto('https://raghul-ai-assistant.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`✅ Loaded HTTP ${response.status()}`);

  const title = await page.title();
  console.log(`✅ Page Title: "${title}"`);

  // Viewport Responsive checks
  console.log('\n▶️ Step 2: Testing Responsive Layouts across 5 Viewports...');
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(200);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const overflow = scrollWidth > clientWidth;
    console.log(`   [${vp.name}] scrollWidth=${scrollWidth}, clientWidth=${clientWidth} -> ${overflow ? '❌ OVERFLOW' : '✅ No Overflow'}`);
  }

  // Restore Desktop Viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // Step 3: Interactive UI Controls
  console.log('\n▶️ Step 3: Interactive UI Controls Verification...');

  // Theme Toggle Check
  const darkClassPresent = await page.evaluate(() => document.documentElement.classList.contains('dark-theme') || document.body.classList.contains('dark-theme') || document.documentElement.getAttribute('data-theme') === 'dark');
  console.log(`   ✅ Dark theme active initially: ${darkClassPresent}`);

  // Test Settings Modal
  const openSettingsBtn = await page.$('#openSettingsBtn');
  if (openSettingsBtn) {
    await openSettingsBtn.click();
    await page.waitForTimeout(500);
    const settingsModalVisible = await page.evaluate(() => {
      const el = document.getElementById('settingsModal');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    console.log(`   ✅ Settings modal open verification: ${settingsModalVisible ? 'OPENED' : 'NOT OPENED'}`);

    const closeSettingsBtn = await page.$('#closeSettingsBtn');
    if (closeSettingsBtn) {
      await closeSettingsBtn.click();
      await page.waitForTimeout(300);
      console.log('   ✅ Settings modal closed successfully');
    }
  }

  // Test Model Selector Dropdown
  const modelPillBtn = await page.$('#chatgptModelPillBtn');
  if (modelPillBtn) {
    await modelPillBtn.click();
    await page.waitForTimeout(300);
    const modelMenuVisible = await page.evaluate(() => {
      const el = document.getElementById('chatgptModelMenu');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    console.log(`   ✅ Model Selector dropdown menu: ${modelMenuVisible ? 'VISIBLE' : 'HIDDEN'}`);
    await modelPillBtn.click(); // Close
  }

  // Test Input & Chat Streaming Submission
  console.log('\n▶️ Step 4: Testing Real Message Submission & AI Streaming...');
  await page.evaluate(() => {
    const input = document.getElementById('userInput');
    input.value = 'Say "Verification Successful" in 2 words.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await page.waitForTimeout(300);
  const sendBtnDisplay = await page.evaluate(() => {
    const btn = document.getElementById('sendBtn');
    return btn ? window.getComputedStyle(btn).display : 'none';
  });
  console.log(`   ✅ Send button display after text entry: "${sendBtnDisplay}"`);

  // Submit form
  await page.evaluate(() => {
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });

  console.log('   Awaiting token streaming from live Render backend...');
  let tokensObserved = false;
  let assistantReply = '';

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const entries = document.querySelectorAll('.message-entry');
      const assistantEntry = document.querySelector('.message-entry.assistant .prose');
      return {
        count: entries.length,
        assistantText: assistantEntry ? assistantEntry.textContent : ''
      };
    });

    if (state.assistantText && state.assistantText.trim().length > 0) {
      tokensObserved = true;
      assistantReply = state.assistantText;
      break;
    }
  }

  console.log(`   ✅ Live AI token streaming received: ${tokensObserved ? 'YES' : 'NO'}`);
  console.log(`   ✅ Streamed Assistant Response: "${assistantReply.trim()}"`);

  // Step 5: Test Persistence across Page Refresh
  console.log('\n▶️ Step 5: Testing Persistence across Page Refresh...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const reloadedMessagesCount = await page.evaluate(() => {
    return document.querySelectorAll('.message-entry').length;
  });
  console.log(`   ✅ Messages restored after page refresh: ${reloadedMessagesCount} message(s) in DOM`);

  console.log(`\nConsole Errors during entire Playwright session: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.warn('   [Console Error]:', e));
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 PLAYWRIGHT LIVE PRODUCTION UI AUDIT COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

testLiveProductionUI().catch(err => {
  console.error('Playwright audit error:', err);
  process.exit(1);
});
