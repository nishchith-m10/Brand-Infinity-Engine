# V14 OLYMPUS - Phase 2: Knowledge & Memory

## Overview

Phase 2 implements the knowledge store with proper concurrency handling and the memory system for cross-project learning.

**Files to Create:** 6
**Estimated Complexity:** High (concurrency handling is critical)
**Dependencies:** Phase 1 (types, events, config)

---

## File 1: `src/lib/engine/v14-olympus/knowledge/schema.ts`

### Purpose
Define document schemas for each knowledge category with validation.

### Exact Interface

```typescript
import { z } from 'zod';
import { DocumentCategory, AgentName } from '../types';

// Base Document Schema
export const BaseDocumentSchema = z.object({
  version: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

// Requirement Schema
export const RequirementSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(10),
  type: z.enum(['functional', 'non-functional', 'constraint']),
  priority: z.enum(['must', 'should', 'could', 'wont']),
  source: z.enum(['explicit', 'implicit', 'inferred']),
  status: z.enum(['pending', 'covered', 'partial', 'blocked']),
  acceptanceCriteria: z.array(z.string()).optional(),
  relatedRequirements: z.array(z.string()).optional(),
});

export const AmbiguitySchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  possibleInterpretations: z.array(z.string()).min(2),
  resolvedAs: z.string().optional(),
  resolvedBy: z.enum(['user', 'inference']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ConstraintSchema = z.object({
  type: z.enum(['tech', 'budget', 'time', 'scope', 'compliance']),
  description: z.string(),
  value: z.string().optional(),
  impact: z.enum(['blocking', 'significant', 'minor']).optional(),
});

export const ClarificationSchema = z.object({
  questionId: z.string().uuid(),
  question: z.string(),
  answer: z.string(),
  timestamp: z.number(),
  agent: z.string(),
});

// Requirements Document Schema
export const RequirementsDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('requirements'),
  prompt: z.string(),
  explicit: z.array(RequirementSchema),
  implicit: z.array(RequirementSchema),
  ambiguities: z.array(AmbiguitySchema),
  constraints: z.array(ConstraintSchema),
  clarifications: z.array(ClarificationSchema),
  confidence: z.number().min(0).max(1),
  status: z.enum(['draft', 'complete', 'validated']),
});

// Research Source Schema
export const ResearchSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  type: z.enum(['documentation', 'article', 'competitor', 'forum', 'official']),
  relevance: z.number().min(0).max(1),
  extractedInfo: z.string(),
  accessedAt: z.number(),
});

export const CompetitorSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  features: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  pricing: z.string().optional(),
});

export const EdgeCaseSchema = z.object({
  id: z.string().uuid(),
  category: z.string(),
  description: z.string(),
  scenario: z.string(),
  expectedBehavior: z.string(),
  covered: z.boolean(),
  coveredBy: z.string().optional(),
});

export const ResearchConfidenceSchema = z.object({
  sourceCount: z.number().min(0),
  sourceQuality: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  coverage: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(1),
});

// Research Document Schema
export const ResearchDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('research'),
  domain: z.string(),
  sources: z.array(ResearchSourceSchema),
  businessRules: z.array(z.string()),
  competitors: z.array(CompetitorSchema),
  edgeCases: z.array(EdgeCaseSchema),
  technicalRequirements: z.array(z.string()),
  complianceRequirements: z.array(z.string()).optional(),
  confidence: ResearchConfidenceSchema,
  status: z.enum(['in_progress', 'complete', 'needs_more']),
});

// Stack Decision Schema
export const StackDecisionSchema = z.object({
  category: z.string(),
  choice: z.string(),
  reason: z.string(),
  alternatives: z.array(z.string()),
  tradeoffs: z.string().optional(),
});

// File Structure Schema
export const FileStructureNodeSchema: z.ZodType<FileStructureNode> = z.lazy(() =>
  z.object({
    path: z.string(),
    type: z.enum(['file', 'directory']),
    purpose: z.string(),
    template: z.string().optional(),
    children: z.array(FileStructureNodeSchema).optional(),
  })
);

interface FileStructureNode {
  path: string;
  type: 'file' | 'directory';
  purpose: string;
  template?: string;
  children?: FileStructureNode[];
}

// Data Model Schema
export const DataFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string(),
  validation: z.string().optional(),
  defaultValue: z.unknown().optional(),
});

export const DataRelationshipSchema = z.object({
  type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  target: z.string(),
  field: z.string(),
  onDelete: z.enum(['cascade', 'set_null', 'restrict']).optional(),
});

export const DataModelSchema = z.object({
  name: z.string(),
  tableName: z.string().optional(),
  description: z.string(),
  fields: z.array(DataFieldSchema),
  relationships: z.array(DataRelationshipSchema),
  indexes: z.array(z.string()).optional(),
});

// API Endpoint Schema
export const APIEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().startsWith('/'),
  description: z.string(),
  auth: z.boolean(),
  roles: z.array(z.string()).optional(),
  requestBody: z.string().optional(),
  responseBody: z.string().optional(),
  errorResponses: z.array(z.object({
    status: z.number(),
    description: z.string(),
  })).optional(),
});

// Component Spec Schema
export const ComponentSpecSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['page', 'component', 'layout', 'provider']),
  props: z.record(z.string()).optional(),
  description: z.string(),
  dependencies: z.array(z.string()).optional(),
});

// Integration Schema
export const IntegrationSchema = z.object({
  name: z.string(),
  type: z.string(),
  provider: z.string().optional(),
  config: z.record(z.string()),
  envVars: z.array(z.string()),
  webhooks: z.array(z.string()).optional(),
});

// Architecture Document Schema
export const ArchitectureDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('architecture'),
  overview: z.string(),
  stack: z.array(StackDecisionSchema),
  fileStructure: z.array(FileStructureNodeSchema),
  dataModels: z.array(DataModelSchema),
  apiEndpoints: z.array(APIEndpointSchema),
  components: z.array(ComponentSpecSchema),
  integrations: z.array(IntegrationSchema),
  securityConsiderations: z.array(z.string()).optional(),
  scalabilityNotes: z.string().optional(),
  status: z.enum(['draft', 'complete', 'validated']),
});

// Plan Task Schema
export const PlanTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  agent: z.string(),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  estimatedTokens: z.number(),
  files: z.array(z.string()),
  coversRequirements: z.array(z.string()),
  dependencies: z.array(z.string()),
  status: z.enum(['pending', 'ready', 'running', 'complete', 'failed', 'skipped']),
});

// Plan Phase Schema
export const PlanPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(z.string()),
  order: z.number(),
});

// Coverage Entry Schema
export const CoverageEntrySchema = z.object({
  requirementId: z.string(),
  coveredBy: z.array(z.string()),
  status: z.enum(['fully', 'partially', 'not_covered']),
  notes: z.string().optional(),
});

// Plan Document Schema
export const PlanDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('plan'),
  phases: z.array(PlanPhaseSchema),
  tasks: z.array(PlanTaskSchema),
  estimatedTokens: z.number(),
  estimatedFiles: z.number(),
  estimatedDuration: z.string().optional(),
  coverageMatrix: z.array(CoverageEntrySchema),
  coveragePercent: z.number().min(0).max(100),
  status: z.enum(['draft', 'validated', 'in_progress', 'complete']),
});

// Progress Entry Schema
export const ProgressEntrySchema = z.object({
  taskId: z.string(),
  agent: z.string(),
  action: z.string(),
  result: z.enum(['success', 'partial', 'failed', 'skipped']),
  filesAffected: z.array(z.string()),
  tokensUsed: z.number(),
  timestamp: z.number(),
  error: z.string().optional(),
});

// Progress Document Schema
export const ProgressDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('progress'),
  currentPhase: z.string(),
  currentTask: z.string().optional(),
  entries: z.array(ProgressEntrySchema),
  filesGenerated: z.number(),
  tokensUsed: z.number(),
  startedAt: z.number(),
  lastActivityAt: z.number(),
});

// Verification Result Schema
export const VerificationResultSchema = z.object({
  layer: z.string(),
  passed: z.boolean(),
  errors: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
  })),
  executedAt: z.number(),
  duration: z.number(),
});

// Verification Document Schema
export const VerificationDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal('verification'),
  results: z.array(VerificationResultSchema),
  testsGenerated: z.number(),
  testsPassed: z.number(),
  testsFailed: z.number(),
  coveragePercent: z.number().optional(),
  securityIssues: z.array(z.string()),
  overallStatus: z.enum(['passed', 'failed', 'partial']),
});

// Document Type Union
export const KnowledgeDocumentSchema = z.discriminatedUnion('type', [
  RequirementsDocumentSchema,
  ResearchDocumentSchema,
  ArchitectureDocumentSchema,
  PlanDocumentSchema,
  ProgressDocumentSchema,
  VerificationDocumentSchema,
]);

export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

// Validation Functions
export function validateDocument(doc: unknown): { valid: boolean; errors?: string[] } {
  const result = KnowledgeDocumentSchema.safeParse(doc);
  if (result.success) {
    return { valid: true };
  }
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

// Schema Registry
export const DOCUMENT_SCHEMAS: Record<string, z.ZodType> = {
  requirements: RequirementsDocumentSchema,
  research: ResearchDocumentSchema,
  architecture: ArchitectureDocumentSchema,
  plan: PlanDocumentSchema,
  progress: ProgressDocumentSchema,
  verification: VerificationDocumentSchema,
};
```

---

## File 2: `src/lib/engine/v14-olympus/knowledge/store.ts`

### Purpose
Implement the knowledge store with optimistic locking for concurrency control.

### Key Features
- Versioned documents
- Optimistic locking (version conflicts detected)
- In-memory storage (single generation session)
- Event emission on changes
- Path-based organization

### Exact Interface

```typescript
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import {
  VersionedDocument,
  WriteResult,
  ReadOptions,
  KnowledgeSearchResult,
  SearchOptions,
  KnowledgeStoreInterface,
  KnowledgeEvent,
  DocumentCategory,
} from '../types';
import { EventStream, EventType } from '../core/event-stream';
import { AgentName } from '../types/agents';

interface StoreConfig {
  sessionId: string;
  eventStream: EventStream;
  maxDocumentSize?: number;  // Default 10MB
}

export class KnowledgeStore implements KnowledgeStoreInterface {
  private documents: Map<string, VersionedDocument>;
  private subscriptions: Map<string, Set<(doc: VersionedDocument) => void>>;
  private sessionId: string;
  private eventStream: EventStream;
  private currentAgent: AgentName;
  private maxDocumentSize: number;

  constructor(config: StoreConfig) {
    this.documents = new Map();
    this.subscriptions = new Map();
    this.sessionId = config.sessionId;
    this.eventStream = config.eventStream;
    this.currentAgent = 'zeus';
    this.maxDocumentSize = config.maxDocumentSize ?? 10 * 1024 * 1024;
  }

  setCurrentAgent(agent: AgentName): void {
    this.currentAgent = agent;
  }

  // Write with optimistic locking
  async write(
    path: string,
    content: string,
    expectedVersion?: number
  ): Promise<WriteResult> {
    // Validate path
    if (!this.isValidPath(path)) {
      return {
        success: false,
        path,
        version: -1,
        error: {
          code: 'INVALID_PATH',
          message: `Invalid path: ${path}. Must start with / and contain only alphanumeric, /, -, _`,
        },
      };
    }

    // Check size
    if (content.length > this.maxDocumentSize) {
      return {
        success: false,
        path,
        version: -1,
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: `Content size ${content.length} exceeds max ${this.maxDocumentSize}`,
        },
      };
    }

    const existing = this.documents.get(path);
    const currentVersion = existing?.version ?? 0;

    // Optimistic locking check
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      this.eventStream.emit(EventType.KNOWLEDGE_CONFLICT, {
        path,
        currentVersion,
        attemptedVersion: expectedVersion,
        agent: this.currentAgent,
      });

      return {
        success: false,
        path,
        version: currentVersion,
        error: {
          code: 'VERSION_CONFLICT',
          message: `Version conflict: expected ${expectedVersion}, current is ${currentVersion}`,
          currentVersion,
          expectedVersion,
        },
      };
    }

    const newVersion = currentVersion + 1;
    const now = Date.now();
    const contentHash = createHash('sha256').update(content).digest('hex');

    const doc: VersionedDocument = {
      path,
      content,
      version: newVersion,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? this.currentAgent,
      updatedBy: this.currentAgent,
      contentHash,
    };

    this.documents.set(path, doc);

    // Emit event
    const eventType = existing ? EventType.KNOWLEDGE_UPDATED : EventType.KNOWLEDGE_WRITTEN;
    this.eventStream.emit(eventType, {
      path,
      version: newVersion,
      previousVersion: existing?.version,
      agent: this.currentAgent,
      category: this.getCategoryFromPath(path),
    });

    // Notify subscribers
    this.notifySubscribers(path, doc);

    return {
      success: true,
      path,
      version: newVersion,
      previousVersion: existing?.version,
    };
  }

  // Read document
  async read(path: string, options?: ReadOptions): Promise<VersionedDocument | null> {
    const doc = this.documents.get(path);

    if (!doc) {
      return null;
    }

    // If specific version requested
    if (options?.version !== undefined && doc.version !== options.version) {
      // For simplicity, we don't store version history in memory
      // In production, you'd have a version history store
      return null;
    }

    return { ...doc };
  }

  // Read all documents with prefix
  async readAll(prefix: string): Promise<VersionedDocument[]> {
    const results: VersionedDocument[] = [];

    for (const [path, doc] of this.documents) {
      if (path.startsWith(prefix)) {
        results.push({ ...doc });
      }
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  // Check if document exists
  async exists(path: string): Promise<boolean> {
    return this.documents.has(path);
  }

  // Search documents (simple text search, no embeddings in Phase 2)
  async search(query: string, options?: SearchOptions): Promise<KnowledgeSearchResult[]> {
    const results: KnowledgeSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const minRelevance = options?.minRelevance ?? 0.1;
    const limit = options?.limit ?? 10;

    for (const [path, doc] of this.documents) {
      // Category filter
      if (options?.category) {
        const docCategory = this.getCategoryFromPath(path);
        if (docCategory !== options.category) continue;
      }

      const contentLower = doc.content.toLowerCase();

      // Simple relevance scoring
      const queryWords = queryLower.split(/\s+/);
      let matchCount = 0;
      const highlights: string[] = [];

      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          matchCount++;
          // Find snippet around match
          const idx = contentLower.indexOf(word);
          const start = Math.max(0, idx - 50);
          const end = Math.min(doc.content.length, idx + word.length + 50);
          highlights.push(doc.content.slice(start, end));
        }
      }

      const relevance = queryWords.length > 0 ? matchCount / queryWords.length : 0;

      if (relevance >= minRelevance) {
        results.push({
          path,
          content: options?.includeContent ? doc.content : '',
          snippet: highlights[0] ?? doc.content.slice(0, 200),
          relevance,
          category: this.getCategoryFromPath(path),
          version: doc.version,
          highlights: highlights.slice(0, 3),
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  // Delete document
  async delete(path: string): Promise<boolean> {
    const existed = this.documents.delete(path);

    if (existed) {
      this.eventStream.emit(EventType.KNOWLEDGE_DELETED, {
        path,
        agent: this.currentAgent,
      });
    }

    return existed;
  }

  // List all paths
  async listPaths(prefix?: string): Promise<string[]> {
    const paths: string[] = [];

    for (const path of this.documents.keys()) {
      if (!prefix || path.startsWith(prefix)) {
        paths.push(path);
      }
    }

    return paths.sort();
  }

  // Get version
  async getVersion(path: string): Promise<number | null> {
    return this.documents.get(path)?.version ?? null;
  }

  // Subscribe to changes
  subscribe(path: string, callback: (doc: VersionedDocument) => void): () => void {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }

    this.subscriptions.get(path)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(path)?.delete(callback);
    };
  }

  // Get all documents (for checkpointing)
  getSnapshot(): Map<string, VersionedDocument> {
    return new Map(this.documents);
  }

  // Restore from snapshot
  restoreSnapshot(snapshot: Map<string, VersionedDocument>): void {
    this.documents = new Map(snapshot);
  }

  // Clear all documents
  clear(): void {
    this.documents.clear();
    this.subscriptions.clear();
  }

  // Private helpers

  private isValidPath(path: string): boolean {
    return /^\/[a-zA-Z0-9\/_-]+$/.test(path);
  }

  private getCategoryFromPath(path: string): DocumentCategory {
    const parts = path.split('/').filter(Boolean);
    const category = parts[0] as DocumentCategory;

    const validCategories: DocumentCategory[] = [
      'requirements', 'research', 'architecture', 'plan',
      'progress', 'verification', 'deployment', 'error',
      'checkpoint', 'metadata',
    ];

    return validCategories.includes(category) ? category : 'metadata';
  }

  private notifySubscribers(path: string, doc: VersionedDocument): void {
    // Exact path subscribers
    this.subscriptions.get(path)?.forEach(cb => cb(doc));

    // Prefix subscribers (e.g., subscribing to '/requirements' gets all /requirements/*)
    for (const [subPath, callbacks] of this.subscriptions) {
      if (path.startsWith(subPath) && subPath !== path) {
        callbacks.forEach(cb => cb(doc));
      }
    }
  }
}
```

---

## File 3: `src/lib/engine/v14-olympus/knowledge/indexer.ts`

### Purpose
Semantic indexing for knowledge search using embeddings.

### Key Features
- OpenAI text-embedding-3-small integration
- In-memory vector storage
- Cosine similarity search
- Batch embedding for efficiency

### Exact Interface

```typescript
import OpenAI from 'openai';
import { V14_MODEL_CONFIG, V14_RESEARCH_THRESHOLDS } from '../config';
import { VersionedDocument, KnowledgeSearchResult, SearchOptions } from '../types';

interface IndexerConfig {
  openaiApiKey: string;
  dimensions?: number;
}

interface IndexEntry {
  path: string;
  content: string;
  embedding: number[];
  version: number;
  updatedAt: number;
}

export class KnowledgeIndexer {
  private openai: OpenAI;
  private index: Map<string, IndexEntry>;
  private dimensions: number;
  private embeddingCache: Map<string, number[]>;

  constructor(config: IndexerConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.index = new Map();
    this.dimensions = config.dimensions ?? V14_MODEL_CONFIG.embeddingDimensions;
    this.embeddingCache = new Map();
  }

  // Index a document
  async indexDocument(doc: VersionedDocument): Promise<void> {
    const embedding = await this.getEmbedding(doc.content);

    this.index.set(doc.path, {
      path: doc.path,
      content: doc.content,
      embedding,
      version: doc.version,
      updatedAt: doc.updatedAt,
    });
  }

  // Index multiple documents
  async indexDocuments(docs: VersionedDocument[]): Promise<void> {
    // Batch embed for efficiency
    const contents = docs.map(d => d.content);
    const embeddings = await this.getBatchEmbeddings(contents);

    docs.forEach((doc, i) => {
      this.index.set(doc.path, {
        path: doc.path,
        content: doc.content,
        embedding: embeddings[i],
        version: doc.version,
        updatedAt: doc.updatedAt,
      });
    });
  }

  // Semantic search
  async search(query: string, options?: SearchOptions): Promise<KnowledgeSearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query);
    const results: Array<{ entry: IndexEntry; similarity: number }> = [];

    for (const entry of this.index.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity >= (options?.minRelevance ?? 0.5)) {
        results.push({ entry, similarity });
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    // Apply limit
    const limit = options?.limit ?? 10;

    return results.slice(0, limit).map(r => ({
      path: r.entry.path,
      content: options?.includeContent ? r.entry.content : '',
      snippet: r.entry.content.slice(0, 200),
      relevance: r.similarity,
      category: this.getCategoryFromPath(r.entry.path),
      version: r.entry.version,
    }));
  }

  // Remove from index
  remove(path: string): boolean {
    return this.index.delete(path);
  }

  // Clear index
  clear(): void {
    this.index.clear();
    this.embeddingCache.clear();
  }

  // Get embedding for text
  private async getEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = this.hashText(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    const response = await this.openai.embeddings.create({
      model: V14_MODEL_CONFIG.embedding,
      input: text.slice(0, 8000), // Limit to model's max input
      dimensions: this.dimensions,
    });

    const embedding = response.data[0].embedding;

    // Cache result
    this.embeddingCache.set(cacheKey, embedding);

    return embedding;
  }

  // Batch embeddings
  private async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: V14_MODEL_CONFIG.embedding,
      input: texts.map(t => t.slice(0, 8000)),
      dimensions: this.dimensions,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  // Cosine similarity
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Simple hash for caching
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private getCategoryFromPath(path: string): string {
    return path.split('/').filter(Boolean)[0] ?? 'metadata';
  }
}
```

---

## File 4: `src/lib/engine/v14-olympus/memory/interface.ts`

### Purpose
Define the memory interface for cross-project learning.

### Exact Interface

```typescript
import { AgentName } from '../types/agents';

// Memory Entry Types
export type MemoryType =
  | 'pattern'        // Successful code patterns
  | 'error'          // Error patterns to avoid
  | 'requirement'    // Common requirement patterns
  | 'architecture'   // Architecture decisions
  | 'integration'    // Integration configurations
  | 'domain';        // Domain-specific knowledge

// Memory Entry
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  category: string;
  content: string;
  embedding?: number[];
  tags: string[];
  sourceProject?: string;  // Anonymized
  createdBy: AgentName;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// Memory Store Options
export interface MemoryStoreOptions {
  type?: MemoryType;
  category?: string;
  tags?: string[];
}

// Memory Search Options
export interface MemorySearchOptions {
  type?: MemoryType;
  category?: string;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  semantic?: boolean;
}

// Memory Store Result
export interface MemoryStoreResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Memory Interface
export interface MemoryInterface {
  // Store a new memory
  store(entry: Omit<MemoryEntry, 'id' | 'accessCount' | 'lastAccessedAt'>): Promise<MemoryStoreResult>;

  // Search memories
  search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]>;

  // Get by ID
  get(id: string): Promise<MemoryEntry | null>;

  // Update memory
  update(id: string, updates: Partial<MemoryEntry>): Promise<boolean>;

  // Delete memory
  delete(id: string): Promise<boolean>;

  // Find similar memories (by embedding)
  findSimilar(content: string, options?: MemorySearchOptions): Promise<MemoryEntry[]>;

  // Record access (for tracking usefulness)
  recordAccess(id: string): Promise<void>;

  // Get statistics
  getStats(): Promise<MemoryStats>;
}

// Memory Statistics
export interface MemoryStats {
  totalEntries: number;
  entriesByType: Record<MemoryType, number>;
  topCategories: Array<{ category: string; count: number }>;
  averageConfidence: number;
  lastUpdated: number;
}

// Memory Configuration
export interface MemoryConfig {
  maxEntries?: number;
  maxContentSize?: number;
  minConfidence?: number;
  embeddingEnabled?: boolean;
}
```

---

## File 5: `src/lib/engine/v14-olympus/memory/embeddings.ts`

### Purpose
Embedding generation service with caching.

### Exact Interface

```typescript
import OpenAI from 'openai';
import { V14_MODEL_CONFIG } from '../config';

interface EmbeddingConfig {
  openaiApiKey: string;
  model?: string;
  dimensions?: number;
  cacheEnabled?: boolean;
  maxCacheSize?: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;
  private dimensions: number;
  private cache: Map<string, number[]>;
  private cacheEnabled: boolean;
  private maxCacheSize: number;

  constructor(config: EmbeddingConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model ?? V14_MODEL_CONFIG.embedding;
    this.dimensions = config.dimensions ?? V14_MODEL_CONFIG.embeddingDimensions;
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.maxCacheSize = config.maxCacheSize ?? 10000;
    this.cache = new Map();
  }

  // Generate embedding for single text
  async embed(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: this.truncateText(text),
      dimensions: this.dimensions,
    });

    const embedding = response.data[0].embedding;

    if (this.cacheEnabled) {
      this.addToCache(cacheKey, embedding);
    }

    return embedding;
  }

  // Generate embeddings for multiple texts (batch)
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check cache first
    texts.forEach((text, i) => {
      const cacheKey = this.getCacheKey(text);
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        results[i] = this.cache.get(cacheKey)!;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    });

    // Fetch uncached embeddings
    if (uncachedTexts.length > 0) {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: uncachedTexts.map(t => this.truncateText(t)),
        dimensions: this.dimensions,
      });

      response.data
        .sort((a, b) => a.index - b.index)
        .forEach((data, i) => {
          const originalIndex = uncachedIndices[i];
          results[originalIndex] = data.embedding;

          if (this.cacheEnabled) {
            const cacheKey = this.getCacheKey(uncachedTexts[i]);
            this.addToCache(cacheKey, data.embedding);
          }
        });
    }

    return results;
  }

  // Calculate cosine similarity
  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Find most similar from a set
  findMostSimilar(
    queryEmbedding: number[],
    candidates: Array<{ embedding: number[]; data: unknown }>,
    limit: number = 5
  ): Array<{ data: unknown; similarity: number }> {
    const results = candidates.map(candidate => ({
      data: candidate.data,
      similarity: this.similarity(queryEmbedding, candidate.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }

  // Private helpers

  private getCacheKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    const str = text.slice(0, 1000); // Only hash first 1000 chars
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${this.model}:${this.dimensions}:${hash}`;
  }

  private addToCache(key: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, embedding);
  }

  private truncateText(text: string): string {
    // text-embedding-3-small has 8191 token limit
    // Approximate 4 chars per token, leave buffer
    const maxChars = 30000;
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }
}
```

---

## File 6: `src/lib/engine/v14-olympus/memory/retrieval.ts`

### Purpose
Semantic retrieval service for finding relevant memories.

### Exact Interface

```typescript
import { MemoryEntry, MemorySearchOptions, MemoryInterface, MemoryConfig } from './interface';
import { EmbeddingService } from './embeddings';
import { v4 as uuid } from 'uuid';

interface RetrievalConfig extends MemoryConfig {
  embeddingService: EmbeddingService;
}

export class MemoryStore implements MemoryInterface {
  private entries: Map<string, MemoryEntry>;
  private embeddings: EmbeddingService;
  private maxEntries: number;
  private maxContentSize: number;
  private minConfidence: number;
  private embeddingEnabled: boolean;

  constructor(config: RetrievalConfig) {
    this.entries = new Map();
    this.embeddings = config.embeddingService;
    this.maxEntries = config.maxEntries ?? 10000;
    this.maxContentSize = config.maxContentSize ?? 50000;
    this.minConfidence = config.minConfidence ?? 0.3;
    this.embeddingEnabled = config.embeddingEnabled ?? true;
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'accessCount' | 'lastAccessedAt'>
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    // Validate
    if (entry.content.length > this.maxContentSize) {
      return { success: false, error: 'Content too large' };
    }

    if (entry.confidence < this.minConfidence) {
      return { success: false, error: 'Confidence too low' };
    }

    // Check capacity
    if (this.entries.size >= this.maxEntries) {
      this.evictLeastUsed();
    }

    const id = uuid();
    const now = Date.now();

    // Generate embedding if enabled
    let embedding: number[] | undefined;
    if (this.embeddingEnabled) {
      try {
        embedding = await this.embeddings.embed(entry.content);
      } catch (e) {
        // Continue without embedding
      }
    }

    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      embedding,
      accessCount: 0,
      lastAccessedAt: now,
    };

    this.entries.set(id, fullEntry);

    return { success: true, id };
  }

  async search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]> {
    const limit = options?.limit ?? 10;
    const minConfidence = options?.minConfidence ?? this.minConfidence;

    let results: MemoryEntry[] = [];

    // Semantic search if enabled
    if (options?.semantic && this.embeddingEnabled) {
      return this.findSimilar(query, options);
    }

    // Keyword search
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    for (const entry of this.entries.values()) {
      // Apply filters
      if (options?.type && entry.type !== options.type) continue;
      if (options?.category && entry.category !== options.category) continue;
      if (options?.tags && !options.tags.some(t => entry.tags.includes(t))) continue;
      if (entry.confidence < minConfidence) continue;

      // Check content match
      const contentLower = entry.content.toLowerCase();
      const matchCount = queryWords.filter(w => contentLower.includes(w)).length;

      if (matchCount > 0) {
        results.push(entry);
      }
    }

    // Sort by match quality and confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results.slice(0, limit);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // Don't allow changing id
    const { id: _, ...safeUpdates } = updates;

    Object.assign(entry, safeUpdates);

    // Re-embed if content changed
    if (updates.content && this.embeddingEnabled) {
      try {
        entry.embedding = await this.embeddings.embed(updates.content);
      } catch (e) {
        // Keep old embedding
      }
    }

    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async findSimilar(content: string, options?: MemorySearchOptions): Promise<MemoryEntry[]> {
    if (!this.embeddingEnabled) {
      return this.search(content, options);
    }

    const limit = options?.limit ?? 10;
    const minConfidence = options?.minConfidence ?? this.minConfidence;

    // Get query embedding
    const queryEmbedding = await this.embeddings.embed(content);

    // Find similar entries
    const candidates: Array<{ entry: MemoryEntry; similarity: number }> = [];

    for (const entry of this.entries.values()) {
      // Apply filters
      if (options?.type && entry.type !== options.type) continue;
      if (options?.category && entry.category !== options.category) continue;
      if (entry.confidence < minConfidence) continue;
      if (!entry.embedding) continue;

      const similarity = this.embeddings.similarity(queryEmbedding, entry.embedding);

      if (similarity >= 0.5) {  // Threshold
        candidates.push({ entry, similarity });
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity);

    return candidates.slice(0, limit).map(c => c.entry);
  }

  async recordAccess(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
  }

  async getStats(): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    topCategories: Array<{ category: string; count: number }>;
    averageConfidence: number;
    lastUpdated: number;
  }> {
    const entriesByType: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let lastUpdated = 0;

    for (const entry of this.entries.values()) {
      entriesByType[entry.type] = (entriesByType[entry.type] ?? 0) + 1;
      categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
      totalConfidence += entry.confidence;
      if (entry.createdAt > lastUpdated) lastUpdated = entry.createdAt;
    }

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries: this.entries.size,
      entriesByType,
      topCategories,
      averageConfidence: this.entries.size > 0 ? totalConfidence / this.entries.size : 0,
      lastUpdated,
    };
  }

  // Clear all entries
  clear(): void {
    this.entries.clear();
  }

  // Evict least used entries when at capacity
  private evictLeastUsed(): void {
    // Find entry with lowest access count and oldest access time
    let leastUsed: MemoryEntry | null = null;

    for (const entry of this.entries.values()) {
      if (
        !leastUsed ||
        entry.accessCount < leastUsed.accessCount ||
        (entry.accessCount === leastUsed.accessCount &&
          entry.lastAccessedAt < leastUsed.lastAccessedAt)
      ) {
        leastUsed = entry;
      }
    }

    if (leastUsed) {
      this.entries.delete(leastUsed.id);
    }
  }
}
```

---

## Verification Checklist

After Phase 2 implementation:

- [ ] Knowledge store write/read works correctly
- [ ] Version conflicts are detected and reported
- [ ] Subscriptions notify on document changes
- [ ] Semantic search returns relevant results
- [ ] Memory store can save and retrieve entries
- [ ] Embeddings are generated and cached
- [ ] Document schemas validate correctly
- [ ] All tests pass

---

## Dependencies

- Phase 1 (types, events, config)
- `zod` for schema validation
- `openai` for embeddings
- `uuid` for ID generation
- `crypto` for hashing

---

## Next Phase

Once Phase 2 is complete and verified, proceed to **Phase 3: Agent Implementation**.
