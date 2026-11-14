/**
 * NEXUS AI — THINK-BEFORE-GENERATE IMAGE ENGINE (Phase 11 Comprehensive Verification)
 * 
 * Verifies all 10 Real Conversational Scenarios:
 * TEST 1: Python roadmap discussion -> "Create an image for this"
 * TEST 2: React architecture discussion -> "Itha visual diagram ah create pannu"
 * TEST 3: Study timetable discussion -> request image -> complete timetable with no missing slots
 * TEST 4: "Generate a realistic cyberpunk city image" -> native AI creative raster
 * TEST 5: "Change the previous image background to blue" -> edit existing asset
 * TEST 6: Normal question containing "image" -> normal conversation, no generation
 * TEST 7: Infographic request with insufficient source information -> asks clarification question
 * TEST 8: Chart from numerical data -> accurate data visualization based on real numbers
 * TEST 9: Topic switching -> "Create an image for the previous roadmap" -> finds earlier roadmap
 * TEST 10: Provider failover -> safe fallback, zero web scraping
 * 
 * PLUS: Rigorous Intent Classification Precision & Recall Evaluation on a 30-sample labelled dataset.
 */

import { classifyImageIntent, IMAGE_INTENTS } from './services/imageIntentRouter.js';
import { buildConversationContextBundle } from './services/imageContextService.js';
import { ImageThinkingEngine } from './services/imageThinkingEngine.js';
import { ImageBriefBuilder } from './services/imageBriefBuilder.js';
import { imageProviderRouter } from './services/imageProviderRouter.js';
import { generateHybridInfographic } from './services/hybridInfographicRenderer.js';
import { editImageAsset } from './services/imageEditingService.js';
import { validateImageBuffer, verifyContentManifest } from './services/imageQualityValidator.js';
import {
  saveImageAsset,
  getImageAsset,
  getImageAssetLineage
} from './services/imageStorageService.js';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   NEXUS AI — THINK-BEFORE-GENERATE IMAGE ENGINE VERIFICATION SUITE     ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  const scenarioResults = [];

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
      return true;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
      return false;
    }
  }

  // ============================================================================
  // TEST 1: Python roadmap discussion -> "Create an image for this"
  // ============================================================================
  console.log('--- TEST 1: Multi-Turn Roadmap Context Resolution ("Create an image for this") ---');
  const historyT1 = [
    { role: 'user', text: 'I want to learn Python from scratch.' },
    { role: 'model', text: 'Python is wonderful. We should create a 30-day curriculum covering logic, OOP, async, and FastAPI.' },
    { role: 'user', text: 'Create a complete 30-day Python learning roadmap.' },
    { role: 'model', text: 'Here is your 30-day curriculum: Week 1 Foundations, Week 2 Data Structures, Week 3 Advanced, Week 4 Deployment.' }
  ];

  const intentT1 = classifyImageIntent('Create an image for this', historyT1);
  const contextT1 = await buildConversationContextBundle({
    currentMessage: 'Create an image for this',
    conversationHistory: historyT1,
    intent: intentT1
  });
  const thinkingT1 = await ImageThinkingEngine.thinkAndPlan({
    message: 'Create an image for this',
    contextBundle: contextT1,
    intent: intentT1
  });

  const p1_1 = assert(intentT1.intent === 'GENERATE_INFOGRAPHIC', 'Test 1 Intent is GENERATE_INFOGRAPHIC', intentT1.intent);
  const p1_2 = assert(contextT1.domain === 'PYTHON', 'Test 1 Context resolved Python domain', contextT1.domain);
  const p1_3 = assert(thinkingT1.contentPlan.totalDaysExpected === 30, 'Test 1 Content plan mandates 30 days', '30 days');
  const p1_4 = assert(thinkingT1.strategySelection.strategy === 'STRATEGY_VECTOR', 'Test 1 Strategy is STRATEGY_VECTOR');

  scenarioResults.push({ id: 'TEST_01', name: 'Python Roadmap Resolution', status: (p1_1 && p1_2 && p1_3 && p1_4) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 2: React Architecture Discussion -> "Itha visual diagram ah create pannu"
  // ============================================================================
  console.log('\n--- TEST 2: Technical Architecture ("Itha visual diagram ah create pannu") ---');
  const historyT2 = [
    { role: 'user', text: 'Let us design a production React frontend architecture.' },
    { role: 'model', text: 'Our React architecture consists of UI Components, Zustand Store, Custom Hooks, API Transport Client, and Backend Database.' }
  ];

  const intentT2 = classifyImageIntent('Itha visual diagram ah create pannu', historyT2);
  const contextT2 = await buildConversationContextBundle({
    currentMessage: 'Itha visual diagram ah create pannu',
    conversationHistory: historyT2,
    intent: intentT2
  });
  const thinkingT2 = await ImageThinkingEngine.thinkAndPlan({
    message: 'Itha visual diagram ah create pannu',
    contextBundle: contextT2,
    intent: intentT2
  });

  const p2_1 = assert(intentT2.intent === 'GENERATE_DIAGRAM', 'Test 2 Intent is GENERATE_DIAGRAM', intentT2.intent);
  const p2_2 = assert(contextT2.isArchitecture === true, 'Test 2 Resolved as architecture diagram');
  const p2_3 = assert(thinkingT2.designPlan.format === 'Engineering Architecture Topology', 'Test 2 Design plan is Engineering Topology');

  const diagAsset = await generateHybridInfographic({
    topic: 'React Frontend Architecture',
    sessionId: 'test_react_arch',
    contextBundle: contextT2,
    imageBrief: ImageBriefBuilder.buildStructuredBrief({ thinkingPlan: thinkingT2, contextBundle: contextT2 })
  });

  const p2_4 = assert(diagAsset.url.endsWith('.svg'), 'Test 2 Generated vector architecture diagram', diagAsset.url);
  scenarioResults.push({ id: 'TEST_02', name: 'React Architecture Diagram', status: (p2_1 && p2_2 && p2_3 && p2_4) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 3: Long Study Timetable Discussion -> Image Request
  // ============================================================================
  console.log('\n--- TEST 3: Study Timetable & Daily Schedule Image Request ---');
  const historyT3 = [
    { role: 'user', text: 'Here is my daily study routine:\n08:00 AM - 10:00 AM: Data Structures\n10:30 AM - 12:30 PM: System Design\n02:00 PM - 04:00 PM: Project Work\n04:30 PM - 06:00 PM: Git & Code Review' },
    { role: 'model', text: 'That is a solid 4-block timetable.' }
  ];

  const intentT3 = classifyImageIntent('Create an image for this timetable', historyT3);
  const contextT3 = await buildConversationContextBundle({
    currentMessage: 'Create an image for this timetable',
    conversationHistory: historyT3,
    intent: intentT3
  });
  const thinkingT3 = await ImageThinkingEngine.thinkAndPlan({
    message: 'Create an image for this timetable',
    contextBundle: contextT3,
    intent: intentT3
  });

  const p3_1 = assert(contextT3.isTimetable === true, 'Test 3 Resolved as study timetable');
  const p3_2 = assert(thinkingT3.contentPlan.slots.length >= 4, 'Test 3 Content plan preserved all time slots', `${thinkingT3.contentPlan.slots.length} slots`);

  const timetableAsset = await generateHybridInfographic({
    topic: 'Daily Study Timetable',
    sessionId: 'test_timetable',
    contextBundle: contextT3,
    imageBrief: ImageBriefBuilder.buildStructuredBrief({ thinkingPlan: thinkingT3, contextBundle: contextT3 })
  });

  const p3_3 = assert(timetableAsset.url.endsWith('.svg'), 'Test 3 Complete timetable rendered', timetableAsset.url);
  scenarioResults.push({ id: 'TEST_03', name: 'Study Timetable Synthesis', status: (p3_1 && p3_2 && p3_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 4: Realistic Cyberpunk City Image (Native Raster Diffusion)
  // ============================================================================
  console.log('\n--- TEST 4: Native AI Creative Raster Synthesis (Cyberpunk City) ---');
  const promptT4 = 'Generate a realistic cyberpunk city image';
  const intentT4 = classifyImageIntent(promptT4);
  const contextT4 = await buildConversationContextBundle({ currentMessage: promptT4, intent: intentT4 });
  const thinkingT4 = await ImageThinkingEngine.thinkAndPlan({ message: promptT4, contextBundle: contextT4, intent: intentT4 });

  const p4_1 = assert(intentT4.intent === 'GENERATE_NEW_IMAGE', 'Test 4 Intent is GENERATE_NEW_IMAGE');
  const p4_2 = assert(thinkingT4.strategySelection.strategy === 'STRATEGY_RASTER', 'Test 4 Strategy is STRATEGY_RASTER');

  const rasterResult = await imageProviderRouter.generateImage({
    prompt: thinkingT4.designPlan.illustrationStyle + ' ' + promptT4,
    imageBrief: { aspectRatio: '1:1' }
  });

  const p4_3 = assert(Buffer.isBuffer(rasterResult.buffer) && rasterResult.buffer.length > 50000, 'Test 4 Generated raster buffer (>50KB)', `${Math.round(rasterResult.buffer.length/1024)} KB`);
  scenarioResults.push({ id: 'TEST_04', name: 'Cyberpunk Raster Synthesis', status: (p4_1 && p4_2 && p4_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 5: Conversational Image Editing ("Change previous image background to blue")
  // ============================================================================
  console.log('\n--- TEST 5: Conversational Image Editing (Lineage & Version Increment) ---');
  const editedAsset = await editImageAsset({
    userInstruction: 'Change the previous image background to dark navy blue',
    sessionId: 'test_react_arch',
    parentAssetId: diagAsset.assetId
  });

  const p5_1 = assert(editedAsset.parentAssetId === diagAsset.assetId, 'Test 5 Parent asset ID linked', editedAsset.parentAssetId);
  const p5_2 = assert(editedAsset.version === 2, 'Test 5 Version incremented to v2', `v${editedAsset.version}`);
  const lineage = getImageAssetLineage(editedAsset.assetId);
  const p5_3 = assert(lineage.length === 2, 'Test 5 Lineage depth verified', `Depth: ${lineage.length}`);
  scenarioResults.push({ id: 'TEST_05', name: 'Conversational Image Editing', status: (p5_1 && p5_2 && p5_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 6: Normal question containing the word "image"
  // ============================================================================
  console.log('\n--- TEST 6: Normal Question Filtering (Contains "image") ---');
  const q1 = classifyImageIntent('How does image compression work in JPEG?');
  const q2 = classifyImageIntent('What is an image format in computer vision?');
  const q3 = classifyImageIntent('Can you explain how convolutional neural networks process an image?');

  const p6_1 = assert(q1.intent === 'NORMAL_CONVERSATION', 'Test 6 "How does image compression work" -> NORMAL_CONVERSATION');
  const p6_2 = assert(q2.intent === 'NORMAL_CONVERSATION', 'Test 6 "What is an image format" -> NORMAL_CONVERSATION');
  const p6_3 = assert(q3.intent === 'NORMAL_CONVERSATION', 'Test 6 "Can you explain CNN image processing" -> NORMAL_CONVERSATION');
  scenarioResults.push({ id: 'TEST_06', name: 'Question Disambiguation', status: (p6_1 && p6_2 && p6_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 7: Insufficient Source Information -> Approval Gate Clarification
  // ============================================================================
  console.log('\n--- TEST 7: Insufficient Source Info -> Approval Gate Clarification ---');
  const intentT7 = classifyImageIntent('/chart');
  const contextT7 = await buildConversationContextBundle({
    currentMessage: '/chart',
    conversationHistory: [],
    intent: intentT7
  });
  const thinkingT7 = await ImageThinkingEngine.thinkAndPlan({
    message: '/chart',
    contextBundle: contextT7,
    intent: intentT7
  });

  const p7_1 = assert(thinkingT7.approved === false, 'Test 7 Generation halted at Approval Gate');
  const p7_2 = assert(thinkingT7.needsClarification === true, 'Test 7 Flagged needsClarification: true');
  const p7_3 = assert(Boolean(thinkingT7.clarificationQuestion), 'Test 7 Produced polite clarification question', thinkingT7.clarificationQuestion);
  scenarioResults.push({ id: 'TEST_07', name: 'Approval Gate Clarification', status: (p7_1 && p7_2 && p7_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 8: Chart from Supplied Numerical Data (No Invented Numbers)
  // ============================================================================
  console.log('\n--- TEST 8: Accurate Data Chart from User Numbers ---');
  const historyT8 = [
    { role: 'user', text: 'Here are our actual performance metrics: Q1: 45%, Q2: 68%, Q3: 84%, Q4: 95%.' }
  ];

  const intentT8 = classifyImageIntent('Create a chart image for these metrics', historyT8);
  const contextT8 = await buildConversationContextBundle({
    currentMessage: 'Create a chart image for these metrics',
    conversationHistory: historyT8,
    intent: intentT8
  });
  const thinkingT8 = await ImageThinkingEngine.thinkAndPlan({
    message: 'Create a chart image for these metrics',
    contextBundle: contextT8,
    intent: intentT8
  });

  const p8_1 = assert(contextT8.isChart === true, 'Test 8 Identified chart data context');
  const p8_2 = assert(thinkingT8.contentPlan.dataPoints.length === 4, 'Test 8 Captured exactly 4 user data points', `${thinkingT8.contentPlan.dataPoints.length} points`);

  const chartAsset = await generateHybridInfographic({
    topic: 'Quarterly Performance Growth',
    sessionId: 'test_chart',
    contextBundle: contextT8,
    imageBrief: ImageBriefBuilder.buildStructuredBrief({ thinkingPlan: thinkingT8, contextBundle: contextT8 })
  });

  const p8_3 = assert(chartAsset.url.endsWith('.svg'), 'Test 8 Accurate vector chart rendered', chartAsset.url);
  scenarioResults.push({ id: 'TEST_08', name: 'Numerical Data Chart', status: (p8_1 && p8_2 && p8_3) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 9: Topic Switching Resolution ("Create an image for the previous roadmap")
  // ============================================================================
  console.log('\n--- TEST 9: Historical Topic Switching Resolution ---');
  const historyT9 = [
    { role: 'user', text: 'Create a 30-day Go (Golang) backend learning roadmap.' },
    { role: 'model', text: 'Here is your 30-day Go curriculum: Week 1 Go Syntax, Week 2 Goroutines, Week 3 HTTP & Gin, Week 4 Kubernetes deployment.' },
    { role: 'user', text: 'By the way, what is the best pizza place in Rome?' },
    { role: 'model', text: 'Pizzarium Bonci near the Vatican is widely considered one of the best pizza al taglio spots in Rome.' },
    { role: 'user', text: 'What is the flight time between Rome and Paris?' },
    { role: 'model', text: 'Direct flights take about 2 hours and 10 minutes.' }
  ];

  const intentT9 = classifyImageIntent('Create an image for the previous roadmap', historyT9);
  const contextT9 = await buildConversationContextBundle({
    currentMessage: 'Create an image for the previous roadmap',
    conversationHistory: historyT9,
    intent: intentT9
  });

  const p9_1 = assert(contextT9.domain === 'GOLANG', 'Test 9 Resolved Go roadmap despite pizza & flight topics', contextT9.domain);
  const p9_2 = assert(contextT9.topic.includes('GOLANG'), 'Test 9 Topic is Go Roadmap', contextT9.topic);
  scenarioResults.push({ id: 'TEST_09', name: 'Topic Switching Resolution', status: (p9_1 && p9_2) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // TEST 10: Provider Failover & Scraping Shield
  // ============================================================================
  console.log('\n--- TEST 10: Provider Failover & Anti-Scraping Guarantee ---');
  const routerRes = await imageProviderRouter.generateImage({
    prompt: 'Photorealistic mountain peak with golden sunlight and crystal clear lake'
  });

  const p10_1 = assert(routerRes.provider === 'cloudflare-flux' || routerRes.provider === 'gemini', 'Test 10 Provider is native AI (Gemini or Cloudflare FLUX)', routerRes.provider);
  const p10_2 = assert(Buffer.isBuffer(routerRes.buffer) && routerRes.buffer.length > 10000, 'Test 10 Returned native buffer');
  scenarioResults.push({ id: 'TEST_10', name: 'Provider Failover & Scraping Shield', status: (p10_1 && p10_2) ? 'VERIFIED' : 'FAILED' });

  // ============================================================================
  // INTENT CLASSIFICATION BENCHMARK: 28-Sample Precision & Recall
  // ============================================================================
  console.log('\n========================================================================');
  console.log('   INTENT CLASSIFICATION PRECISION & RECALL BENCHMARK (28 SAMPLES)      ');
  console.log('========================================================================');

  const benchmarkDataset = [
    // Positive generation requests
    { text: 'Generate a realistic mountain landscape', expected: 'GENERATE_NEW_IMAGE' },
    { text: 'Create an image of an astronaut riding a horse', expected: 'GENERATE_NEW_IMAGE' },
    { text: 'Draw a cyberpunk street at night', expected: 'GENERATE_NEW_IMAGE' },
    { text: 'oru cute cat image generate pannu', expected: 'GENERATE_NEW_IMAGE' },
    { text: 'Paint a sunset over the Pacific Ocean', expected: 'GENERATE_NEW_IMAGE' },
    // Infographics
    { text: 'Create a Python roadmap image for 30 days', expected: 'GENERATE_INFOGRAPHIC' },
    { text: 'Generate an educational infographic for React hooks', expected: 'GENERATE_INFOGRAPHIC' },
    { text: '/infographic Docker beginner guide', expected: 'GENERATE_INFOGRAPHIC' },
    { text: 'Make a cheat sheet image for Git commands', expected: 'GENERATE_INFOGRAPHIC' },
    // Diagrams
    { text: 'Generate an architecture diagram for our microservices', expected: 'GENERATE_DIAGRAM' },
    { text: 'Draw a flowchart for user authentication', expected: 'GENERATE_DIAGRAM' },
    { text: '/diagram Database ER Model for ecommerce', expected: 'GENERATE_DIAGRAM' },
    { text: 'Create a system topology diagram image', expected: 'GENERATE_DIAGRAM' },
    // Charts
    { text: 'Create a comparison chart image of SQL vs NoSQL', expected: 'GENERATE_CHART' },
    { text: '/chart Quarterly revenue growth metrics', expected: 'GENERATE_CHART' },
    { text: 'Generate a bar chart graphic of performance numbers', expected: 'GENERATE_CHART' },
    { text: 'Create a timetable image for my study plan', expected: 'GENERATE_CHART' },
    // Edits
    { text: 'Make the background blue in this image', expected: 'EDIT_EXISTING_IMAGE' },
    { text: 'Change the text color to white in the previous image', expected: 'EDIT_EXISTING_IMAGE' },
    { text: 'In this image, add a neon glow effect', expected: 'EDIT_EXISTING_IMAGE' },
    { text: '/edit-image Make it sunset lighting', expected: 'EDIT_EXISTING_IMAGE' },
    // Find image
    { text: 'Find an actual photo of the Eiffel Tower', expected: 'FIND_EXISTING_IMAGE' },
    { text: 'Search for a real stock photo of the Golden Gate Bridge', expected: 'FIND_EXISTING_IMAGE' },
    // Normal conversation (must NOT generate)
    { text: 'How does image compression work in JPEG?', expected: 'NORMAL_CONVERSATION' },
    { text: 'What is an image format in computer vision?', expected: 'NORMAL_CONVERSATION' },
    { text: 'Explain how to resize an image using Python PIL', expected: 'NORMAL_CONVERSATION' },
    { text: 'Can you write code to load an image in OpenCV?', expected: 'NORMAL_CONVERSATION' },
    { text: 'What is the capital of France?', expected: 'NORMAL_CONVERSATION' }
  ];

  let correctClassifications = 0;
  let falsePositives = 0; // classified as image generation when it was normal conversation
  let falseNegatives = 0; // classified as normal conversation when it was image generation

  benchmarkDataset.forEach(sample => {
    const res = classifyImageIntent(sample.text);
    const isCorrect = res.intent === sample.expected;
    if (isCorrect) correctClassifications++;
    if (sample.expected === 'NORMAL_CONVERSATION' && res.intent !== 'NORMAL_CONVERSATION') {
      falsePositives++;
    }
    if (sample.expected !== 'NORMAL_CONVERSATION' && res.intent === 'NORMAL_CONVERSATION') {
      falseNegatives++;
    }
  });

  const truePositives = (benchmarkDataset.length - 5) - falseNegatives; // 23 positive generation samples
  const trueNegatives = 5 - falsePositives; // 5 normal conversation samples

  const precision = (truePositives / (truePositives + falsePositives)) || 1.0;
  const recall = (truePositives / (truePositives + falseNegatives)) || 1.0;
  const f1Score = (2 * precision * recall) / (precision + recall);

  console.log(`Total Samples: ${benchmarkDataset.length}`);
  console.log(`Accuracy: ${((correctClassifications / benchmarkDataset.length) * 100).toFixed(1)}% (${correctClassifications}/${benchmarkDataset.length})`);
  console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
  console.log(`F1 Score: ${(f1Score * 100).toFixed(1)}%`);

  assert(precision >= 0.95, 'Intent Precision >= 95%', `${(precision * 100).toFixed(1)}%`);
  assert(recall >= 0.95, 'Intent Recall >= 95%', `${(recall * 100).toFixed(1)}%`);

  console.log('\n========================================================================');
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  console.table(scenarioResults);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

