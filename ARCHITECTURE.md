# Architecture Documentation

## System Overview

The Marketing Content Engine is built on a modular architecture with five independent but coordinated operational pillars. This design ensures scalability, maintainability, and flexibility.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   Marketing Content Engine                       │
│                    (Orchestration Layer)                         │
└───────┬─────────┬─────────┬──────────┬──────────┬──────────────┘
        │         │         │          │          │
        ▼         ▼         ▼          ▼          ▼
    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐
    │Pillar │ │Pillar │ │Pillar │ │Pillar │ │  Pillar   │
    │   1   │ │   2   │ │   3   │ │   4   │ │     5     │
    └───────┘ └───────┘ └───────┘ └───────┘ └───────────┘
    Content   Creative   Media     State     Multi-Platform
    Ingestion Direction  Synthesis Mgmt      Distribution
```

## Five Operational Pillars

### 1. Content Ingestion Pillar (`pillar_ingestion.py`)

**Purpose**: First line of quality control and content preparation.

**Components:**
- `ContentValidator`: Validates content ideas for quality and completeness
- `ContentEnricher`: Enriches content with metadata and context
- `ContentIngestionPillar`: Main orchestration class

**Key Features:**
- Input validation (title, description, duration)
- Brand safety screening
- Automatic keyword extraction
- Key message generation
- Batch processing support

**Data Flow:**
```
ContentIdea → Validation → Enrichment → EnrichedContentIdea
```

### 2. Creative Direction Pillar (`pillar_creative.py`)

**Purpose**: Generate brand-compliant creative guidelines.

**Components:**
- `BrandComplianceChecker`: Ensures brand guideline compliance
- `CreativeGenerator`: AI-powered creative direction generation
- `CreativeDirectionPillar`: Main orchestration class

**Key Features:**
- Visual style generation
- Narrative arc development
- Scene breakdown
- Voiceover script generation
- Music style recommendations
- Brand compliance validation

**Data Flow:**
```
ContentIdea → Creative Generation → Compliance Check → CreativeDirection
```

### 3. Media Synthesis Pillar (`pillar_synthesis.py`)

**Purpose**: Transform creative direction into video content.

**Components:**
- `VideoGenerator`: Generates video from creative direction
- `VideoQualityChecker`: Validates video quality
- `MediaSynthesisPillar`: Main orchestration class

**Key Features:**
- Video metadata generation
- Quality assurance checks
- Resolution and format management
- File size estimation
- Batch synthesis support

**Data Flow:**
```
CreativeDirection → Video Generation → Quality Check → VideoContent
```

### 4. State Management Pillar (`pillar_state.py`)

**Purpose**: Persistent state tracking and metrics collection.

**Components:**
- `StateStore`: Persistent storage management
- `WorkflowTracker`: Content lifecycle tracking
- `MetricsCollector`: System metrics aggregation
- `StateManagementPillar`: Main orchestration class

**Key Features:**
- Persistent state storage (JSON/SQLite)
- Workflow status tracking
- Complete audit trail
- Real-time metrics
- Campaign management

**Data Flow:**
```
Any Entity → StateStore → Persistent Storage
Content → WorkflowTracker → Status History
```

### 5. Multi-Platform Distribution Pillar (`pillar_distribution.py`)

**Purpose**: Optimize and distribute content across platforms.

**Components:**
- `ViralPotentialAnalyzer`: Analyzes viral potential
- `PlatformOptimizer`: Platform-specific optimization
- `DistributionExecutor`: Executes distribution
- `MultiPlatformDistributionPillar`: Main orchestration class

**Key Features:**
- Multi-dimensional viral scoring
- Platform-specific optimization
- Smart platform recommendations
- Automated distribution execution
- Scheduling support

**Data Flow:**
```
VideoContent → Viral Analysis → Platform Optimization → Distribution
```

## Core Components

### Configuration Management (`config.py`)

Centralized configuration management using Pydantic models.

**Key Classes:**
- `BrandConfig`: Brand identity and guidelines
- `AIConfig`: AI model configuration
- `MediaConfig`: Media synthesis settings
- `DistributionConfig`: Distribution preferences
- `EngineConfig`: Master configuration
- `ConfigManager`: Configuration loading/saving

### Data Models (`models.py`)

Comprehensive data models using Pydantic for validation.

**Key Models:**
- `ContentIdea`: Input content specification
- `CreativeDirection`: Creative guidelines
- `VideoContent`: Synthesized video metadata
- `DistributionPlan`: Distribution strategy
- `Campaign`: Multi-content campaign
- `ViralScore`: Viral potential metrics

**Enums:**
- `ContentType`: Types of content
- `ContentStatus`: Workflow states
- `Platform`: Supported platforms

### Main Engine (`engine.py`)

Orchestration layer that coordinates all pillars.

**Key Responsibilities:**
1. Initialize and configure all pillars
2. Coordinate data flow between pillars
3. Manage workflow progression
4. Provide unified API
5. Handle error propagation

## Data Flow Architecture

### End-to-End Pipeline

```
1. Input: ContentIdea
   ↓
2. Pillar 1: Content Ingestion
   - Validate content
   - Enrich metadata
   - Check brand safety
   ↓
3. Pillar 4: State Management
   - Track as INGESTED
   ↓
4. Pillar 2: Creative Direction
   - Generate creative guidelines
   - Check brand compliance
   ↓
5. Pillar 4: State Management
   - Track as CREATIVE_REVIEW
   ↓
6. Pillar 3: Media Synthesis
   - Generate video
   - Check quality
   ↓
7. Pillar 4: State Management
   - Track as REVIEW
   ↓
8. Pillar 5: Distribution Planning
   - Analyze viral potential
   - Optimize for platforms
   ↓
9. Pillar 4: State Management
   - Track as DISTRIBUTED
   ↓
10. Pillar 5: Distribution Execution (optional)
    - Publish to platforms
    ↓
11. Pillar 4: State Management
    - Track as PUBLISHED
    ↓
12. Output: Complete campaign with metrics
```

## Scalability Considerations

### Horizontal Scaling
- Each pillar can be deployed independently
- Stateless processing allows for parallel execution
- State management provides coordination

### Vertical Scaling
- Batch processing support in all pillars
- Efficient data models minimize memory usage
- Streaming support for large campaigns

### Future Enhancements
- Message queue integration (RabbitMQ/Kafka)
- Distributed state management (Redis cluster)
- API Gateway for external access
- Microservices deployment
- Kubernetes orchestration

## Technology Stack

### Core
- **Python 3.8+**: Main programming language
- **Pydantic**: Data validation and settings management
- **PyYAML**: Configuration file parsing

### AI/ML (Planned)
- **OpenAI GPT-4**: Content generation
- **Anthropic Claude**: Alternative AI provider

### Media Processing (Planned)
- **MoviePy**: Video editing and composition
- **Pillow**: Image processing
- **FFmpeg**: Media transcoding

### Storage
- **JSON**: File-based state storage (development)
- **SQLAlchemy**: Database ORM (production)
- **Redis**: Distributed caching and state

### API (Planned)
- **FastAPI**: REST API framework
- **Uvicorn**: ASGI server
- **Pydantic**: Request/response validation

## Security Considerations

### Brand Safety
- Content screening before processing
- Keyword filtering
- Manual review checkpoints
- Compliance validation

### Data Protection
- No external API calls in current implementation
- Local state storage
- Configurable output directories
- Environment variable support

### Input Validation
- Pydantic model validation
- Type checking
- Range validation
- Required field enforcement

## Testing Strategy

### Unit Tests
- Each pillar tested independently
- Component-level testing
- Mock external dependencies

### Integration Tests
- End-to-end pipeline testing
- Multi-content campaign testing
- Error handling verification

### Performance Tests (Future)
- Load testing with large batches
- Memory profiling
- Execution time benchmarks

## Deployment Options

### Development
```bash
python engine.py
```

### Docker
```bash
docker build -t marketing-engine .
docker run -v $(pwd)/output:/app/output marketing-engine
```

### Docker Compose
```bash
docker-compose up -d
```

### Production (Future)
- Kubernetes deployment
- Cloud-native architecture
- Auto-scaling policies
- Load balancing

## Monitoring and Observability

### Current
- Console logging
- Status tracking
- Metrics collection

### Future
- Structured logging (JSON)
- Distributed tracing
- Metrics export (Prometheus)
- Alerting (PagerDuty)
- Dashboards (Grafana)

## Extension Points

The architecture supports easy extension:

1. **Custom Validators**: Extend `ContentValidator`
2. **Custom Generators**: Extend `CreativeGenerator`
3. **Custom Quality Checks**: Extend `VideoQualityChecker`
4. **Custom Storage**: Implement `StateStore` interface
5. **Custom Platforms**: Add to `Platform` enum and implement handlers
