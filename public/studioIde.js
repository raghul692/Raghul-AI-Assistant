/**
 * ============================================================================
 * RAGHUL AI — PROFESSIONAL VS CODE-GRADE IDE ENGINE (CANVAS STUDIO V3)
 * ============================================================================
 * Modular IDE Architecture:
 * 1. Monaco Editor Engine (VS Code core) with multi-language & diagnostics
 * 2. Real xterm.js Interactive Streaming Terminal (PowerShell/Bash)
 * 3. Full Workspace Tree Explorer & File System Operations
 * 4. Integrated Git Source Control (Status, Staging, Commit, Diff)
 * 5. Command Palette (Ctrl+Shift+P / F1)
 */

(function () {
  'use strict';

  // Language extension mapping for Monaco
  const EXT_TO_LANG = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
    py: 'python',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json',
    sql: 'sql',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    sh: 'shell', bash: 'shell', ps1: 'powershell',
    md: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml', svg: 'xml',
    dockerfile: 'dockerfile'
  };

  function getMonacoLanguage(filename = '') {
    const base = filename.split('/').pop().split('\\').pop().toLowerCase();
    if (base === 'dockerfile') return 'dockerfile';
    const ext = base.split('.').pop();
    return EXT_TO_LANG[ext] || 'plaintext';
  }

  // Master Studio IDE State
  window.studioIDE = {
    isInitialized: false,
    monaco: null,
    editor: null,
    activeModel: null,
    models: new Map(), // path -> monaco.editor.ITextModel
    terminalSessionId: null,
    terminalEventSource: null,
    xterm: null,
    activeSidebar: 'explorer',
    activeBottomTab: 'terminal',
    currentTheme: 'vs-dark',
    fontSize: 14,
    showMinimap: true,
    gitStatus: null
  };

  // =========================================================================
  // 1. MONACO EDITOR INITIALIZATION & CONTROLS
  // =========================================================================

  function initMonacoEditor(callback) {
    if (window.studioIDE.editor) {
      if (callback) callback(window.studioIDE.editor);
      return;
    }

    if (typeof window.require !== 'undefined') {
      window.require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
      });

      window.require(['vs/editor/editor.main'], function (monaco) {
        window.studioIDE.monaco = monaco;
        const container = document.getElementById('monacoMount');
        if (!container) return;

        const editor = monaco.editor.create(container, {
          value: '// Welcome to Raghul AI Professional Studio IDE\nconsole.log("VS Code-Grade AI Editor Ready.");',
          language: 'javascript',
          theme: window.studioIDE.currentTheme,
          fontSize: window.studioIDE.fontSize,
          fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
          minimap: { enabled: window.studioIDE.showMinimap },
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          tabSize: 2,
          renderWhitespace: 'selection'
        });

        window.studioIDE.editor = editor;
        window.studioIDE.isInitialized = true;

        // Sync model changes with active file
        editor.onDidChangeModelContent(() => {
          const content = editor.getValue();
          const { files, activeFileIndex } = window.canvasStudio || {};
          if (files && files[activeFileIndex]) {
            files[activeFileIndex].content = content;
          }
          const textarea = document.getElementById('canvasCodeTextarea');
          if (textarea) textarea.value = content;

          // Trigger debounced quality badge check
          if (typeof window.updateStudioQualityBadge === 'function') {
            clearTimeout(window._ideQualityDebounce);
            window._ideQualityDebounce = setTimeout(() => {
              window.updateStudioQualityBadge();
            }, 600);
          }
        });

        // Sync cursor position in status bar
        editor.onDidChangeCursorPosition((e) => {
          const statusCursor = document.getElementById('statusCursorPos');
          if (statusCursor) {
            statusCursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
          }
        });

        // Add Quick Formatting Shortcut: Shift+Alt+F
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
          editor.getAction('editor.action.formatDocument')?.run();
        });

        // Add Command Palette Shortcut: Ctrl+Shift+P / F1
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
          toggleCommandPalette(true);
        });

        if (callback) callback(editor);
      });
    } else {
      console.warn('[StudioIDE] Monaco loader script not detected; using fallback editor.');
      const fallback = document.getElementById('canvasCodeTextarea');
      if (fallback) fallback.style.display = 'block';
    }
  }

  // Switch or Create Monaco Model for file
  function switchMonacoFile(file) {
    if (!file) return;
    const { monaco, editor, models } = window.studioIDE;
    if (!monaco || !editor) {
      const textarea = document.getElementById('canvasCodeTextarea');
      if (textarea) textarea.value = file.content || '';
      return;
    }

    const filePath = file.name || 'unnamed.js';
    const lang = getMonacoLanguage(filePath);
    let model = models.get(filePath);

    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`file:///${filePath}`);
      model = monaco.editor.getModel(uri) || monaco.editor.createModel(file.content || '', lang, uri);
      models.set(filePath, model);
    } else {
      if (model.getValue() !== file.content) {
        model.setValue(file.content || '');
      }
    }

    editor.setModel(model);
    window.studioIDE.activeModel = model;

    // Update Status Bar Language
    const statusLang = document.getElementById('statusLanguageMode');
    if (statusLang) {
      statusLang.textContent = lang.toUpperCase();
    }

    // Update Breadcrumbs
    const breadcrumb = document.getElementById('breadcrumbPath');
    if (breadcrumb) {
      breadcrumb.textContent = `workspace > ${filePath}`;
    }
  }

  // Sync AST issues into Monaco Red Squigglies
  function setMonacoDiagnosticsMarkers(errors = [], warnings = []) {
    const { monaco, activeModel } = window.studioIDE;
    if (!monaco || !activeModel) return;

    const markers = [];
    errors.forEach((err) => {
      const line = Math.max(1, parseInt(err.line, 10) || 1);
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `[${err.rule}] ${err.message}`,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 120
      });
    });

    warnings.forEach((warn) => {
      const line = Math.max(1, parseInt(warn.line, 10) || 1);
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `[${warn.rule}] ${warn.message}`,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 120
      });
    });

    monaco.editor.setModelMarkers(activeModel, 'codeValidator', markers);

    const problemsBadge = document.getElementById('problemsBadgeCount');
    const statusProblems = document.getElementById('statusProblemsCount');
    const totalCount = errors.length + warnings.length;

    if (problemsBadge) problemsBadge.textContent = String(totalCount);
    if (statusProblems) {
      statusProblems.textContent = `${errors.length} errors, ${warnings.length} warnings`;
      statusProblems.style.color = errors.length > 0 ? '#f87171' : (warnings.length > 0 ? '#fbbf24' : '#94a3b8');
    }
  }

  // =========================================================================
  // 2. REAL XTERM.JS STREAMING TERMINAL
  // =========================================================================

  async function initInteractiveTerminal() {
    const mount = document.getElementById('xtermMount');
    if (!mount || window.studioIDE.xterm) return;

    if (typeof window.Terminal === 'undefined') {
      console.warn('[StudioIDE] xterm.js not loaded from CDN.');
      mount.innerHTML = '<div style="color:#f87171; padding:10px;">xterm.js runtime not available.</div>';
      return;
    }

    const term = new window.Terminal({
      theme: {
        background: '#090d14',
        foreground: '#f8fafc',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)'
      },
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
      lineHeight: 1.25,
      convertEol: true
    });

    term.open(mount);
    window.studioIDE.xterm = term;

    term.writeln('\x1b[1;36m=========================================================\x1b[0m');
    term.writeln('\x1b[1;32m  RAGHUL AI — HOST TERMINAL INTEGRATION (POWERSHELL/BASH)\x1b[0m');
    term.writeln('\x1b[1;36m=========================================================\x1b[0m\r\n');

    // Create session on server
    try {
      const res = await fetch('/api/terminal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols: term.cols, rows: term.rows })
      });
      const data = await res.json();
      if (!data.sessionId) throw new Error(data.error || 'Failed to initialize session');

      const sessionId = data.sessionId;
      window.studioIDE.terminalSessionId = sessionId;

      // Connect SSE stream
      const sse = new EventSource(`/api/terminal/stream?sessionId=${sessionId}`);
      window.studioIDE.terminalEventSource = sse;

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'data' || payload.type === 'replay') {
            term.write(payload.payload);
          } else if (payload.type === 'exit') {
            term.writeln(`\r\n\x1b[33m[Process completed with exit code ${payload.payload.exitCode}]\x1b[0m\r\n`);
          }
        } catch {
          term.write(event.data);
        }
      };

      sse.onerror = () => {
        console.warn('[StudioIDE] Terminal SSE reconnecting...');
      };

      // Handle user keyboard input
      term.onData((inputData) => {
        fetch('/api/terminal/input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, data: inputData })
        }).catch(err => console.error('[TerminalInput]', err));
      });

    } catch (err) {
      term.writeln(`\r\n\x1b[31mError connecting to host terminal shell: ${err.message}\x1b[0m`);
    }
  }

  function restartTerminalSession() {
    if (window.studioIDE.terminalEventSource) {
      window.studioIDE.terminalEventSource.close();
      window.studioIDE.terminalEventSource = null;
    }
    if (window.studioIDE.terminalSessionId) {
      fetch('/api/terminal/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: window.studioIDE.terminalSessionId })
      }).catch(() => {});
      window.studioIDE.terminalSessionId = null;
    }
    if (window.studioIDE.xterm) {
      window.studioIDE.xterm.dispose();
      window.studioIDE.xterm = null;
    }
    initInteractiveTerminal();
  }

  // =========================================================================
  // 3. WORKSPACE TREE FILE SYSTEM EXPLORER
  // =========================================================================

  async function loadWorkspaceTree() {
    const container = document.getElementById('studioWorkspaceTree');
    if (!container) return;

    try {
      const res = await fetch('/api/workspace/tree?depth=3');
      const data = await res.json();
      if (!data.success || !data.tree) throw new Error(data.error || 'Failed to load tree');

      const titleEl = document.getElementById('artifactTitle');
      if (titleEl && data.root) {
        titleEl.textContent = `${data.root} (Workspace)`;
      }

      container.innerHTML = renderTreeNodes(data.tree);
      attachTreeEventListeners(container);
    } catch (err) {
      container.innerHTML = `<div style="color:#f87171; padding:8px;">Error loading workspace tree: ${err.message}</div>`;
    }
  }

  function renderTreeNodes(nodes = []) {
    let html = '<ul style="list-style:none; padding-left:0; margin:0;">';
    for (const node of nodes) {
      if (node.type === 'directory') {
        html += `
          <li class="workspace-dir-node" data-path="${node.path}" style="margin:2px 0;">
            <div class="workspace-dir-header" style="display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:4px; cursor:pointer; color:#94a3b8; font-size:0.75rem; user-select:none;">
              <span class="dir-toggle-icon">▸</span>
              <span>📁</span>
              <span style="font-weight:600; color:#e2e8f0;">${node.name}</span>
            </div>
            <div class="workspace-dir-children" style="display:none; padding-left:14px;">
              ${node.children ? renderTreeNodes(node.children) : ''}
            </div>
          </li>
        `;
      } else {
        html += `
          <li class="workspace-file-node" data-path="${node.path}" style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-radius:4px; cursor:pointer; font-size:0.75rem; color:#cbd5e1; user-select:none;">
            <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden; text-overflow:ellipsis;">
              <span>📄</span>
              <span class="file-name-text">${node.name}</span>
            </div>
            <span style="font-size:0.65rem; color:#64748b;">${node.size ? (node.size > 1024 ? Math.round(node.size/1024)+'k' : node.size+'b') : ''}</span>
          </li>
        `;
      }
    }
    html += '</ul>';
    return html;
  }

  function attachTreeEventListeners(container) {
    // Directory toggle
    container.querySelectorAll('.workspace-dir-header').forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const parent = hdr.closest('.workspace-dir-node');
        const children = parent?.querySelector('.workspace-dir-children');
        const icon = hdr.querySelector('.dir-toggle-icon');
        if (children) {
          const isOpen = children.style.display === 'block';
          children.style.display = isOpen ? 'none' : 'block';
          if (icon) icon.textContent = isOpen ? '▸' : '▾';
        }
      });
    });

    // File click to open in editor
    container.querySelectorAll('.workspace-file-node').forEach((node) => {
      node.addEventListener('click', async () => {
        const filePath = node.getAttribute('data-path');
        if (!filePath) return;

        try {
          const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          const { files } = window.canvasStudio;
          const existingIdx = files.findIndex(f => f.name === data.path);

          if (existingIdx !== -1) {
            files[existingIdx].content = data.content;
            if (typeof window.switchStudioActiveFile === 'function') {
              window.switchStudioActiveFile(existingIdx);
            }
          } else {
            files.push({
              name: data.path,
              language: data.extension,
              content: data.content
            });
            const newIdx = files.length - 1;
            window.canvasStudio.openTabs.push(newIdx);
            if (typeof window.renderStudioTabs === 'function') {
              window.renderStudioTabs();
            }
            if (typeof window.switchStudioActiveFile === 'function') {
              window.switchStudioActiveFile(newIdx);
            }
          }

          switchMonacoFile({ name: data.path, language: data.extension, content: data.content });
        } catch (err) {
          console.error('[WorkspaceFileOpen]', err);
        }
      });
    });
  }

  // =========================================================================
  // 4. INTEGRATED GIT SOURCE CONTROL
  // =========================================================================

  async function loadGitStatus() {
    const container = document.getElementById('gitChangesContainer');
    const badge = document.getElementById('gitActivityBadge');
    const branchStatus = document.getElementById('statusGitBranch');

    try {
      const res = await fetch('/api/git/status');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      window.studioIDE.gitStatus = data;

      // Update Branch in Status Bar
      if (branchStatus && data.branch) {
        branchStatus.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
          <span>${data.branch}</span>
        `;
      }

      // Update Activity Bar Badge
      const totalChanges = data.counts.total;
      if (badge) {
        if (totalChanges > 0) {
          badge.style.display = 'block';
          badge.textContent = String(totalChanges);
        } else {
          badge.style.display = 'none';
        }
      }

      if (!container) return;

      if (data.clean) {
        container.innerHTML = '<div style="color:#64748b; font-size:0.75rem; padding:10px 0;">Working tree is clean. No unstaged changes.</div>';
        return;
      }

      let html = '';

      // Staged Changes
      if (data.staged.length > 0) {
        html += `<div class="git-section-title"><span>STAGED CHANGES (${data.staged.length})</span></div>`;
        data.staged.forEach(f => {
          html += `
            <div class="git-file-row">
              <span class="file-name" title="${f.file}">${f.file.split('/').pop()}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="git-badge-status git-badge-${f.status}">${f.status}</span>
                <button type="button" class="explorer-icon-btn btn-unstage-file" data-file="${f.file}" title="Unstage file">-</button>
              </div>
            </div>
          `;
        });
      }

      // Changes (Unstaged & Untracked)
      const unstagedAll = [...data.unstaged, ...data.untracked];
      if (unstagedAll.length > 0) {
        html += `<div class="git-section-title"><span>CHANGES (${unstagedAll.length})</span> <button type="button" class="explorer-icon-btn" id="btnStageAll" title="Stage All Changes">+</button></div>`;
        unstagedAll.forEach(f => {
          html += `
            <div class="git-file-row">
              <span class="file-name" title="${f.file}">${f.file.split('/').pop()}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="git-badge-status git-badge-${f.status}">${f.status}</span>
                <button type="button" class="explorer-icon-btn btn-stage-file" data-file="${f.file}" title="Stage file">+</button>
              </div>
            </div>
          `;
        });
      }

      container.innerHTML = html;

      // Event listeners for stage/unstage buttons
      container.querySelectorAll('.btn-stage-file').forEach(b => {
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const file = b.getAttribute('data-file');
          await fetch('/api/git/stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file })
          });
          loadGitStatus();
        });
      });

      container.querySelectorAll('.btn-unstage-file').forEach(b => {
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const file = b.getAttribute('data-file');
          await fetch('/api/git/unstage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file })
          });
          loadGitStatus();
        });
      });

      const btnStageAll = document.getElementById('btnStageAll');
      if (btnStageAll) {
        btnStageAll.addEventListener('click', async () => {
          await fetch('/api/git/stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: 'all' })
          });
          loadGitStatus();
        });
      }

    } catch (err) {
      if (container) container.innerHTML = `<div style="color:#f87171; padding:8px;">Error loading Git: ${err.message}</div>`;
    }
  }

  // Commit Staged changes
  async function commitGitStaged() {
    const input = document.getElementById('gitCommitInput');
    const msg = input?.value?.trim();
    if (!msg) {
      alert('Please enter a commit message');
      return;
    }

    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (input) input.value = '';
      loadGitStatus();
      alert(`Committed successfully: "${msg}"`);
    } catch (err) {
      alert('Commit failed: ' + err.message);
    }
  }

  // =========================================================================
  // 5. COMMAND PALETTE (CTRL+SHIFT+P / F1)
  // =========================================================================

  const PALETTE_COMMANDS = [
    { id: 'format', title: 'Format Document', shortcut: 'Shift+Alt+F', action: () => window.studioIDE.editor?.getAction('editor.action.formatDocument')?.run() },
    { id: 'repair', title: 'AI: Automated AST Self-Repair', shortcut: '', action: () => typeof window.executeStudioVerifySelfRepair === 'function' && window.executeStudioVerifySelfRepair() },
    { id: 'refactor', title: 'AI: Refactor Code (Clean Code & SOLID)', shortcut: '', action: () => typeof window.executeStudioAiAction === 'function' && window.executeStudioAiAction('refactor') },
    { id: 'fix', title: 'AI: Find & Fix Bugs', shortcut: '', action: () => typeof window.executeStudioAiAction === 'function' && window.executeStudioAiAction('fix') },
    { id: 'new_file', title: 'File: New Workspace File', shortcut: '', action: () => createNewFilePrompt() },
    { id: 'new_folder', title: 'File: New Workspace Folder', shortcut: '', action: () => createNewFolderPrompt() },
    { id: 'term_new', title: 'Terminal: Restart Shell Session', shortcut: '', action: () => restartTerminalSession() },
    { id: 'term_clear', title: 'Terminal: Clear Console', shortcut: '', action: () => window.studioIDE.xterm?.clear() },
    { id: 'git_status', title: 'Git: Refresh Status', shortcut: '', action: () => loadGitStatus() },
    { id: 'git_stage_all', title: 'Git: Stage All Changes', shortcut: '', action: () => fetch('/api/git/stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'all' }) }).then(loadGitStatus) },
    { id: 'viewport', title: 'View: Toggle Live Web Viewport', shortcut: '', action: () => toggleLiveViewport() },
    { id: 'theme_dark', title: 'Preferences: Theme - VS Code Dark+', shortcut: '', action: () => switchEditorTheme('vs-dark') },
    { id: 'theme_light', title: 'Preferences: Theme - Visual Studio Light', shortcut: '', action: () => switchEditorTheme('vs') },
    { id: 'theme_hc', title: 'Preferences: Theme - High Contrast Dark', shortcut: '', action: () => switchEditorTheme('hc-black') }
  ];

  function toggleCommandPalette(open = true) {
    const modal = document.getElementById('commandPaletteModal');
    const input = document.getElementById('commandPaletteInput');
    if (!modal) return;

    if (open) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      if (input) {
        input.value = '';
        input.focus();
      }
      renderCommandList(PALETTE_COMMANDS);
    } else {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function renderCommandList(commands = []) {
    const list = document.getElementById('commandPaletteList');
    if (!list) return;

    if (commands.length === 0) {
      list.innerHTML = '<div style="padding:10px; color:#64748b; font-size:0.75rem;">No matching commands found.</div>';
      return;
    }

    list.innerHTML = commands.map((c, i) => `
      <div class="command-palette-item ${i === 0 ? 'active' : ''}" data-cmd="${c.id}">
        <span>${c.title}</span>
        ${c.shortcut ? `<span class="command-palette-shortcut">${c.shortcut}</span>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.command-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const cmdId = item.getAttribute('data-cmd');
        const found = PALETTE_COMMANDS.find(c => c.id === cmdId);
        if (found) {
          toggleCommandPalette(false);
          found.action();
        }
      });
    });
  }

  function switchEditorTheme(themeName) {
    window.studioIDE.currentTheme = themeName;
    if (window.studioIDE.monaco) {
      window.studioIDE.monaco.editor.setTheme(themeName);
    }
    const select = document.getElementById('studioThemeSelect');
    if (select) select.value = themeName;
  }

  function toggleLiveViewport() {
    const wrapper = document.getElementById('artifactBodyWrapper');
    if (!wrapper) return;
    const isHidden = wrapper.style.display === 'none';
    wrapper.style.display = isHidden ? 'block' : 'none';
    if (isHidden && typeof window.compileWebProjectBundle === 'function') {
      const iframe = document.getElementById('artifactSandboxIframe');
      if (iframe) iframe.srcdoc = window.compileWebProjectBundle();
    }
  }

  async function createNewFilePrompt() {
    const fileName = prompt('Enter relative file path to create (e.g. src/utils.js):');
    if (!fileName || !fileName.trim()) return;

    try {
      const res = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileName.trim(), content: '' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      loadWorkspaceTree();
      // Add to open tabs
      const { files } = window.canvasStudio;
      files.push({ name: fileName.trim(), language: getMonacoLanguage(fileName), content: '' });
      const idx = files.length - 1;
      window.canvasStudio.openTabs.push(idx);
      if (typeof window.renderStudioTabs === 'function') window.renderStudioTabs();
      if (typeof window.switchStudioActiveFile === 'function') window.switchStudioActiveFile(idx);
      switchMonacoFile({ name: fileName.trim(), content: '' });
    } catch (err) {
      alert('Error creating file: ' + err.message);
    }
  }

  async function createNewFolderPrompt() {
    const folderName = prompt('Enter folder path to create (e.g. src/components):');
    if (!folderName || !folderName.trim()) return;

    try {
      const res = await fetch('/api/workspace/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderName.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      loadWorkspaceTree();
    } catch (err) {
      alert('Error creating folder: ' + err.message);
    }
  }

  // =========================================================================
  // 6. ATTACH ALL MASTER EVENT LISTENERS & LIFECYCLE
  // =========================================================================

  function setupStudioEventListeners() {
    // Activity Bar Switching
    const activityButtons = [
      { btn: 'activityBtnExplorer', view: 'sidebarViewExplorer', name: 'explorer' },
      { btn: 'activityBtnSearch', view: 'sidebarViewSearch', name: 'search' },
      { btn: 'activityBtnGit', view: 'sidebarViewGit', name: 'git' },
      { btn: 'activityBtnSettings', view: 'sidebarViewSettings', name: 'settings' }
    ];

    activityButtons.forEach(({ btn, view, name }) => {
      document.getElementById(btn)?.addEventListener('click', () => {
        activityButtons.forEach(b => {
          document.getElementById(b.btn)?.classList.toggle('active', b.name === name);
          const v = document.getElementById(b.view);
          if (v) v.style.display = b.name === name ? 'flex' : 'none';
        });
        window.studioIDE.activeSidebar = name;

        if (name === 'git') loadGitStatus();
        if (name === 'explorer') loadWorkspaceTree();
      });
    });

    // Bottom Panel Tabs
    const bottomTabs = [
      { tab: 'tabBottomTerminal', pane: 'bottomTerminalView', name: 'terminal' },
      { tab: 'tabBottomProblems', pane: 'bottomProblemsView', name: 'problems' },
      { tab: 'tabBottomOutput', pane: 'bottomOutputView', name: 'output' }
    ];

    bottomTabs.forEach(({ tab, pane, name }) => {
      document.getElementById(tab)?.addEventListener('click', () => {
        bottomTabs.forEach(t => {
          document.getElementById(t.tab)?.classList.toggle('active', t.name === name);
          const p = document.getElementById(t.pane);
          if (p) p.style.display = t.name === name ? 'block' : 'none';
        });
        window.studioIDE.activeBottomTab = name;
      });
    });

    // Toolbar buttons
    document.getElementById('btnRestartTerminal')?.addEventListener('click', restartTerminalSession);
    document.getElementById('btnClearTerminal')?.addEventListener('click', () => window.studioIDE.xterm?.clear());
    document.getElementById('btnGitCommit')?.addEventListener('click', commitGitStaged);
    document.getElementById('btnGitRefresh')?.addEventListener('click', loadGitStatus);
    document.getElementById('btnWorkspaceNewFile')?.addEventListener('click', createNewFilePrompt);
    document.getElementById('btnWorkspaceNewFolder')?.addEventListener('click', createNewFolderPrompt);
    document.getElementById('btnWorkspaceRefresh')?.addEventListener('click', loadWorkspaceTree);
    document.getElementById('btnOpenCommandPalette')?.addEventListener('click', () => toggleCommandPalette(true));
    document.getElementById('btnToggleLiveViewport')?.addEventListener('click', toggleLiveViewport);

    // Theme selector
    document.getElementById('studioThemeSelect')?.addEventListener('change', (e) => {
      switchEditorTheme(e.target.value);
    });

    // Minimap toggle
    document.getElementById('studioMinimapToggle')?.addEventListener('change', (e) => {
      window.studioIDE.showMinimap = e.target.checked;
      window.studioIDE.editor?.updateOptions({ minimap: { enabled: e.target.checked } });
    });

    // Command Palette input filter
    document.getElementById('commandPaletteInput')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = PALETTE_COMMANDS.filter(c => c.title.toLowerCase().includes(query));
      renderCommandList(filtered);
    });

    // Global IDE Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ctrl+Shift+P / F1: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p' || e.key === 'F1') {
        const studioModal = document.getElementById('artifactModal');
        if (studioModal && studioModal.classList.contains('open')) {
          e.preventDefault();
          toggleCommandPalette(true);
        }
      }
      // Escape: close Command Palette
      if (e.key === 'Escape') {
        const pal = document.getElementById('commandPaletteModal');
        if (pal && pal.style.display === 'flex') {
          e.preventDefault();
          toggleCommandPalette(false);
        }
      }
      // Ctrl+S: Save current file
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const studioModal = document.getElementById('artifactModal');
        if (studioModal && studioModal.classList.contains('open')) {
          e.preventDefault();
          const { files, activeFileIndex } = window.canvasStudio;
          if (files && files[activeFileIndex]) {
            const activeFile = files[activeFileIndex];
            const content = window.studioIDE.editor ? window.studioIDE.editor.getValue() : activeFile.content;
            fetch('/api/workspace/file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: activeFile.name, content })
            }).then(() => {
              if (typeof window.appendTerminalLog === 'function') {
                window.appendTerminalLog('stdout', `Saved ${activeFile.name}`);
              }
            }).catch(() => {});
          }
        }
      }
    });
  }

  // Master Hook into Canvas Studio Open
  const originalOpenCanvas = window.openCanvasEditor;
  window.openCanvasEditor = function (rawCodeOrFiles, lang, title, defaultView, targetFileIndex) {
    if (typeof originalOpenCanvas === 'function') {
      originalOpenCanvas(rawCodeOrFiles, lang, title, defaultView, targetFileIndex);
    }

    // Initialize Monaco and Terminal
    initMonacoEditor((editor) => {
      const { files, activeFileIndex } = window.canvasStudio;
      if (files && files[activeFileIndex]) {
        switchMonacoFile(files[activeFileIndex]);
      }
    });

    initInteractiveTerminal();
    loadWorkspaceTree();
    loadGitStatus();
  };

  // Attach exports to window
  window.initMonacoEditor = initMonacoEditor;
  window.switchMonacoFile = switchMonacoFile;
  window.setMonacoDiagnosticsMarkers = setMonacoDiagnosticsMarkers;
  window.initInteractiveTerminal = initInteractiveTerminal;
  window.restartTerminalSession = restartTerminalSession;
  window.loadWorkspaceTree = loadWorkspaceTree;
  window.loadGitStatus = loadGitStatus;
  window.toggleCommandPalette = toggleCommandPalette;

  // Run initial event setup on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStudioEventListeners);
  } else {
    setupStudioEventListeners();
  }

})();
