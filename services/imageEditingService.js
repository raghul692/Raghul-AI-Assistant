import fs from 'fs';
import { getLatestImageAssetForSession, getImageAsset, saveImageAsset } from './imageStorageService.js';
import { imageProviderRouter } from './imageProviderRouter.js';
import { renderInfographicSvg, extractCurriculumWithLLM } from './hybridInfographicRenderer.js';
import { validateImageBuffer } from './imageQualityValidator.js';

/**
 * Phase 6: Conversational Image Editing Engine
 * Supports iterative modifications while preserving lineage and version history.
 */
export async function editImageAsset({
  userInstruction,
  sessionId = null,
  parentAssetId = null,
  contextBundle = null,
  imageBrief = null
}) {
  const start = Date.now();

  // 1. Locate the parent image asset
  let parent = null;
  if (parentAssetId) {
    parent = getImageAsset(parentAssetId);
  }
  if (!parent && sessionId) {
    parent = getLatestImageAssetForSession(sessionId);
  }

  if (!parent) {
    throw new Error('No previous image found in this conversation to edit. Please create an image first.');
  }

  console.log(`[ImageEditingService] Editing asset ${parent.id} (v${parent.version}): "${userInstruction}"`);

  const nextVersion = (parent.version || 1) + 1;
  const isInfographic = parent.provider === 'hybrid-infographic-engine' || parent.mime_type === 'image/svg+xml';

  if (isInfographic) {
    // Branch A: Conversational Edit for Infographics/Roadmaps
    const topic = parent.prompt?.replace(/^30-Day Learning Roadmap for\s+/i, '') || 'Roadmap';
    const updatedCurriculum = await extractCurriculumWithLLM({
      topic,
      audience: 'Developer',
      contextText: `Original topic: ${topic}. User revision request: ${userInstruction}. Keep 30 sequential days.`
    });

    const updatedSvgBuffer = renderInfographicSvg(updatedCurriculum);
    const validation = validateImageBuffer(updatedSvgBuffer);
    if (!validation.valid) {
      throw new Error(`Edited infographic validation failed: ${validation.error}`);
    }

    const savedAsset = await saveImageAsset({
      buffer: updatedSvgBuffer,
      sessionId,
      mimeType: 'image/svg+xml',
      width: 1600,
      height: 1600,
      provider: 'hybrid-infographic-engine',
      model: 'raghul-curriculum-renderer-v1',
      prompt: `${parent.prompt} [Edit v${nextVersion}: ${userInstruction}]`,
      imageBrief,
      parentAssetId: parent.id,
      version: nextVersion
    });

    return {
      ...savedAsset,
      editedFrom: parent.id,
      version: nextVersion,
      latencyMs: Date.now() - start
    };
  } else {
    // Branch B: Conversational Edit for Raster Images
    let parentBuffer = null;
    if (fs.existsSync(parent.file_path)) {
      parentBuffer = fs.readFileSync(parent.file_path);
    }

    const editPrompt = `Modify previous image: "${parent.prompt}". Requested modification: ${userInstruction}. Maintain consistent visual style, palette, and subject details except for requested changes.`;

    const generated = await imageProviderRouter.generateImage({
      prompt: editPrompt,
      imageBrief,
      context: contextBundle,
      parentAsset: parentBuffer ? { ...parent, buffer: parentBuffer } : null
    });

    const savedAsset = await saveImageAsset({
      buffer: generated.buffer,
      sessionId,
      mimeType: generated.mimeType,
      width: generated.width,
      height: generated.height,
      provider: generated.provider,
      model: generated.model,
      prompt: editPrompt,
      imageBrief,
      parentAssetId: parent.id,
      version: nextVersion
    });

    return {
      ...savedAsset,
      editedFrom: parent.id,
      version: nextVersion,
      latencyMs: Date.now() - start
    };
  }
}

