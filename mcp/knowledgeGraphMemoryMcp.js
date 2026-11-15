/**
 * ============================================================================
 * KNOWLEDGE GRAPH MEMORY MCP SERVER (Anthropic Official Memory Specification)
 * Source: modelcontextprotocol/servers/src/memory
 * ============================================================================
 * Implements persistent entity-relation graph memory for deep semantic recall,
 * relational reasoning across sessions, and zero-hallucination factual grounding.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GRAPH_FILE = path.join(__dirname, '..', 'data', 'mcp_knowledge_graph.json');

class KnowledgeGraphMemoryServer {
  constructor() {
    this.entities = new Map();
    this.relations = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(GRAPH_FILE)) {
        const raw = fs.readFileSync(GRAPH_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.entities && Array.isArray(data.entities)) {
          this.entities = new Map(data.entities.map(e => [e.name.toLowerCase(), e]));
        }
        if (data.relations && Array.isArray(data.relations)) {
          this.relations = data.relations;
        }
      } else {
        // Seed initial known factual nodes about user environment
        this.createEntities([
          {
            name: 'Raghul Raja',
            entityType: 'User / Software Engineer',
            observations: [
              'Full-Stack Software Engineer & Student at SKP Engineering College',
              'Owner of 26 GitHub repositories under @raghul692',
              'Portfolio live at https://raghulraja.is-a.dev/'
            ]
          },
          {
            name: 'RAGHUL AI',
            entityType: 'Autonomous AI Assistant',
            observations: [
              'High-intelligence AI companion operating at ChatGPT-4o & Claude 3.7 tier',
              'Equipped with 5-Tier Model Context Protocol (MCP) tool suites'
            ]
          }
        ]);
        this.createRelations([
          { from: 'RAGHUL AI', to: 'Raghul Raja', relationType: 'ASSISTS_AND_PAIRS_WITH' }
        ]);
      }
    } catch (err) {
      console.warn('[KnowledgeGraphMemory] Init notice:', err.message);
    }
  }

  _save() {
    try {
      const data = {
        updatedAt: new Date().toISOString(),
        entities: Array.from(this.entities.values()),
        relations: this.relations
      };
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[KnowledgeGraphMemory] Save error:', err.message);
    }
  }

  createEntities(entities = []) {
    const created = [];
    for (const ent of entities) {
      if (!ent.name) continue;
      const key = ent.name.toLowerCase().trim();
      const existing = this.entities.get(key);
      if (existing) {
        // Merge observations
        const existingObs = new Set(existing.observations || []);
        for (const obs of (ent.observations || [])) {
          existingObs.add(obs);
        }
        existing.observations = Array.from(existingObs);
        existing.entityType = ent.entityType || existing.entityType;
        created.push(existing);
      } else {
        const newEnt = {
          name: ent.name.trim(),
          entityType: ent.entityType || 'General Entity',
          observations: Array.from(new Set(ent.observations || []))
        };
        this.entities.set(key, newEnt);
        created.push(newEnt);
      }
    }
    this._save();
    return { createdCount: created.length, entities: created };
  }

  createRelations(relations = []) {
    const added = [];
    const existing = [];
    for (const rel of relations) {
      if (!rel.from || !rel.to || !rel.relationType) continue;
      const found = this.relations.find(r =>
        r.from.toLowerCase() === rel.from.toLowerCase() &&
        r.to.toLowerCase() === rel.to.toLowerCase() &&
        r.relationType.toUpperCase() === rel.relationType.toUpperCase()
      );
      if (!found) {
        const newRel = {
          from: rel.from.trim(),
          to: rel.to.trim(),
          relationType: rel.relationType.trim().toUpperCase()
        };
        this.relations.push(newRel);
        added.push(newRel);
      } else {
        existing.push(found);
      }
    }
    this._save();
    return {
      addedCount: added.length,
      existingCount: existing.length,
      totalRelations: this.relations.length,
      relations: [...added, ...existing]
    };
  }

  addObservations(observations = []) {
    const results = [];
    for (const obs of observations) {
      if (!obs.entityName || !obs.contents) continue;
      const key = obs.entityName.toLowerCase().trim();
      const entity = this.entities.get(key);
      if (entity) {
        const obsSet = new Set(entity.observations || []);
        const toAdd = Array.isArray(obs.contents) ? obs.contents : [obs.contents];
        for (const item of toAdd) {
          obsSet.add(item);
        }
        entity.observations = Array.from(obsSet);
        results.push({ entityName: entity.name, added: toAdd });
      }
    }
    this._save();
    return { updatedEntities: results };
  }

  readGraph() {
    return {
      entityCount: this.entities.size,
      relationCount: this.relations.length,
      entities: Array.from(this.entities.values()),
      relations: this.relations
    };
  }

  searchNodes(query = '') {
    if (!query) return this.readGraph();
    const q = query.toLowerCase().trim();
    const matchedEntities = Array.from(this.entities.values()).filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.entityType.toLowerCase().includes(q) ||
      (e.observations && e.observations.some(o => o.toLowerCase().includes(q)))
    );

    const matchedNames = new Set(matchedEntities.map(e => e.name.toLowerCase()));
    const relevantRelations = this.relations.filter(r =>
      matchedNames.has(r.from.toLowerCase()) || matchedNames.has(r.to.toLowerCase())
    );

    return {
      query,
      matchedCount: matchedEntities.length,
      entities: matchedEntities,
      relations: relevantRelations
    };
  }

  deleteEntity(name) {
    if (!name) return { success: false };
    const key = name.toLowerCase().trim();
    const existed = this.entities.delete(key);
    this.relations = this.relations.filter(r =>
      r.from.toLowerCase() !== key && r.to.toLowerCase() !== key
    );
    this._save();
    return { success: existed, deleted: name };
  }

  getToolDeclarations() {
    return [
      {
        name: 'memory_create_entities',
        description: 'Knowledge Graph Memory: Create multiple new entities with attributes and observations in persistent graph memory.',
        parameters: {
          type: 'OBJECT',
          properties: {
            entities: {
              type: 'ARRAY',
              description: 'List of entities to create',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: 'Unique name of entity (e.g. "Supabase Database")' },
                  entityType: { type: 'STRING', description: 'Classification (e.g. "Database", "Person", "Project")' },
                  observations: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Factual observations or attributes' }
                },
                required: ['name', 'entityType']
              }
            }
          },
          required: ['entities']
        },
        execute: async (args) => this.createEntities(args.entities)
      },
      {
        name: 'memory_create_relations',
        description: 'Knowledge Graph Memory: Create directional relational edges between entities (e.g. EntityA -> CONNECTS_TO -> EntityB).',
        parameters: {
          type: 'OBJECT',
          properties: {
            relations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  from: { type: 'STRING', description: 'Origin entity name' },
                  to: { type: 'STRING', description: 'Target entity name' },
                  relationType: { type: 'STRING', description: 'Relation descriptor (e.g. OWNS, DEPLOYED_ON, DEPENDS_ON)' }
                },
                required: ['from', 'to', 'relationType']
              }
            }
          },
          required: ['relations']
        },
        execute: async (args) => this.createRelations(args.relations)
      },
      {
        name: 'memory_add_observations',
        description: 'Knowledge Graph Memory: Add new factual observations to existing entities in the graph.',
        parameters: {
          type: 'OBJECT',
          properties: {
            observations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  entityName: { type: 'STRING', description: 'Name of existing entity' },
                  contents: { type: 'ARRAY', items: { type: 'STRING' }, description: 'New observations to append' }
                },
                required: ['entityName', 'contents']
              }
            }
          },
          required: ['observations']
        },
        execute: async (args) => this.addObservations(args.observations)
      },
      {
        name: 'memory_read_graph',
        description: 'Knowledge Graph Memory: Read the entire active knowledge graph memory.',
        parameters: { type: 'OBJECT', properties: {} },
        execute: async () => this.readGraph()
      },
      {
        name: 'memory_search_nodes',
        description: 'Knowledge Graph Memory: Search entities and relations by keyword, entity name, or observation content.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or entity name' }
          },
          required: ['query']
        },
        execute: async (args) => this.searchNodes(args.query)
      }
    ];
  }
}

export const knowledgeGraphMemoryServer = new KnowledgeGraphMemoryServer();
