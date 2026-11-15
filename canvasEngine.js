import { GoogleGenAI } from '@google/genai';
import { AIProviderManager } from './orchestration/aiProviderManager.js';
import { validateProjectFiles, validateCode } from './services/codeValidator.js';

let sharedProviderManager = null;
function getProviderManager() {
  if (!sharedProviderManager) {
    sharedProviderManager = new AIProviderManager();
  }
  return sharedProviderManager;
}

/**
 * Interactive Canvas AI Transformation Engine (Claude Artifacts / ChatGPT Canvas standard)
 * Executes targeted in-place refactorings, bug fixes, documentation, and translations on code or text.
 */
export async function executeCanvasAction({
  client,
  content,
  language = 'javascript',
  action = 'refactor',
  customInstruction = '',
  isTamil = false
}) {
  const actionPrompts = {
    refactor: `You are an Elite Senior Software Architect.
Refactor the following ${language} code for maximum readability, performance, Clean Code, and SOLID principles.
Preserve exact external behavior.
Return the updated code followed by a brief summary of what was optimized.`,

    fix: `You are an Expert Debugging Engineer.
Inspect the following ${language} code, identify all bugs, memory leaks, security flaws, or edge-case runtime errors, and produce a fully fixed version.
Return the corrected code followed by a bulleted explanation of what was fixed.`,

    comments: `You are a Technical Documentation Specialist.
Add clean, meaningful JSDoc / docstrings and inline explanatory comments explaining complex algorithms in this ${language} code without cluttering it.`,

    translate: `Translate the following content/documentation into high-quality conversational Tanglish (clear bilingual English & Tanglish using English/Latin alphabet only, preserving technical keywords in English). STRICTLY DO NOT use Tamil script.`
  };

  const selectedInstruction = actionPrompts[action] || actionPrompts.refactor;
  const prompt = `${selectedInstruction}
${customInstruction ? `Additional User Request: "${customInstruction}"` : ''}

=== SOURCE CONTENT ===
${content}
=== END SOURCE CONTENT ===

Formatting Instructions:
Output the full modified code inside a single markdown code fence (\`\`\`${language}\n...\n\`\`\`).
Below the code block, provide a short 2-3 sentence explanation of the changes made.`;

  let fullText = '';
  try {
    const mgr = getProviderManager();
    const res = await mgr.generateText({
      prompt,
      maxTokens: 2500,
      temperature: 0.2
    });
    fullText = res?.text || '';
  } catch (mgrErr) {
    console.warn('[CanvasEngine] AIProviderManager fallback notice:', mgrErr.message);
  }

  if (!fullText && client?.models?.generateContent) {
    try {
      const res = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 2500
        }
      });
      fullText = res.text || '';
    } catch (err) {
      console.warn('[CanvasEngine] Client fallback error:', err.message);
    }
  }

  if (!fullText) {
    throw new Error('Unable to generate AI transformation across available providers.');
  }

  const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
  const updatedCode = codeMatch ? codeMatch[1].trim() : content;
  const explanation = fullText.replace(/```(?:[a-zA-Z0-9_-]+)?\s*[\s\S]*?```/, '').trim();

  return {
    success: true,
    action,
    language,
    updatedCode,
    explanation: explanation || 'Code successfully updated with AI transformations.'
  };
}

function getFileLanguage(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html': case 'htm': return 'html';
    case 'css': return 'css';
    case 'js': case 'mjs': case 'cjs': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    default: return 'javascript';
  }
}

/**
 * Autonomous Multi-File AI Code Copilot & Project Generator
 * (VS Code Copilot / Cursor Composer / Antigravity tier)
 * Can generate multi-file projects, create new files, update existing files, and provide execution summaries.
 */
export async function executeAutonomousStudioGeneration({
  client,
  instruction,
  files = [],
  activeFileName = '',
  language = 'javascript'
}) {
  const fileContexts = files.map(f => `--- FILE: ${f.name} (${f.language}) ---\n${f.content}\n--- END FILE ---`).join('\n\n');

  const prompt = `You are RAGHUL AI Autonomous Code Architect & Copilot (comparable to VS Code Copilot, Cursor Composer, and Antigravity).
The developer wants to generate, modify, or extend their multi-file code project.

=== DEVELOPER INSTRUCTION ===
${instruction}

=== CURRENT PROJECT FILES ===
${fileContexts || '(New Project - No existing files)'}
${activeFileName ? `(Currently active file: ${activeFileName})` : ''}

=== YOUR TASK & STRICT FORMATTING RULES ===
1. Analyze the developer instruction and existing project files.
2. You have FULL AUTHORITY to modify existing files, create brand-new files (e.g. style.css, script.js, utils.py, etc.), or generate a complete multi-file project from scratch.
3. For EVERY file created or modified, format it strictly with a file header:
### FILE: filename.ext
\`\`\`language
// complete code content here
\`\`\`
4. Do NOT output partial diffs, placeholders, or truncated code (e.g., no "// ... rest of code"). Output the FULL, runnable code for each file.
5. If creating a modern web page, provide complete separation of concerns:
   - index.html (semantic HTML5, linking style.css and script.js)
   - style.css (modern responsive CSS, smooth animations, CSS custom properties, glassmorphism/dark theme)
   - script.js (interactive DOM handlers, event listeners, clean modern JavaScript)
6. At the end, output a 2-4 sentence summary of the architectural changes and features created under:
### SUMMARY
<Your explanation here>
`;

  let fullText = '';
  try {
    const mgr = getProviderManager();
    const res = await mgr.generateText({
      prompt,
      maxTokens: 4000,
      temperature: 0.2
    });
    fullText = res?.text || '';
  } catch (mgrErr) {
    console.warn('[CanvasEngine] AIProviderManager fallback notice:', mgrErr.message);
  }

  if (!fullText && client?.models?.generateContent) {
    try {
      const res = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      });
      fullText = res.text || '';
    } catch (err) {
      console.warn('[CanvasEngine] Client fallback error:', err.message);
    }
  }

  if (!fullText) {
    throw new Error('Unable to generate AI code across available providers.');
  }

  // Parse files from response: match ### FILE: filename \n ```lang \n content \n ```
  const fileRegex = /###\s*(?:FILE:?|filename:?)\s*([a-zA-Z0-9_\-\.\/]+)[\r\n]+```([a-zA-Z0-9_\-]+)?\s*([\s\S]*?)```/gi;
  const parsedFiles = [];
  let match;
  while ((match = fileRegex.exec(fullText)) !== null) {
    const fileName = match[1].trim();
    const lang = (match[2] || getFileLanguage(fileName)).trim().toLowerCase();
    const content = match[3].trim();
    parsedFiles.push({
      name: fileName,
      language: lang || getFileLanguage(fileName),
      content
    });
  }

  // Fallback: If no "### FILE:" headers were produced but standard code blocks exist
  if (parsedFiles.length === 0) {
    const codeBlockRegex = /```([a-zA-Z0-9_\-]+)?\s*([\s\S]*?)```/g;
    let cbMatch;
    let counter = 1;
    while ((cbMatch = codeBlockRegex.exec(fullText)) !== null) {
      const cbLang = (cbMatch[1] || language || 'javascript').toLowerCase();
      let defaultName = `file_${counter}.js`;
      if (['html', 'htm'].includes(cbLang)) defaultName = counter === 1 ? 'index.html' : `page_${counter}.html`;
      else if (['css'].includes(cbLang)) defaultName = counter === 1 ? 'style.css' : `theme_${counter}.css`;
      else if (['js', 'javascript'].includes(cbLang)) defaultName = counter === 1 ? 'script.js' : `utils_${counter}.js`;
      else if (['py', 'python'].includes(cbLang)) defaultName = counter === 1 ? 'main.py' : `module_${counter}.py`;
      
      parsedFiles.push({
        name: defaultName,
        language: cbLang,
        content: cbMatch[2].trim()
      });
      counter++;
    }
  }

  // Extract Summary
  const summaryMatch = fullText.match(/###\s*SUMMARY\s*([\s\S]*?)$/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : 'Project files successfully generated and updated by RAGHUL AI Copilot.';

  // Automated Pre-Delivery AST & Quality Validation
  const validation = validateProjectFiles(parsedFiles);

  return {
    success: true,
    files: parsedFiles,
    summary,
    validation,
    rawOutput: fullText
  };
}

