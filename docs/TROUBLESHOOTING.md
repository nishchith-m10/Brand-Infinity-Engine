# Brand Infinity Engine - Troubleshooting Guide

Common issues and their solutions.

---

## 📋 Table of Contents

1. [Installation Issues](#installation-issues)
2. [Database Problems](#database-problems)
3. [Docker Issues](#docker-issues)
4. [n8n Workflow Errors](#n8n-workflow-errors)
5. [API Integration Problems](#api-integration-problems)
6. [Performance Issues](#performance-issues)
7. [Cost Management](#cost-management)

---

## Installation Issues

### Node.js Version Mismatch

**Problem:** `Error: The engine "node" is incompatible`

**Solution:**
```bash
# Check your Node.js version
node --version

# Should be 18.x or higher
# Install correct version:
# macOS
brew install node@18

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### npm Install Fails

**Problem:** `EACCES: permission denied`

**Solution:**
```bash
# Don't use sudo! Fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Retry installation
npm install
```

### Missing Dependencies

**Problem:** `Cannot find module 'xyz'`

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## Database Problems

### Cannot Connect to PostgreSQL

**Problem:** `ECONNREFUSED 127.0.0.1:5432`

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs n8n_workflows-postgres-1
```

**Solutions:**

**Option 1: Start PostgreSQL**
```bash
docker-compose up -d postgres

# Wait for it to be ready
sleep 5

# Test connection
npm run db:test
```

**Option 2: Check .env Configuration**
```bash
# Verify database credentials in .env
cat .env | grep POSTGRES

# Correct values:
POSTGRES_HOST=localhost  # or 'postgres' if connecting from Docker
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=brand_infinity
```

**Option 3: Reset Database Container**
```bash
docker-compose down -v  # WARNING: Deletes all data
docker-compose up -d postgres
npm run db:migrate
```

### pgvector Extension Not Found

**Problem:** `extension "vector" does not exist`

**Solution:**
```bash
# Using Docker (recommended)
docker-compose down
docker-compose up -d postgres

# The pgvector/pgvector:pg14 image includes the extension

# Manually enable if needed
docker exec -it n8n_workflows-postgres-1 psql -U postgres -d brand_infinity -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Migration Fails

**Problem:** `Error running migration 005_create_scripts_table.sql`

**Diagnosis:**
```bash
# Check which migrations have been applied
psql -U postgres -d brand_infinity -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
```

**Solution:**
```bash
# Rollback the last migration
npm run db:rollback

# Fix the SQL file if there's an error
# Then re-run migrations
npm run db:migrate
```

### Database Tables Missing

**Problem:** `relation "trends" does not exist`

**Solution:**
```bash
# Run all migrations
npm run db:migrate

# Verify tables exist
psql -U postgres -d brand_infinity -c "\dt"

# Should see 21 tables
```

---

## Docker Issues

### Docker Not Running

**Problem:** `Cannot connect to the Docker daemon`

**Solution:**
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
sudo systemctl enable docker
```

### Port Already in Use

**Problem:** `Error starting userland proxy: bind: address already in use`

**Diagnosis:**
```bash
# Find what's using the port (e.g., 5432 for PostgreSQL)
lsof -i :5432

# Or
sudo netstat -tulpn | grep 5432
```

**Solution:**

**Option 1: Stop the conflicting service**
```bash
# If another PostgreSQL is running
sudo systemctl stop postgresql

# Or kill the process
kill -9 <PID>
```

**Option 2: Change the port in docker-compose.yml**
```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Use port 5433 instead
```

Then update `.env`:
```env
POSTGRES_PORT=5433
```

### Container Health Check Fails

**Problem:** `container is unhealthy`

**Diagnosis:**
```bash
docker ps  # Shows health status
docker logs n8n_workflows-postgres-1  # View error logs
```

**Solution:**
```bash
# Restart the container
docker-compose restart postgres

# If that doesn't work, recreate it
docker-compose down
docker-compose up -d postgres
```

### Out of Disk Space

**Problem:** `no space left on device`

**Solution:**
```bash
# Clean up Docker
docker system prune -a --volumes

# WARNING: This removes:
# - All stopped containers
# - All dangling images
# - Unused networks
# - Build cache
# - Anonymous volumes
```

---

## n8n Workflow Errors

### n8n Cannot Connect to PostgreSQL

**Problem:** Workflow fails with database connection error

**Solution:**

**If n8n is in Docker:**
```env
# In .env, use the Docker service name
POSTGRES_HOST=postgres  # NOT 'localhost'
POSTGRES_PORT=5432
```

**If n8n is local:**
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

### Workflow Import Fails

**Problem:** `Invalid workflow JSON`

**Solution:**
```bash
# Validate JSON syntax
cat n8n/workflows/01_strategist_pillar.json | jq .

# If jq is not installed:
brew install jq  # macOS
sudo apt install jq  # Ubuntu

# Re-export from a working n8n instance if corrupted
```

### API Credentials Not Working

**Problem:** `401 Unauthorized` when calling AI APIs

**Diagnosis:**
```bash
# Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should return a list of models
```

**Solution:**
1. Verify API key in `.env` is correct
2. Check for extra spaces or newlines:
   ```bash
   # View the exact value
   echo "$OPENAI_API_KEY"
   ```
3. Regenerate API key if expired
4. Check billing status on provider's dashboard

### Webhook Not Responding

**Problem:** `curl http://localhost:5678/webhook/strategist` returns 404

**Solution:**
1. Check n8n is running:
   ```bash
   docker ps | grep n8n
   ```

2. Verify workflow is activated:
   - Go to http://localhost:5678
   - Open the workflow
   - Toggle "Active" switch to ON

3. Check webhook path matches:
   - In n8n workflow, look at the Webhook node
   - Path should be `/strategist`
   - URL: `http://localhost:5678/webhook/strategist`

### Workflow Execution Timeout

**Problem:** Workflow runs for too long and times out

**Solution:**

**Increase timeout in docker-compose.yml:**
```yaml
services:
  n8n:
    environment:
      - EXECUTIONS_TIMEOUT=300  # 5 minutes
      - EXECUTIONS_TIMEOUT_MAX=600  # 10 minutes max
```

**Or split long workflows:**
- Break into multiple workflows
- Use "Wait" nodes between heavy operations
- Trigger next workflow via webhook

---

## API Integration Problems

### OpenAI Rate Limit Exceeded

**Problem:** `Rate limit reached for requests`

**Solution:**

**Immediate fix:**
```bash
# Wait 60 seconds and retry
sleep 60
```

**Long-term solution:**
1. Upgrade OpenAI plan tier
2. Implement retry logic with exponential backoff
3. Use cheaper models for non-critical tasks:
   - Use `gpt-4o-mini` instead of `gpt-4o` for simple tasks
   - Use `text-embedding-3-small` instead of `text-embedding-3-large`

**In n8n workflows:**
- Add "Wait" node after expensive operations
- Set retry on error: `3 retries` with `5 second` wait

### Video Generation Takes Too Long

**Problem:** Video generation jobs hang or timeout

**Diagnosis:**
```sql
-- Check generation job status
SELECT * FROM generation_jobs 
WHERE status = 'in_progress' 
ORDER BY started_at DESC;
```

**Solution:**

**For Sora/Veo3 (slow models):**
- These can take 2-5 minutes per scene
- Use asynchronous processing
- Implement polling mechanism

**For faster iterations:**
- Use `nano-b` or `seedream` for prototyping
- Reserve `sora`/`veo3` for final production

**Check generation job:**
```javascript
// Poll for completion
const jobId = response.data.job_id;

const checkStatus = async () => {
    const job = await db.query(
        'SELECT status FROM generation_jobs WHERE job_id = $1',
        [jobId]
    );
    
    if (job.rows[0].status === 'completed') {
        return 'done';
    } else if (job.rows[0].status === 'failed') {
        throw new Error('Generation failed');
    } else {
        await new Promise(r => setTimeout(r, 10000));  // Wait 10s
        return checkStatus();
    }
};
```

### Storage Upload Fails

**Problem:** `Error uploading to S3` or `Google Drive quota exceeded`

**S3 Solutions:**
```bash
# Verify AWS credentials
aws s3 ls s3://your-bucket-name

# Check IAM permissions (need PutObject)
# Verify bucket region matches .env
```

**Google Drive Solutions:**
1. Check storage quota
2. Refresh OAuth token
3. Verify folder permissions

### Vector Database Connection Failed

**Problem:** Cannot connect to Pinecone or Supabase

**Pinecone:**
```bash
# Test connection
curl https://controller.us-east-1.pinecone.io/databases \
  -H "Api-Key: $PINECONE_API_KEY"
```

**Supabase:**
```bash
# Test connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Solution:**
- Verify API keys
- Check environment/region
- Ensure index exists (Pinecone) or table exists (Supabase)

---

## Performance Issues

### Workflow Runs Slowly

**Problem:** Workflow takes 5+ minutes to complete

**Optimizations:**

1. **Parallel Processing:**
   ```
   Instead of: Scene 1 → Scene 2 → Scene 3
   Use: All scenes in parallel (if supported by model)
   ```

2. **Caching:**
   - Cache brand guidelines in Redis
   - Reuse embeddings
   - Cache API responses

3. **Model Selection:**
   ```javascript
   // Use model router to select fastest model for task
   const router = new ModelRouter();
   const model = router.selectTextModel({
       priority: 'speed',
       complexity: 'low'
   });
   ```

### High Memory Usage

**Problem:** Docker containers using too much RAM

**Solution:**

**Limit container memory in docker-compose.yml:**
```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
  
  redis:
    deploy:
      resources:
        limits:
          memory: 512M
  
  n8n:
    deploy:
      resources:
        limits:
          memory: 2G
```

**Optimize PostgreSQL:**
```sql
-- Reduce shared_buffers if low on RAM
ALTER SYSTEM SET shared_buffers = '256MB';
SELECT pg_reload_conf();
```

### Database Queries Slow

**Problem:** Queries taking 2+ seconds

**Solution:**

**Add indexes (if missing):**
```sql
-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_scripts_brief_id 
ON scripts(creative_brief_id);

CREATE INDEX IF NOT EXISTS idx_scenes_video_id 
ON scenes(video_id);
```

**Vacuum database:**
```bash
# Clean up dead rows
psql -U postgres -d brand_infinity -c "VACUUM ANALYZE;"
```

---

## Cost Management

### Unexpected High Costs

**Problem:** API costs are $100+ per day

**Diagnosis:**
```sql
-- Check cost breakdown
SELECT 
    provider,
    model,
    COUNT(*) as calls,
    SUM(cost_usd) as total_cost
FROM cost_ledger
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY provider, model
ORDER BY total_cost DESC;
```

**Solutions:**

1. **Switch to cheaper models:**
   ```env
   # In .env, prefer cost-effective models
   DEFAULT_TEXT_MODEL=gpt-4o-mini  # instead of gpt-4o
   DEFAULT_VIDEO_MODEL=nano-b  # instead of sora
   ```

2. **Implement budget limits:**
   ```javascript
   // Check daily budget before expensive operation
   const todayCost = await calculateDailyCost();
   if (todayCost > DAILY_BUDGET_LIMIT) {
       throw new Error('Daily budget exceeded');
   }
   ```

3. **Cache results:**
   - Store generated scripts/videos
   - Reuse similar content
   - Don't regenerate unnecessarily

4. **Use quotas:**
   ```javascript
   // Limit video generations per day
   const todayVideos = await countTodayVideos();
   if (todayVideos >= MAX_VIDEOS_PER_DAY) {
       return 'Daily quota reached';
   }
   ```

### Cost Tracking Not Working

**Problem:** `cost_ledger` table is empty

**Solution:**
```javascript
// Ensure you're logging costs after each API call
const cost = costCalculator.calculateTextCost(
    'openai',
    'gpt-4o',
    inputTokens,
    outputTokens
);

await db.query(`
    INSERT INTO cost_ledger (
        entity_type, entity_id, operation, 
        provider, model, cost_usd, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [
    'script',
    scriptId,
    'text_generation',
    'openai',
    'gpt-4o',
    cost,
    JSON.stringify({ input_tokens: inputTokens, output_tokens: outputTokens })
]);
```

---

## Getting More Help

### Enable Debug Logging

**n8n:**
```yaml
# docker-compose.yml
services:
  n8n:
    environment:
      - N8N_LOG_LEVEL=debug
```

**Application:**
```javascript
// Add console.log statements
console.log('DEBUG: Script ID:', scriptId);
console.log('DEBUG: API Response:', response.data);
```

### Check Logs

```bash
# All containers
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs n8n

# Follow logs in real-time
docker-compose logs -f n8n

# PostgreSQL query logs
docker exec n8n_workflows-postgres-1 \
  psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"
```

### Database Debugging

```sql
-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'brand_infinity';

-- Check locks
SELECT * FROM pg_locks;
```

### Performance Profiling

```bash
# n8n execution time
# Check "Execution Time" in n8n UI for each node

# Database query time
# Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();

# View slow queries
docker exec n8n_workflows-postgres-1 tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Service not running | Start Docker containers |
| `429 Too Many Requests` | Rate limit | Wait and retry, upgrade API tier |
| `404 Not Found` | Webhook not activated | Activate n8n workflow |
| `413 Payload Too Large` | Request too big | Reduce input size or increase n8n limits |
| `ENOSPC` | Disk full | Clean up Docker: `docker system prune` |
| `Timeout` | Operation too slow | Increase timeout or optimize workflow |
| `Invalid API key` | Wrong credentials | Check `.env` file |
| `Out of memory` | RAM exceeded | Limit container memory or upgrade server |

---

## Still Stuck?

1. **Read the logs** - 90% of issues are explained in error logs
2. **Check `.env` file** - Most problems are configuration errors
3. **Verify API keys** - Expired or invalid keys cause many failures
4. **Test connections** - Use `curl` to test each service individually
5. **Search GitHub Issues** - Someone likely had the same problem
6. **Ask for help** - Create a GitHub issue with logs and steps to reproduce

---

**Previous:** [API Documentation](./API_DOCUMENTATION.md) | **Next:** [Architecture Overview](../Plan.md)
