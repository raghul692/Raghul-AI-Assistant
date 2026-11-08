/**
 * ============================================================================
 * SEQUENTIAL THINKING MCP SERVER (Anthropic Official Protocol Specification)
 * Source: modelcontextprotocol/servers/src/sequentialthinking
 * ============================================================================
 * Enables dynamic, multi-step deliberative reasoning loops, hypothesis revision,
 * and cognitive branching for complex engineering, debugging, and system design.
 */

class SequentialThinkingServer {
  constructor() {
    this.thoughtHistory = [];
    this.branches = new Map();
  }

  reset() {
    this.thoughtHistory = [];
    this.branches.clear();
    return { success: true, message: 'Sequential thinking state reset.' };
  }

  processThought({
    thought,
    thoughtNumber,
    totalThoughts = 3,
    nextThoughtNeeded = false,
    isRevision = false,
    revisesThought = null,
    branchFromThought = null,
    branchId = null
  }) {
    if (!thought || typeof thought !== 'string') {
      throw new Error('Invalid thought: string required');
    }

    const currentThoughtIndex = this.thoughtHistory.length + 1;
    const actualThoughtNumber = thoughtNumber || currentThoughtIndex;

    const entry = {
      thoughtNumber: actualThoughtNumber,
      thought: thought.trim(),
      totalThoughts: Math.max(actualThoughtNumber, totalThoughts),
      nextThoughtNeeded: Boolean(nextThoughtNeeded),
      isRevision: Boolean(isRevision),
      revisesThought: revisesThought || null,
      branchFromThought: branchFromThought || null,
      branchId: branchId || (branchFromThought ? `branch-${branchFromThought}-${Date.now().toString(36)}` : 'main'),
      timestamp: Date.now()
    };

    if (entry.branchId !== 'main') {
      if (!this.branches.has(entry.branchId)) {
        this.branches.set(entry.branchId, []);
      }
      this.branches.get(entry.branchId).push(entry);
    }

    this.thoughtHistory.push(entry);

    return {
      status: nextThoughtNeeded ? 'deliberating' : 'consensus_reached',
      thoughtNumber: actualThoughtNumber,
      totalThoughts: entry.totalThoughts,
      activeBranch: entry.branchId,
      isRevision: entry.isRevision,
      revisesThought: entry.revisesThought,
      nextThoughtNeeded: entry.nextThoughtNeeded,
      historyLength: this.thoughtHistory.length,
      chainSummary: this._summarizeChain()
    };
  }

  _summarizeChain() {
    return this.thoughtHistory.map(t => {
      const rev = t.isRevision ? ` [Revises #${t.revisesThought}]` : '';
      const branch = t.branchId !== 'main' ? ` [Branch: ${t.branchId}]` : '';
      return `Step ${t.thoughtNumber}/${t.totalThoughts}${rev}${branch}: ${t.thought.slice(0, 100)}...`;
    });
  }

  getHistory() {
    return {
      totalThoughts: this.thoughtHistory.length,
      branchesCount: this.branches.size,
      history: this.thoughtHistory
    };
  }

  getToolDeclarations() {
    return [
      {
        name: 'sequential_thinking',
        description: 'Anthropic Sequential Thinking: Enables step-by-step cognitive planning, deliberate hypothesis testing, error correction, and branching logic before delivering final conclusions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            thought: { type: 'STRING', description: 'Current cognitive reasoning step, hypothesis, calculation, or diagnosis.' },
            thoughtNumber: { type: 'INTEGER', description: 'Current step number in the cognitive chain.' },
            totalThoughts: { type: 'INTEGER', description: 'Estimated total steps needed to reach confident consensus.' },
            nextThoughtNeeded: { type: 'BOOLEAN', description: 'True if another step is required to verify or refine.' },
            isRevision: { type: 'BOOLEAN', description: 'True if this step revises or refutes an earlier thought.' },
            revisesThought: { type: 'INTEGER', description: 'The step number being revised or refuted (if isRevision is true).' },
            branchFromThought: { type: 'INTEGER', description: 'Step number to branch an alternative hypothesis from.' },
            branchId: { type: 'STRING', description: 'Identifier for the alternative hypothesis branch.' }
          },
          required: ['thought', 'nextThoughtNeeded']
        },
        execute: async (args) => this.processThought(args)
      },
      {
        name: 'sequential_thinking_reset',
        description: 'Reset sequential thinking session memory.',
        parameters: { type: 'OBJECT', properties: {} },
        execute: async () => this.reset()
      },
      {
        name: 'sequential_thinking_get_history',
        description: 'Retrieve complete reasoning chain history and active branches.',
        parameters: { type: 'OBJECT', properties: {} },
        execute: async () => this.getHistory()
      }
    ];
  }
}

export const sequentialThinkingServer = new SequentialThinkingServer();

