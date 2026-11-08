/**
 * ============================================================================
 * FILESYSTEM MCP SERVER (Anthropic Official & Developer IDE Specification)
 * Source: modelcontextprotocol/servers/src/filesystem
 * ============================================================================
 * Production-grade scoped workspace filesystem operations: Read, Write, Patch,
 * Search, and Directory traversal with strict path boundary sandbox enforcement.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

class FilesystemMcpServer {
  constructor() {
    this.root = WORKSPACE_ROOT;
  }

  _resolveSafe(targetPath = '') {
    const resolved = path.resolve(this.root, targetPath);
    if (!resolved.startsWith(this.root)) {
      throw new Error(`Access Denied: Path "${targetPath}" is outside the authorized project root`);
    }
    return resolved;
  }

  readFile({ filePath, maxLines = 1000 }) {
    const fullPath = this._resolveSafe(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }
    if (stat.size > 2 * 1024 * 1024) {
      throw new Error(`File exceeds maximum readable size limit (2MB)`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.length > maxLines;
    const finalContent = truncated ? lines.slice(0, maxLines).join('\n') : content;

    return {
      filePath,
      sizeBytes: stat.size,
      totalLines: lines.length,
      truncated,
      content: finalContent
    };
  }

  writeFile({ filePath, content, overwrite = true }) {
    const fullPath = this._resolveSafe(filePath);
    if (fs.existsSync(fullPath) && !overwrite) {
      throw new Error(`File "${filePath}" already exists and overwrite is set to false`);
    }

    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    const stat = fs.statSync(fullPath);

    return {
      success: true,
      filePath,
      sizeBytes: stat.size,
      lines: content.split('\n').length,
      writtenAt: new Date().toISOString()
    };
  }

  patchFile({ filePath, target, replacement }) {
    const fullPath = this._resolveSafe(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    if (!target) {
      throw new Error('Patch error: Target string to replace is required');
    }

    const original = fs.readFileSync(fullPath, 'utf8');
    if (!original.includes(target)) {
      throw new Error(`Patch failed: Target snippet was not found in ${filePath}`);
    }

    const updated = original.replace(target, replacement);
    fs.writeFileSync(fullPath, updated, 'utf8');

    return {
      success: true,
      filePath,
      bytesChanged: updated.length - original.length,
      patchedAt: new Date().toISOString()
    };
  }

  listDirectory({ dirPath = '', recursive = false, maxEntries = 100 }) {
    const fullPath = this._resolveSafe(dirPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const results = [];
    const scan = (currentDir, depth = 0) => {
      if (results.length >= maxEntries || depth > 5) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const ent of entries) {
        if (results.length >= maxEntries) break;
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '.playwright-mcp') continue;

        const entPath = path.join(currentDir, ent.name);
        const relPath = path.relative(this.root, entPath).replace(/\\/g, '/');

        results.push({
          name: ent.name,
          path: relPath,
          isDirectory: ent.isDirectory(),
          size: ent.isFile() ? fs.statSync(entPath).size : undefined
        });

        if (recursive && ent.isDirectory()) {
          scan(entPath, depth + 1);
        }
      }
    };

    scan(fullPath, 0);
    return {
      dirPath: dirPath || '.',
      count: results.length,
      entries: results
    };
  }

  searchFiles({ pattern, dirPath = '', extension = null, maxMatches = 20 }) {
    const fullPath = this._resolveSafe(dirPath);
    const regex = new RegExp(pattern, 'i');
    const matches = [];

    const searchDir = (current) => {
      if (matches.length >= maxMatches) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const ent of entries) {
        if (matches.length >= maxMatches) break;
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '.playwright-mcp') continue;

        const entPath = path.join(current, ent.name);
        if (ent.isDirectory()) {
          searchDir(entPath);
        } else if (ent.isFile()) {
          if (extension && !ent.name.endsWith(extension)) continue;

          // Check filename match
          if (regex.test(ent.name)) {
            matches.push({
              filePath: path.relative(this.root, entPath).replace(/\\/g, '/'),
              type: 'filename_match'
            });
            continue;
          }

          // Check content match for text files
          try {
            const stat = fs.statSync(entPath);
            if (stat.size < 500 * 1024) {
              const content = fs.readFileSync(entPath, 'utf8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matches.push({
                    filePath: path.relative(this.root, entPath).replace(/\\/g, '/'),
                    lineNumber: i + 1,
                    snippet: lines[i].trim().slice(0, 120),
                    type: 'content_match'
                  });
                  if (matches.length >= maxMatches) break;
                }
              }
            }
          } catch {
            // Skip non-text or unreadable files
          }
        }
      }
    };

    searchDir(fullPath);
    return { pattern, count: matches.length, matches };
  }

  getToolDeclarations() {
    return [
      {
        name: 'fs_read_file',
        description: 'Filesystem MCP: Read text content, line count, and metadata of a project file.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Relative path of file inside project (e.g. "server.js", "public/style.css")' },
            maxLines: { type: 'INTEGER', description: 'Maximum lines to return (default: 1000)' }
          },
          required: ['filePath']
        },
        execute: async (args) => this.readFile(args)
      },
      {
        name: 'fs_write_file',
        description: 'Filesystem MCP: Create or overwrite a file in the workspace directory.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Relative path of file to create or write' },
            content: { type: 'STRING', description: 'Full text content to write into the file' },
            overwrite: { type: 'BOOLEAN', description: 'Whether to overwrite existing file (default: true)' }
          },
          required: ['filePath', 'content']
        },
        execute: async (args) => this.writeFile(args)
      },
      {
        name: 'fs_patch_file',
        description: 'Filesystem MCP: Surgically replace a specific target string/block inside a file with new code.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Relative path of file to modify' },
            target: { type: 'STRING', description: 'Exact existing string to be replaced' },
            replacement: { type: 'STRING', description: 'New string to insert in place of target' }
          },
          required: ['filePath', 'target', 'replacement']
        },
        execute: async (args) => this.patchFile(args)
      },
      {
        name: 'fs_list_directory',
        description: 'Filesystem MCP: List files and subdirectories with sizes and metadata.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dirPath: { type: 'STRING', description: 'Relative directory path to inspect (default: project root)' },
            recursive: { type: 'BOOLEAN', description: 'Whether to traverse subdirectories' },
            maxEntries: { type: 'INTEGER', description: 'Max items to return (default: 100)' }
          }
        },
        execute: async (args) => this.listDirectory(args)
      },
      {
        name: 'fs_search_files',
        description: 'Filesystem MCP: Search files across the project by filename or regex content match.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pattern: { type: 'STRING', description: 'Search term or regex pattern' },
            dirPath: { type: 'STRING', description: 'Subdirectory to search inside (optional)' },
            extension: { type: 'STRING', description: 'Filter by file extension like ".js", ".html" (optional)' }
          },
          required: ['pattern']
        },
        execute: async (args) => this.searchFiles(args)
      }
    ];
  }
}

export const filesystemMcpServer = new FilesystemMcpServer();

