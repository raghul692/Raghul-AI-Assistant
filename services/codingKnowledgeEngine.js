/**
 * ============================================================================
 * RAGHUL AI — ADVANCED CODING KNOWLEDGE ENGINE
 * ============================================================================
 * Production-grade knowledge indexer providing modern programming languages,
 * frameworks, architectural patterns, database standards, and security rules.
 */

export const CODING_KNOWLEDGE_BASE = {
  react: {
    id: 'react',
    name: 'React 19 & Next.js 15',
    category: 'frontend',
    keywords: ['react', 'nextjs', 'next.js', 'jsx', 'tsx', 'server component', 'client component', 'useclient', 'useoptimistic'],
    bestPractices: [
      'Prefer React Server Components (RSC) for data fetching to minimize client-side bundle size.',
      'Mark interactive client components explicitly with "use client" directive at the top.',
      'Use Server Actions with useActionState and useOptimistic for seamless mutations with optimistic UI.',
      'Never mutate state directly; use functional state updaters and immutable data structures.',
      'Memoize expensive computations with useMemo and callbacks with useCallback only after profiling performance bottlenecks.',
      'Ensure every list element rendered with .map() has a unique, stable key (never use index if items reorder or filter).'
    ],
    security: [
      'Never render unsanitized user HTML with dangerouslySetInnerHTML; sanitize with DOMPurify if mandatory.',
      'Validate all server action inputs with Zod before processing database operations.',
      'Protect sensitive API credentials in environment variables prefixed with server-only scope (never NEXT_PUBLIC_ for secrets).'
    ],
    codeTemplate: `// React 19 Server Action with strict validation
'use server';

import { z } from 'zod';

const ActionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().optional()
});

export async function createItemAction(prevState, formData) {
  const parsed = ActionSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description')
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  // Database operation with parameterized query
  return { success: true, data: parsed.data };
}`
  },

  typescript: {
    id: 'typescript',
    name: 'TypeScript 5.5+ Standards',
    category: 'language',
    keywords: ['typescript', 'ts', 'tsx', 'types', 'interface', 'generic', 'enum', 'typing'],
    bestPractices: [
      'Enable strict mode ("strict": true, "noImplicitAny": true, "strictNullChecks": true) in tsconfig.json.',
      'Use discriminating unions with exhaustive switch-case checks over loose polymorphic object types.',
      'Prefer type aliases for unions/intersections and interfaces for extensible public object contracts.',
      'Use the "satisfies" operator to validate expressions against a type without widening the inferred type.',
      'Avoid "any" at all costs; use "unknown" with type guards or assertion functions for untrusted inputs.'
    ],
    security: [
      'Use branded types or runtime parsing (Zod, ArkType) for critical boundary values like UserID, Email, and Currency.',
      'Guard against prototype pollution when assigning deeply nested properties dynamically.'
    ],
    codeTemplate: `// Discriminated union with exhaustive pattern matching
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function assertUnreachable(x: never): never {
  throw new Error('Unhandled pattern case: ' + JSON.stringify(x));
}`
  },

  nodejs: {
    id: 'nodejs',
    name: 'Node.js & Express.js Production Backend',
    category: 'backend',
    keywords: ['node', 'nodejs', 'express', 'rest api', 'middleware', 'backend', 'fastify'],
    bestPractices: [
      'Use modern ECMAScript Modules (ESM) syntax ("type": "module" in package.json).',
      'Encapsulate business logic into service layers separated cleanly from express router controllers.',
      'Implement centralized asynchronous error-handling middleware: (err, req, res, next) => res.status(err.status || 500).json(...).',
      'Register process-level rejection handlers: process.on("unhandledRejection") and process.on("uncaughtException").',
      'Support graceful shutdown: intercept SIGINT and SIGTERM to close database connections and HTTP listeners.'
    ],
    security: [
      'Enforce security headers using Helmet (helmet({ contentSecurityPolicy: ... })).',
      'Restrict CORS to verified whitelist origins; never use origin: "*" in authenticated production environments.',
      'Enforce rate limiting on all public endpoints (express-rate-limit).',
      'Validate and sanitize req.body, req.query, and req.params before passing them to the service layer.'
    ],
    codeTemplate: `// Production Express controller with centralized error boundary
import express from 'express';

export function createSecureRouter(service) {
  const router = express.Router();

  router.post('/items', async (req, res, next) => {
    try {
      const { name, price } = req.body;
      if (!name || typeof price !== 'number') {
        return res.status(400).json({ error: 'Valid name and numeric price are required' });
      }
      const item = await service.createItem({ name, price });
      return res.status(201).json({ success: true, item });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}`
  },

  python: {
    id: 'python',
    name: 'FastAPI & Python 3.12+ Modern Architecture',
    category: 'backend',
    keywords: ['python', 'fastapi', 'pydantic', 'async def', 'uvicorn', 'sqlalchemy', 'pytest'],
    bestPractices: [
      'Define request and response contracts using Pydantic v2 BaseModel with Field(..., description="...").',
      'Use async def for I/O-bound endpoints (database queries, network requests) and def for CPU-bound computations.',
      'Utilize FastAPI Dependency Injection (Depends) for database sessions, auth verification, and service clients.',
      'Manage application lifecycle (DB connection pools, caches) using @asynccontextmanager lifespan handlers.',
      'Structure projects into routers/, models/, schemas/, services/, and tests/ directories.'
    ],
    security: [
      'Enforce OAuth2 password bearer or JWT validation with expiration verification and secret signature checks.',
      'Sanitize all file uploads: validate MIME types, restrict file sizes, and save with randomized UUID filenames.',
      'Prevent SQL injection by using SQLAlchemy 2.0 select() statements with bound parameters.'
    ],
    codeTemplate: `from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, Field

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB pool
    yield
    # Shutdown: Close connections

app = FastAPI(title="Production Service", lifespan=lifespan)

@app.post("/items", status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate):
    return {"success": True, "data": payload.model_dump()}`
  },

  golang: {
    id: 'golang',
    name: 'Go 1.22+ High-Performance Concurrency',
    category: 'backend',
    keywords: ['go', 'golang', 'goroutine', 'channel', 'gin', 'fiber', 'grpc'],
    bestPractices: [
      'Propagate context.Context as the first argument in all I/O and database operations for timeout/cancellation.',
      'Check and handle errors immediately: if err != nil { return fmt.Errorf("context: %w", err) }.',
      'Prevent goroutine leaks: always ensure goroutines exit when context is cancelled or work completes.',
      'Avoid package-level global state; use struct dependency injection for repositories and services.',
      'Use sync.RWMutex or channels to guard concurrent map access and shared mutable memory.'
    ],
    security: [
      'Never construct SQL strings with fmt.Sprintf; use db.QueryContext with parameterized placeholders ($1, ?).',
      'Implement strict read/write HTTP server timeouts (ReadHeaderTimeout, WriteTimeout, IdleTimeout).'
    ],
    codeTemplate: `package main

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

type Server struct {
	httpServer *http.Server
}

func NewServer(addr string, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
			WriteTimeout:      10 * time.Second,
			IdleTimeout:       120 * time.Second,
		},
	}
}

func (s *Server) Shutdown(ctx context.Context) error {
	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("graceful shutdown failed: %w", err)
	}
	return nil
}`
  },

  database: {
    id: 'database',
    name: 'PostgreSQL & Modern ORM Data Architecture',
    category: 'database',
    keywords: ['postgres', 'postgresql', 'sql', 'prisma', 'drizzle', 'sqlite', 'redis', 'migration'],
    bestPractices: [
      'Always add indexes to columns used in WHERE clauses, JOIN conditions, and foreign keys.',
      'Use atomic transactions (BEGIN ... COMMIT / client.$transaction()) for operations affecting multiple related records.',
      'Prefer UUIDv7 or BIGSERIAL/BIGINT for primary keys depending on distributed versus sequential ordering needs.',
      'Enable Write-Ahead Logging (WAL) for SQLite to allow concurrent readers and single writer without locking contention.',
      'Store timestamps as UTC (TIMESTAMPTZ in PostgreSQL, ISO 8601 strings in SQLite).'
    ],
    security: [
      'Never concatenate raw user input into SQL queries. Always use parameterized queries ($1, ?).',
      'Follow principle of least privilege: application database users should not have DROP/ALTER permissions in production.',
      'Hash user passwords using Argon2id or bcrypt with appropriate work factor (cost >= 12).'
    ],
    codeTemplate: `-- Migration: Scalable Users & Accounts Schema with Foreign Key Indexes
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`
  },

  architecture: {
    id: 'architecture',
    name: 'System Design, Clean Code & SOLID Invariants',
    category: 'system_design',
    keywords: ['solid', 'clean code', 'clean architecture', 'system design', 'hexagonal', 'design pattern', 'refactor'],
    bestPractices: [
      'Single Responsibility Principle: each module, class, or function must have one and only one reason to change.',
      'Open/Closed Principle: design modules open for extension via interfaces/polymorphism, but closed for modification.',
      'Dependency Inversion: high-level modules must depend on abstractions (interfaces), never directly on low-level concretions.',
      'Keep functions small (< 30 lines), focused, and with cyclomatic complexity under 10.',
      'Replace magic numbers and strings with well-named constants or typed enums.'
    ],
    security: [
      'Fail securely: catch errors, sanitize internal stack traces before returning to clients, and log details safely.',
      'Validate inputs at all architectural boundaries (API entrance, database egress, inter-service messages).'
    ],
    codeTemplate: `// Clean Architecture: Port (Interface) & Service Implementation
export class OrderService {
  constructor(orderRepository, paymentGateway, notificationService) {
    this.orderRepository = orderRepository;
    this.paymentGateway = paymentGateway;
    this.notificationService = notificationService;
  }

  async processOrder(orderInput) {
    const order = await this.orderRepository.create(orderInput);
    const payment = await this.paymentGateway.charge(order.id, order.totalAmount);
    if (!payment.success) {
      await this.orderRepository.updateStatus(order.id, 'PAYMENT_FAILED');
      throw new Error('Payment processing failed: ' + payment.reason);
    }
    await this.orderRepository.updateStatus(order.id, 'CONFIRMED');
    await this.notificationService.notifyOrderConfirmed(order);
    return order;
  }
}`
  },

  security: {
    id: 'security',
    name: 'OWASP Top 10 & Defensive Engineering',
    category: 'security',
    keywords: ['security', 'owasp', 'xss', 'csrf', 'sqli', 'injection', 'auth', 'jwt', 'token', 'crypto'],
    bestPractices: [
      'Sanitize and validate all user inputs against strict whitelist schemas (Zod, Pydantic, Joi).',
      'Use secure, random crypto identifiers: crypto.randomBytes(32).toString("hex") or crypto.randomUUID().',
      'Store session tokens in HttpOnly, Secure, SameSite=Strict cookies rather than localStorage.',
      'Apply defense-in-depth: rate limiters, input filters, parameterized queries, and output encoding.'
    ],
    security: [
      'Never log sensitive data (passwords, auth tokens, credit cards, PII).',
      'Defend against Prototype Pollution in JavaScript: use Object.create(null) or Map for dynamic key lookups.',
      'Set strict Content-Security-Policy (CSP) headers.'
    ],
    codeTemplate: `// Secure password hashing & verification using native Node.js crypto
import crypto from 'crypto';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(\`\${salt}:\${derivedKey.toString('hex')}\`);
    });
  });
}

export async function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const keyBuffer = Buffer.from(key, 'hex');
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}`
  }
};

/**
 * Classify technical stack and architectural requirements from prompt and context
 */
export function classifyTechStack(prompt = '', codeContext = '') {
  const combined = `${prompt} ${codeContext}`.toLowerCase();
  const matchedStacks = [];

  for (const [key, item] of Object.entries(CODING_KNOWLEDGE_BASE)) {
    const hits = item.keywords.filter(kw => combined.includes(kw.toLowerCase()));
    if (hits.length > 0) {
      matchedStacks.push({
        id: key,
        name: item.name,
        category: item.category,
        matchScore: hits.length,
        hits
      });
    }
  }

  // Sort by match score descending
  matchedStacks.sort((a, b) => b.matchScore - a.matchScore);

  // If no specific stack matched, default to architecture & security standards
  if (matchedStacks.length === 0) {
    matchedStacks.push({
      id: 'architecture',
      name: CODING_KNOWLEDGE_BASE.architecture.name,
      category: 'system_design',
      matchScore: 1,
      hits: ['default']
    });
  }

  return matchedStacks;
}

/**
 * Retrieve curated knowledge for specific stack IDs
 */
export function getKnowledgeForStack(stackIds = []) {
  const results = [];
  for (const id of stackIds) {
    if (CODING_KNOWLEDGE_BASE[id]) {
      results.push(CODING_KNOWLEDGE_BASE[id]);
    }
  }
  return results;
}

/**
 * Build synthesized coding context to inject into LLM system prompts
 */
export function buildCodingSystemContext(prompt = '', codeContext = '') {
  const detected = classifyTechStack(prompt, codeContext);
  const primaryStacks = detected.slice(0, 3).map(d => CODING_KNOWLEDGE_BASE[d.id]).filter(Boolean);

  const sections = [];
  sections.push('### 🧠 SPECIALIZED ARCHITECTURAL & CODING KNOWLEDGE INJECTION:');

  for (const stack of primaryStacks) {
    sections.push(`#### [Domain: ${stack.name}]
- **Engineering Standards:**
${stack.bestPractices.map(bp => `  * ${bp}`).join('\n')}
- **Security Invariants:**
${stack.security.map(sec => `  * ${sec}`).join('\n')}`);
  }

  sections.push(`#### [Strict Production Code Invariants]
- ZERO PLACEHOLDERS: Strictly NEVER use "// TODO", "// implement logic here", "// ... rest of code", or "pass".
- COMPLETE IMPLEMENTATIONS: Every function, route, class, and style must be fully coded and immediately runnable.
- COMPREHENSIVE ERROR HANDLING: Include input validation, try/catch or async guards, and realistic status codes.`);

  return sections.join('\n\n');
}

/**
 * Return all registered knowledge entries for API and UI catalog
 */
export function getAllKnownStacks() {
  return Object.values(CODING_KNOWLEDGE_BASE).map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    bestPracticesCount: item.bestPractices.length,
    securityRulesCount: item.security.length
  }));
}

