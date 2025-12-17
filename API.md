# API Documentation

## MarketingContentEngine Class

The main orchestration class that coordinates all five operational pillars.

### Initialization

```python
from engine import MarketingContentEngine

engine = MarketingContentEngine(config_path="./config.yaml")
```

**Parameters:**
- `config_path` (Optional[str]): Path to configuration file. Defaults to `./config.yaml`

### Methods

#### process_content_idea

Process a single content idea through the complete pipeline.

```python
result = engine.process_content_idea(
    idea=content_idea,
    platforms=[Platform.YOUTUBE, Platform.INSTAGRAM],
    auto_distribute=False
)
```

**Parameters:**
- `idea` (ContentIdea): Content idea to process
- `platforms` (Optional[List[Platform]]): List of platforms to distribute to. If None, platforms are auto-recommended.
- `auto_distribute` (bool): Whether to automatically publish content. Default: False

**Returns:**
- `Dict[str, any]`: Dictionary containing:
  - `success` (bool): Whether processing succeeded
  - `content_id` (str): ID of processed content
  - `stages` (dict): Results from each pipeline stage
  - `error` (Optional[str]): Error message if failed

**Example:**
```python
from models import ContentIdea, ContentType, Platform

idea = ContentIdea(
    title="Marketing Guide",
    description="Complete guide to digital marketing.",
    content_type=ContentType.EDUCATIONAL,
    target_audience="Marketers",
    duration_seconds=120
)

result = engine.process_content_idea(idea, platforms=[Platform.YOUTUBE])
```

#### create_campaign

Create and process a complete campaign with multiple content pieces.

```python
campaign_result = engine.create_campaign(
    name="Campaign Name",
    description="Campaign description",
    ideas=[idea1, idea2, idea3],
    platforms=[Platform.YOUTUBE, Platform.INSTAGRAM]
)
```

**Parameters:**
- `name` (str): Campaign name
- `description` (str): Campaign description
- `ideas` (List[ContentIdea]): List of content ideas
- `platforms` (Optional[List[Platform]]): Platforms for all content

**Returns:**
- `Dict[str, any]`: Dictionary containing:
  - `success` (bool): Whether all content processed successfully
  - `campaign` (Campaign): Campaign object
  - `successful_content` (List[str]): IDs of successful content
  - `failed_content` (List[dict]): Failed content with errors
  - `metrics` (dict): Campaign metrics

#### get_content_status

Get current status and history of content.

```python
status = engine.get_content_status(content_id)
```

**Parameters:**
- `content_id` (str): ID of content to check

**Returns:**
- `Dict[str, any]`: Dictionary containing:
  - `content_id` (str): Content ID
  - `current_status` (str): Current workflow status
  - `history` (List[dict]): Status change history

#### get_metrics

Get system metrics at various levels.

```python
# Overall metrics
overall = engine.get_metrics("overall")

# Content metrics
content = engine.get_metrics("content", entity_id=content_id)

# Campaign metrics
campaign = engine.get_metrics("campaign", entity_id=campaign_id)
```

**Parameters:**
- `metric_type` (str): Type of metrics - "overall", "content", or "campaign"
- `entity_id` (Optional[str]): ID for content or campaign metrics

**Returns:**
- `Dict[str, any]`: Metrics dictionary

## Data Models

### ContentIdea

Input model for content ideas.

```python
from models import ContentIdea, ContentType

idea = ContentIdea(
    title="Content Title",
    description="Content description",
    content_type=ContentType.EDUCATIONAL,
    target_audience="Target audience description",
    key_messages=["Message 1", "Message 2"],
    keywords=["keyword1", "keyword2"],
    duration_seconds=90
)
```

**Fields:**
- `id` (str): Auto-generated UUID
- `title` (str): Content title
- `description` (str): Content description
- `content_type` (ContentType): Type of content
- `target_audience` (str): Target audience
- `key_messages` (List[str]): Key messages to convey
- `keywords` (List[str]): Content keywords
- `duration_seconds` (int): Target duration
- `created_at` (datetime): Creation timestamp

### ContentType Enum

```python
from models import ContentType

ContentType.EDUCATIONAL
ContentType.MARKETING
ContentType.PROMOTIONAL
ContentType.TUTORIAL
ContentType.ADVERTISEMENT
```

### Platform Enum

```python
from models import Platform

Platform.YOUTUBE
Platform.TIKTOK
Platform.INSTAGRAM
Platform.FACEBOOK
Platform.LINKEDIN
Platform.TWITTER
```

### ContentStatus Enum

```python
from models import ContentStatus

ContentStatus.DRAFT
ContentStatus.INGESTED
ContentStatus.CREATIVE_REVIEW
ContentStatus.SYNTHESIZING
ContentStatus.REVIEW
ContentStatus.APPROVED
ContentStatus.DISTRIBUTED
ContentStatus.PUBLISHED
ContentStatus.FAILED
```

### ViralScore

Viral potential scoring.

```python
viral_score = result['stages']['distribution_plan']['viral_score']

print(f"Overall: {viral_score.overall_score}/100")
print(f"Engagement: {viral_score.engagement_potential}/100")
print(f"Shareability: {viral_score.shareability}/100")
print(f"Emotional Impact: {viral_score.emotional_impact}/100")
print(f"Trend Alignment: {viral_score.trend_alignment}/100")
print(f"Reasoning: {viral_score.reasoning}")
```

**Fields:**
- `overall_score` (float): Overall viral potential (0-100)
- `engagement_potential` (float): Engagement score (0-100)
- `shareability` (float): Shareability score (0-100)
- `emotional_impact` (float): Emotional impact score (0-100)
- `trend_alignment` (float): Trend alignment score (0-100)
- `reasoning` (str): Analysis reasoning

## Configuration

### EngineConfig

Main configuration model.

```python
from config import EngineConfig, BrandConfig, AIConfig, MediaConfig

config = EngineConfig(
    brand=BrandConfig(
        name="Brand Name",
        colors=["#0066CC", "#FFFFFF"],
        tone="professional",
        voice="engaging"
    ),
    ai=AIConfig(
        provider="openai",
        model="gpt-4",
        temperature=0.7
    ),
    media=MediaConfig(
        video_resolution="1920x1080",
        video_fps=30,
        video_format="mp4"
    ),
    output_dir="./output",
    state_db_path="./state.db"
)
```

## Error Handling

All methods return structured results with success indicators:

```python
result = engine.process_content_idea(idea)

if result['success']:
    # Success path
    video = result['stages']['synthesis']['video']
    print(f"Video created: {video.file_path}")
else:
    # Error path
    print(f"Error: {result.get('error', 'Unknown error')}")
```

## Best Practices

1. **Validation**: Always validate input before processing
2. **Error Handling**: Check `success` field in results
3. **Metrics**: Regularly monitor system metrics
4. **Status Tracking**: Use `get_content_status()` to track progress
5. **Brand Compliance**: Review compliance issues in creative stage
6. **Viral Optimization**: Use viral scores to optimize content
7. **Platform Selection**: Let the engine recommend platforms or specify explicitly

## Examples

See the following example files:
- `example_basic.py`: Single content processing
- `example_campaign.py`: Multi-content campaign
- `engine.py`: Built-in examples in `main()` function
