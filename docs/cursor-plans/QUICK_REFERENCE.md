# Quick Reference - Common Commands

## 🚀 Setup & Startup

```bash
# Initial setup
bash scripts/setup/install_dependencies.sh

# Start all services
npm run docker:up
# or
docker-compose up -d

# Stop all services
npm run docker:down
# or
docker-compose down

# Restart services
docker-compose restart

# View running containers
docker ps
```

## 💾 Database Commands

```bash
# Run all migrations
npm run db:migrate
# or
bash scripts/migrations/run_migrations.sh

# Seed sample data
npm run db:seed
# or
bash scripts/migrations/seed_database.sh

# Rollback last migration
npm run db:rollback
# or
bash scripts/migrations/rollback_migrations.sh

# Connect to database
psql -h localhost -U postgres -d brand_infinity

# View tables
psql -U postgres -d brand_infinity -c "\dt"

# Check migration status
psql -U postgres -d brand_infinity -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
```

## 🔄 n8n Workflows

```bash
# Deploy workflows to n8n
npm run deploy:workflows
# or
bash scripts/setup/deploy_n8n_workflows.sh

# Access n8n UI
open http://localhost:5678
```

## 📊 Monitoring & Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs n8n

# Follow logs in real-time
docker-compose logs -f n8n

# Cost report (custom script)
npm run costs:report
```

## 🧪 Testing

```bash
# Test strategist endpoint
curl -X POST http://localhost:5678/webhook/strategist \
  -H "Content-Type: application/json" \
  -d '{"brand_guideline_id": 1, "campaign_goal": "Test campaign", "target_platform": "Instagram"}'

# Test copywriter endpoint
curl -X POST http://localhost:5678/webhook/copywriter \
  -H "Content-Type: application/json" \
  -d '{"creative_brief_id": 1, "duration_seconds": 30}'

# Test production endpoint
curl -X POST http://localhost:5678/webhook/production \
  -H "Content-Type: application/json" \
  -d '{"script_id": 1, "quality": "high"}'
```

## 🗄️ Database Queries

```sql
-- View all creative briefs
SELECT * FROM creative_briefs ORDER BY created_at DESC LIMIT 10;

-- View cost breakdown (last 24 hours)
SELECT 
    provider,
    model,
    COUNT(*) as calls,
    SUM(cost_usd) as total_cost
FROM cost_ledger
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY provider, model
ORDER BY total_cost DESC;

-- View campaign performance
SELECT 
    c.campaign_name,
    COUNT(DISTINCT pp.platform_post_id) as posts,
    AVG(em.engagement_rate) as avg_engagement
FROM campaigns c
JOIN variants v ON c.campaign_id = v.campaign_id
JOIN platform_posts pp ON v.variant_id = pp.variant_id
JOIN engagement_metrics em ON pp.platform_post_id = em.platform_post_id
GROUP BY c.campaign_id, c.campaign_name
ORDER BY avg_engagement DESC;

-- Check video generation jobs
SELECT * FROM generation_jobs 
WHERE status = 'in_progress' 
ORDER BY started_at DESC;
```

## 🔧 Troubleshooting

```bash
# Reset everything (WARNING: Deletes all data)
docker-compose down -v
docker-compose up -d
npm run db:migrate

# Clean Docker cache
docker system prune -a --volumes

# Check disk space
docker system df

# Restart specific service
docker-compose restart postgres
docker-compose restart n8n

# View container resource usage
docker stats
```

## 📝 File Locations

```
Config Files:
- .env                          # Your API keys (DO NOT COMMIT)
- .env.example                  # Template
- docker-compose.yml            # Docker services
- package.json                  # npm dependencies

Database:
- database/migrations/*.sql     # SQL migration files

Scripts:
- scripts/setup/*.sh            # Setup scripts
- scripts/migrations/*.sh       # Migration scripts

Utilities:
- utils/brand_validator.js      # Brand validation
- utils/cost_calculator.js      # Cost tracking
- utils/quality_scorer.js       # Content quality
- utils/model_router.js         # AI model selection

Documentation:
- docs/SETUP_GUIDE.md          # Complete setup
- docs/API_DOCUMENTATION.md    # API reference
- docs/TROUBLESHOOTING.md      # Problem solutions
- README.md                    # Project overview
- IMPLEMENTATION_SUMMARY.md    # What's done/TODO
```

## 🌐 URLs

```
n8n Dashboard:         http://localhost:5678
pgAdmin (optional):    http://localhost:5050
Redis Commander:       http://localhost:8081

Webhook Endpoints:
Strategist:            http://localhost:5678/webhook/strategist
Copywriter:            http://localhost:5678/webhook/copywriter
Production:            http://localhost:5678/webhook/production
Campaign:              http://localhost:5678/webhook/campaign
Broadcast:             http://localhost:5678/webhook/broadcast
```

## 💡 Environment Variables

```bash
# View all env vars
cat .env

# Check specific variable
echo $OPENAI_API_KEY

# Reload env vars (if changed)
source .env  # bash
set -a; source .env; set +a  # more reliable

# Verify PostgreSQL connection
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB" -c "SELECT version();"
```

## 📦 npm Scripts Reference

```bash
npm run setup              # Initial setup
npm run docker:up          # Start Docker services
npm run docker:down        # Stop Docker services
npm run db:migrate         # Run migrations
npm run db:rollback        # Rollback last migration
npm run db:seed            # Seed sample data
npm run db:reset           # Reset database (destructive)
npm run db:test            # Test database connection
npm run deploy:workflows   # Deploy n8n workflows
npm run test               # Run tests
npm run test:apis          # Test API integrations
npm run test:workflows     # Test workflow execution
npm run costs:report       # Generate cost report
npm run logs               # View all logs
npm run health             # Health check
```

## 🔐 Security Checklist

```bash
# Verify .gitignore
cat .gitignore | grep .env

# Check for exposed secrets
git log --all --full-history -- .env

# Rotate API keys (do this regularly)
# 1. Generate new key in provider dashboard
# 2. Update .env
# 3. Restart services: docker-compose restart

# Backup database
pg_dump -U postgres -h localhost -d brand_infinity > backup_$(date +%Y%m%d).sql

# Restore database
psql -U postgres -h localhost -d brand_infinity < backup_20240101.sql
```

---

**Need more help? See the full documentation in `docs/` folder.**
