/**
 * PORTFOLIO RESUME MUTATOR ENGINE
 * 
 * Deterministic, bracket-balanced, AST-like CRUD mutation library for src/data/resume.ts
 * Covers 100% of portfolio domain entities:
 * 1. Certificates (Create, Read, Update, Delete)
 * 2. Projects (Create, Read, Update, Delete)
 * 3. Skills & Tech Stack (Create, Read, Update, Delete)
 * 4. Experience (Create, Read, Update, Delete)
 * 5. Education (Create, Read, Update, Delete)
 * 6. Profile & Socials (Update, Modify, Enrich)
 */

/**
 * Scan bracket-balanced region starting at a given marker.
 * Handles strings, template literals, and escape sequences accurately.
 */
export function extractBracketRegion(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return null;

  let startBracket = -1;
  let openChar = '';
  let closeChar = '';

  // Start searching at or after marker's closing position to avoid brackets inside type annotations (e.g. Certificate[])
  for (let i = markerIdx + marker.length - 1; i < src.length; i++) {
    if (src[i] === '[' || src[i] === '{') {
      startBracket = i;
      openChar = src[i];
      closeChar = openChar === '[' ? ']' : '}';
      break;
    }
  }

  if (startBracket === -1) return null;

  let depth = 0;
  let endBracket = -1;
  let insideString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = startBracket; i < src.length; i++) {
    const c = src[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (c === '\\') {
      isEscaped = true;
      continue;
    }
    if (insideString) {
      if (c === stringChar) insideString = false;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      insideString = true;
      stringChar = c;
      continue;
    }
    if (c === openChar) {
      depth++;
    } else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        endBracket = i;
        break;
      }
    }
  }

  if (endBracket === -1) return null;

  const body = src.slice(startBracket + 1, endBracket);
  return {
    markerIdx,
    startBracket,
    endBracket,
    openChar,
    closeChar,
    body
  };
}

/**
 * Extract individual top-level object blocks `{ ... }` from an array body.
 */
export function extractObjectBlocks(arrayBody) {
  const blocks = [];
  let depth = 0;
  let curStart = -1;
  let insideString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = 0; i < arrayBody.length; i++) {
    const c = arrayBody[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (c === '\\') {
      isEscaped = true;
      continue;
    }
    if (insideString) {
      if (c === stringChar) insideString = false;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      insideString = true;
      stringChar = c;
      continue;
    }
    if (c === '{') {
      if (depth === 0) curStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && curStart !== -1) {
        let end = i + 1;
        while (end < arrayBody.length && (arrayBody[end] === ',' || arrayBody[end] === ' ' || arrayBody[end] === '\t' || arrayBody[end] === '\r' || arrayBody[end] === '\n')) {
          if (arrayBody[end] === ',') { end++; break; }
          end++;
        }
        blocks.push(arrayBody.slice(curStart, end));
        curStart = -1;
      }
    }
  }

  return blocks;
}

// =============================================================================
// 1. CERTIFICATES CRUD
// =============================================================================

export function addCertificateToContent(src, cert) {
  const marker = 'export const certificates: Certificate[] = [\n';
  const insertIndex = src.indexOf(marker);
  if (insertIndex === -1) return { success: false, content: src, error: 'Certificates marker not found' };

  const certCode = `  {\n    id: '${cert.id}',\n    title: '${cert.title.replace(/'/g, "\\'")}',\n    issuer: '${cert.issuer.replace(/'/g, "\\'")}',\n    date: '${cert.date || new Date().toISOString().split('T')[0]}',\n    category: '${cert.category || 'ai'}',\n    skills: ${JSON.stringify(cert.skills || ['Professional Certification'])},\n    description: '${(cert.description || '').replace(/'/g, "\\'")}',\n    file: '${cert.file || '/certificates/' + cert.id + '.pdf'}',\n  },\n`;

  const updated = src.slice(0, insertIndex + marker.length) + certCode + src.slice(insertIndex + marker.length);
  return { success: true, content: updated, cert };
}

export function removeCertificatesFromContent(src, targetKeywords = []) {
  const region = extractBracketRegion(src, 'export const certificates: Certificate[] = [');
  if (!region) return { success: false, content: src, removed: [] };

  const blocks = extractObjectBlocks(region.body);
  const removed = [];
  const kept = [];

  for (const b of blocks) {
    const idMatch = b.match(/id:\s*['"]([^'"]+)['"]/);
    const titleMatch = b.match(/title:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';
    const bLower = b.toLowerCase();

    const shouldRemove = targetKeywords.some(kw => {
      const k = kw.toLowerCase().trim();
      if (!k) return false;
      if (id && id.toLowerCase().includes(k)) return true;
      if (title && title.toLowerCase().includes(k)) return true;
      if (k.includes('professional achievement') && (bLower.includes('professional-achievement') || bLower.includes('professional achievement'))) return true;
      if ((k.includes('aws certified') || k.includes('ai practitioner')) && (bLower.includes('aws_certified_ai') || bLower.includes('aws-certified-ai') || bLower.includes('ai practitioner'))) return true;
      return false;
    });

    if (shouldRemove) {
      removed.push(title || id);
    } else {
      kept.push(b.trim().replace(/,?$/, ','));
    }
  }

  const newArrayContent = kept.length > 0 ? '\n  ' + kept.join('\n  ') + '\n' : '\n';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, removed };
}

export function updateCertificateInContent(src, identifier, updates = {}) {
  const region = extractBracketRegion(src, 'export const certificates: Certificate[] = [');
  if (!region) return { success: false, content: src, updated: null };

  const blocks = extractObjectBlocks(region.body);
  let matched = null;
  const newBlocks = [];

  for (const b of blocks) {
    const idMatch = b.match(/id:\s*['"]([^'"]+)['"]/);
    const titleMatch = b.match(/title:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';

    const isMatch = (id && id.toLowerCase().includes(identifier.toLowerCase())) ||
                    (title && title.toLowerCase().includes(identifier.toLowerCase()));

    if (isMatch && !matched) {
      let modifiedBlock = b;
      if (updates.title) modifiedBlock = modifiedBlock.replace(/title:\s*['"][^'"]*['"]/, `title: '${updates.title.replace(/'/g, "\\'")}'`);
      if (updates.issuer) modifiedBlock = modifiedBlock.replace(/issuer:\s*['"][^'"]*['"]/, `issuer: '${updates.issuer.replace(/'/g, "\\'")}'`);
      if (updates.description) modifiedBlock = modifiedBlock.replace(/description:\s*['"][^'"]*['"]/, `description: '${updates.description.replace(/'/g, "\\'")}'`);
      if (updates.date) modifiedBlock = modifiedBlock.replace(/date:\s*['"][^'"]*['"]/, `date: '${updates.date}'`);
      if (updates.category) modifiedBlock = modifiedBlock.replace(/category:\s*['"][^'"]*['"]/, `category: '${updates.category}'`);
      if (updates.file) modifiedBlock = modifiedBlock.replace(/file:\s*['"][^'"]*['"]/, `file: '${updates.file}'`);

      matched = { id, title, updates };
      newBlocks.push(modifiedBlock.trim().replace(/,?$/, ','));
    } else {
      newBlocks.push(b.trim().replace(/,?$/, ','));
    }
  }

  if (!matched) return { success: false, content: src, error: 'Certificate not found' };

  const newArrayContent = '\n  ' + newBlocks.join('\n  ') + '\n';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, updated: matched };
}

// =============================================================================
// 2. PROJECTS CRUD
// =============================================================================

export function addProjectToContent(src, project) {
  const marker = '  projects: [\n';
  const insertIndex = src.indexOf(marker);
  if (insertIndex === -1) return { success: false, content: src, error: 'Projects marker not found' };

  const id = project.id || project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const techArr = JSON.stringify(project.tech || ['TypeScript', 'Next.js', 'Tailwind CSS']);
  const highlightsArr = JSON.stringify(project.highlights || [`Engineered full-stack architecture for ${project.title}.`]);

  const projectCode = `    {\n      id: '${id}',\n      title: '${project.title.replace(/'/g, "\\'")}',\n      description: '${(project.description || '').replace(/'/g, "\\'")}',\n      longDescription: '${(project.longDescription || project.description || '').replace(/'/g, "\\'")}',\n      tech: ${techArr},\n      category: '${project.category || 'fullstack'}',\n      highlights: ${highlightsArr},\n      github: '${project.github || 'https://github.com/raghul692/' + id}',\n      live: '${project.live || 'https://raghulraja.is-a.dev/#projects'}',\n      icon: '${project.icon || 'Code'}',\n    },\n`;

  const updated = src.slice(0, insertIndex + marker.length) + projectCode + src.slice(insertIndex + marker.length);
  return { success: true, content: updated, project: { id, title: project.title } };
}

export function removeProjectsFromContent(src, targetKeywords = []) {
  const region = extractBracketRegion(src, '  projects: [');
  if (!region) return { success: false, content: src, removed: [] };

  const blocks = extractObjectBlocks(region.body);
  const removed = [];
  const kept = [];

  for (const b of blocks) {
    const idMatch = b.match(/id:\s*['"]([^'"]+)['"]/);
    const titleMatch = b.match(/title:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';

    const shouldRemove = targetKeywords.some(kw => {
      const k = kw.toLowerCase().trim();
      if (!k) return false;
      return (id && id.toLowerCase().includes(k)) ||
             (title && title.toLowerCase().includes(k)) ||
             (k.includes('portfolio operating system') && (id.includes('portfolio-os') || title.toLowerCase().includes('operating system'))) ||
             (k.includes('autonomous feature') && (id.includes('feature-app') || title.toLowerCase().includes('feature app')));
    });

    if (shouldRemove) {
      removed.push(title || id);
    } else {
      kept.push(b.trim().replace(/,?$/, ','));
    }
  }

  const newArrayContent = kept.length > 0 ? '\n    ' + kept.join('\n    ') + '\n  ' : '\n  ';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, removed };
}

export function updateProjectInContent(src, identifier, updates = {}) {
  const region = extractBracketRegion(src, '  projects: [');
  if (!region) return { success: false, content: src, updated: null };

  const blocks = extractObjectBlocks(region.body);
  let matched = null;
  const newBlocks = [];

  for (const b of blocks) {
    const idMatch = b.match(/id:\s*['"]([^'"]+)['"]/);
    const titleMatch = b.match(/title:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';

    const isMatch = (id && id.toLowerCase().includes(identifier.toLowerCase())) ||
                    (title && title.toLowerCase().includes(identifier.toLowerCase()));

    if (isMatch && !matched) {
      let mod = b;
      if (updates.title) mod = mod.replace(/title:\s*['"][^'"]*['"]/, `title: '${updates.title.replace(/'/g, "\\'")}'`);
      if (updates.description) mod = mod.replace(/description:\s*['"][^'"]*['"]/, `description: '${updates.description.replace(/'/g, "\\'")}'`);
      if (updates.github) mod = mod.replace(/github:\s*['"][^'"]*['"]/, `github: '${updates.github}'`);
      if (updates.live) mod = mod.replace(/live:\s*['"][^'"]*['"]/, `live: '${updates.live}'`);
      if (updates.category) mod = mod.replace(/category:\s*['"][^'"]*['"]/, `category: '${updates.category}'`);
      if (updates.tech && Array.isArray(updates.tech)) mod = mod.replace(/tech:\s*\[[\s\S]*?\],?/, `tech: ${JSON.stringify(updates.tech)},`);

      matched = { id, title, updates };
      newBlocks.push(mod.trim().replace(/,?$/, ','));
    } else {
      newBlocks.push(b.trim().replace(/,?$/, ','));
    }
  }

  if (!matched) return { success: false, content: src, error: 'Project not found' };

  const newArrayContent = '\n    ' + newBlocks.join('\n    ') + '\n  ';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, updated: matched };
}

// =============================================================================
// 3. SKILLS & TECH STACK CRUD
// =============================================================================

export function addSkillsToContent(src, category, skillsArray = []) {
  let content = src;
  const validCategory = ['frontend', 'backend', 'database', 'ai', 'design', 'tools'].includes(category) ? category : 'backend';
  const added = [];

  // 1. Add to resume.skills[category]
  const catRegex = new RegExp(`(${validCategory}:\\s*\\[)([\\s\\S]*?)(\\])`, 'i');
  const catMatch = content.match(catRegex);
  if (catMatch) {
    const existingRaw = catMatch[2];
    const existingSkills = (existingRaw.match(/['"]([^'"]+)['"]/g) || []).map(s => s.replace(/['"]/g, ''));
    const toAdd = skillsArray.filter(s => !existingSkills.some(e => e.toLowerCase() === s.toLowerCase()));

    if (toAdd.length > 0) {
      const formattedAdd = toAdd.map(s => `'${s}'`).join(', ');
      const needsLeadingComma = existingSkills.length > 0 && !existingRaw.trim().endsWith(',');
      const replacement = `$1${existingRaw}${needsLeadingComma ? ', ' : ''}${formattedAdd}$3`;
      content = content.replace(catRegex, replacement);
      added.push(...toAdd);
    }
  }

  // 2. Add to export const techStack: TechItem[]
  const stackMarker = 'export const techStack: TechItem[] = [\n';
  const stackIdx = content.indexOf(stackMarker);
  if (stackIdx !== -1 && added.length > 0) {
    const stackItems = added.map(s => `  { name: '${s}', category: '${validCategory}' },\n`).join('');
    content = content.slice(0, stackIdx + stackMarker.length) + stackItems + content.slice(stackIdx + stackMarker.length);
  }

  return { success: true, content, added, category: validCategory };
}

export function removeSkillsFromContent(src, skillsToRemove = []) {
  let content = src;
  const removed = [];

  for (const s of skillsToRemove) {
    const target = s.trim();
    if (!target) continue;

    // Remove from resume.skills across all categories
    const skillPattern = new RegExp(`['"]${target.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]\\s*,?\\s*`, 'gi');
    if (skillPattern.test(content)) {
      content = content.replace(skillPattern, '');
      removed.push(target);
    }

    // Remove from export const techStack
    const techStackPattern = new RegExp(`\\s*\\{\\s*name:\\s*['"]${target.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]\\s*,\\s*category:\\s*['"][^'"]*['"]\\s*\\},?`, 'gi');
    if (techStackPattern.test(content)) {
      content = content.replace(techStackPattern, '');
      if (!removed.includes(target)) removed.push(target);
    }
  }

  return { success: true, content, removed };
}

export function editSkillInContent(src, oldName, { newName, newCategory } = {}) {
  let content = src;
  let updated = false;

  if (newName) {
    const nameRegex = new RegExp(`(['"])${oldName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(['"])`, 'g');
    if (nameRegex.test(content)) {
      content = content.replace(nameRegex, `$1${newName}$2`);
      updated = true;
    }
  }

  if (newCategory) {
    const targetName = newName || oldName;
    const catRegex = new RegExp(`(\\{\\s*name:\\s*['"]${targetName}['"]\\s*,\\s*category:\\s*['"])[^'"]*(['"]\\s*\\})`, 'g');
    if (catRegex.test(content)) {
      content = content.replace(catRegex, `$1${newCategory}$2`);
      updated = true;
    }
  }

  return { success: updated, content, oldName, newName, newCategory };
}

// =============================================================================
// 4. PROFILE & SOCIALS CRUD
// =============================================================================

export function updateProfileFieldsInContent(src, fields = {}) {
  let content = src;
  const updatedFields = {};

  const allowedFields = ['name', 'title', 'location', 'email', 'phone', 'bio', 'summary', 'avatarUrl', 'resumeUrl'];
  for (const f of allowedFields) {
    if (fields[f] !== undefined) {
      const regex = new RegExp(`(${f}:\\s*['"])[^'"]*(['"])`, 'i');
      if (regex.test(content)) {
        content = content.replace(regex, `$1${fields[f].replace(/'/g, "\\'")}$2`);
        updatedFields[f] = fields[f];
      }
    }
  }

  return { success: Object.keys(updatedFields).length > 0, content, updatedFields };
}

export function updateSocialLinksInContent(src, platform, url) {
  let content = src;
  const regex = new RegExp(`(${platform}:\\s*['"])[^'"]*(['"])`, 'i');
  if (regex.test(content)) {
    content = content.replace(regex, `$1${url}$2`);
    return { success: true, content, platform, url };
  }
  return { success: false, content, error: `Platform ${platform} not found in socials` };
}

// =============================================================================
// 5. EXPERIENCE & EDUCATION CRUD
// =============================================================================

export function addExperienceToContent(src, exp) {
  const marker = '  experience: [\n';
  const insertIndex = src.indexOf(marker);
  if (insertIndex === -1) return { success: false, content: src, error: 'Experience marker not found' };

  const expCode = `    {\n      role: '${(exp.role || 'Software Engineer').replace(/'/g, "\\'")}',\n      company: '${(exp.company || 'Tech Company').replace(/'/g, "\\'")}',\n      period: '${exp.period || '2025 - Present'}',\n      location: '${exp.location || 'Remote'}',\n      highlights: ${JSON.stringify(exp.highlights || ['Built modern web solutions.'])},\n      technologies: ${JSON.stringify(exp.technologies || ['TypeScript', 'React'])},\n    },\n`;

  const updated = src.slice(0, insertIndex + marker.length) + expCode + src.slice(insertIndex + marker.length);
  return { success: true, content: updated, exp };
}

export function removeExperienceFromContent(src, targetKeywords = []) {
  const region = extractBracketRegion(src, '  experience: [');
  if (!region) return { success: false, content: src, removed: [] };

  const blocks = extractObjectBlocks(region.body);
  const removed = [];
  const kept = [];

  for (const b of blocks) {
    const roleMatch = b.match(/role:\s*['"]([^'"]+)['"]/);
    const companyMatch = b.match(/company:\s*['"]([^'"]+)['"]/);
    const role = roleMatch ? roleMatch[1] : '';
    const company = companyMatch ? companyMatch[1] : '';

    const shouldRemove = targetKeywords.some(kw => {
      const k = kw.toLowerCase().trim();
      return (role && role.toLowerCase().includes(k)) || (company && company.toLowerCase().includes(k));
    });

    if (shouldRemove) {
      removed.push(`${role} at ${company}`);
    } else {
      kept.push(b.trim().replace(/,?$/, ','));
    }
  }

  const newArrayContent = kept.length > 0 ? '\n    ' + kept.join('\n    ') + '\n  ' : '\n  ';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, removed };
}

export function addEducationToContent(src, edu) {
  const marker = '  education: [\n';
  const insertIndex = src.indexOf(marker);
  if (insertIndex === -1) return { success: false, content: src, error: 'Education marker not found' };

  const eduCode = `    {\n      degree: '${(edu.degree || 'Bachelor of Engineering').replace(/'/g, "\\'")}',\n      college: '${(edu.college || 'Engineering College').replace(/'/g, "\\'")}',\n      location: '${edu.location || 'Tamil Nadu, India'}',\n      period: '${edu.period || '2022 - 2026'}',\n      cgpa: '${edu.cgpa || '8.5'}',\n    },\n`;

  const updated = src.slice(0, insertIndex + marker.length) + eduCode + src.slice(insertIndex + marker.length);
  return { success: true, content: updated, edu };
}

export function removeEducationFromContent(src, targetKeywords = []) {
  const region = extractBracketRegion(src, '  education: [');
  if (!region) return { success: false, content: src, removed: [] };

  const blocks = extractObjectBlocks(region.body);
  const removed = [];
  const kept = [];

  for (const b of blocks) {
    const degreeMatch = b.match(/degree:\s*['"]([^'"]+)['"]/);
    const collegeMatch = b.match(/college:\s*['"]([^'"]+)['"]/);
    const degree = degreeMatch ? degreeMatch[1] : '';
    const college = collegeMatch ? collegeMatch[1] : '';

    const shouldRemove = targetKeywords.some(kw => {
      const k = kw.toLowerCase().trim();
      return (degree && degree.toLowerCase().includes(k)) || (college && college.toLowerCase().includes(k));
    });

    if (shouldRemove) {
      removed.push(`${degree} at ${college}`);
    } else {
      kept.push(b.trim().replace(/,?$/, ','));
    }
  }

  const newArrayContent = kept.length > 0 ? '\n    ' + kept.join('\n    ') + '\n  ' : '\n  ';
  const modified = src.slice(0, region.startBracket + 1) + newArrayContent + src.slice(region.endBracket);
  return { success: true, content: modified, removed };
}
