# Phase 5: Release - Implementation Guide

## Overview

Phase 5 implements automated versioning, tagging, and release artifact generation with Docker image deployment to Docker Hub or a private registry.

## Features Implemented

### 1. **Git Versioning & Tagging**
- Semantic versioning (v1.0.0, v1.1.0, etc.)
- Automated tag validation
- Git tag creation with proper formatting

### 2. **Docker Image Generation**
- Multi-stage Docker builds
- Tagged with version (e.g., `username/notes-app:1.0.0`)
- Latest tag always points to most recent release
- Build caching for optimized builds

### 3. **Release Artifacts**
- `package.json` with dependencies
- `Dockerfile` for reproducibility
- `docker-compose.yml` for easy deployment
- `BUILD_INFO.txt` with deployment instructions
- Automatic changelog generation

### 4. **GitHub Release Creation**
- Automatic release page on GitHub
- Release artifacts attached
- Detailed release notes
- Easy navigation to Docker images

### 5. **Slack Notifications**
- Release status notifications
- Docker image information
- Direct links to release and logs

## Workflow Files

### `.github/workflows/release.yml`

Triggered when a version tag (v*.*.* format) is pushed:

```yaml
on:
  push:
    tags:
      - 'v*'
```

**Jobs:**

1. **verify** - Validates version format and extracts version number
2. **build-and-push** - Builds Docker image and pushes to Docker Hub
3. **generate-release-artifacts** - Creates release files and documentation
4. **create-github-release** - Creates GitHub release with artifacts
5. **notify-release** - Sends Slack notification

## Release Management Script

### `scripts/release.sh`

Helper script for managing releases locally.

### Setup

First, make the script executable:

```bash
chmod +x scripts/release.sh
```

### Commands

#### 1. Check Current Version
```bash
./scripts/release.sh current
# or
npm run release:info
```

Shows current version and recent tags.

#### 2. Bump Version
```bash
./scripts/release.sh bump patch
./scripts/release.sh bump minor
./scripts/release.sh bump major
# or use npm
npm run release:bump patch
```

Updates `package.json` and creates `VERSION` file.

#### 3. Create Git Tag
```bash
./scripts/release.sh tag
# or
npm run release:tag
```

Creates annotated git tag for current version.

#### 4. Publish Release
```bash
./scripts/release.sh publish
# or
npm run release:publish
```

Pushes tag to GitHub, triggering release workflow.

#### 5. Complete Release Flow
```bash
./scripts/release.sh prepare minor
npm run release:publish
```

All-in-one command to prepare and publish release.

## GitHub Secrets Setup

Configure these secrets in GitHub repository settings:

### Required Secrets

1. **DOCKER_USERNAME** - Docker Hub username
   - Go to: GitHub Repo → Settings → Secrets and variables → Actions
   - Add secret with your Docker Hub username

2. **DOCKER_PASSWORD** - Docker Hub password or token
   - Create Personal Access Token on Docker Hub
   - Go to: Docker Hub → Account Settings → Security → New Access Token
   - Copy token and add as GitHub secret

3. **SLACK_WEBHOOK_URL** (Optional) - Slack webhook for notifications
   - Create incoming webhook in Slack workspace
   - Go to: Slack Workspace → Apps → Incoming Webhooks

### Example Setup Commands

```bash
# Using GitHub CLI (requires installation)
gh secret set DOCKER_USERNAME --body "your-docker-username"
gh secret set DOCKER_PASSWORD --body "your-docker-token"
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
```

## Complete Release Workflow

### Step 1: Develop & Test
```bash
git checkout -b feature/my-feature
# Make changes
git commit -m "feat: add new feature"
git push origin feature/my-feature
# Create PR, test in CI pipeline
```

### Step 2: Merge to Main
```bash
# PR approved and merged to main
git checkout main
git pull origin main
```

### Step 3: Prepare Release (Local)
```bash
# Check current version
./scripts/release.sh current

# Bump version (e.g., from 1.0.0 to 1.1.0)
./scripts/release.sh bump minor

# Review changes
git log -1 --stat
cat VERSION
```

### Step 4: Create & Push Tag
```bash
# Create git tag
./scripts/release.sh tag

# Push to GitHub (triggers release workflow)
./scripts/release.sh publish

# Monitor in GitHub Actions
# https://github.com/YOUR_REPO/actions
```

### Step 5: Monitor Release Pipeline
1. GitHub Actions automatically runs release workflow
2. Docker image built and pushed to Docker Hub
3. Release artifacts generated
4. GitHub release page created
5. Slack notification sent (if configured)

### Step 6: Verify & Deploy
```bash
# Pull and test the released image
docker pull USERNAME/notes-app:1.1.0

# Run the released version
docker run -d -p 3000:3000 \
  -e DB_HOST=localhost \
  -e DB_USER=root \
  -e DB_PASSWORD=password \
  -e DB_NAME=notes_app \
  USERNAME/notes-app:1.1.0

# Verify health
curl http://localhost:3000/health
```

## Version Format

Semantic Versioning is used: `MAJOR.MINOR.PATCH[-PRERELEASE]`

Examples:
- `1.0.0` - First release
- `1.1.0` - Minor update with new features
- `1.1.1` - Patch for bug fix
- `2.0.0` - Major version with breaking changes
- `1.0.0-alpha` - Pre-release version

## Docker Image Naming

Version `1.1.0` creates two images:

```
USERNAME/notes-app:1.1.0    # Specific version
USERNAME/notes-app:latest   # Always latest release
```

Both are pushed simultaneously.

## Release Artifacts

Generated for each release:

1. **package.json** - Dependencies snapshot
2. **Dockerfile** - Docker image recipe
3. **docker-compose.yml** - Multi-container setup
4. **BUILD_INFO.txt** - Complete deployment guide
5. **CHANGELOG_ENTRY.md** - Release notes

All artifacts:
- Available in GitHub release page
- Stored in GitHub Actions artifacts (30 days retention)
- Easily accessible for deployment teams

## Deployment Examples

### Manual Docker Deployment
```bash
docker pull USERNAME/notes-app:1.1.0
docker run -d -p 3000:3000 USERNAME/notes-app:1.1.0
```

### Using Docker Compose
```bash
# From release artifacts
docker-compose -f docker-compose.yml up -d
```

### Kubernetes Deployment
```yaml
spec:
  containers:
  - name: notes-app
    image: USERNAME/notes-app:1.1.0  # Use specific version
    ports:
    - containerPort: 3000
```

## Troubleshooting

### Tag Already Exists
```bash
# If tag already created locally
git tag -d v1.0.0        # Delete local tag
git push origin :v1.0.0  # Delete remote tag
./scripts/release.sh tag # Create again
```

### Docker Push Fails
1. Check Docker Hub credentials in GitHub secrets
2. Verify Docker Hub account has push permissions
3. Check Docker username is correct
4. Ensure no existing image conflicts

### Release Workflow Not Triggering
1. Verify tag format: `v1.0.0` (not `1.0.0`)
2. Tag must be pushed to GitHub: `git push origin v1.0.0`
3. Check GitHub Actions settings: ensure workflows are enabled
4. Verify `.github/workflows/release.yml` exists and is committed

### Slack Notifications Not Working
1. Verify `SLACK_WEBHOOK_URL` secret is set correctly
2. Test webhook URL manually:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test"}' \
     "$SLACK_WEBHOOK_URL"
   ```

## Environment Variables

### Runtime Configuration

When deploying released image, configure:

```bash
DB_HOST       # Database host
DB_USER       # Database username
DB_PASSWORD   # Database password
DB_NAME       # Database name
NODE_ENV      # Environment (production/development)
PORT          # Application port (default: 3000)
```

## Monitoring & Rollback

### Monitor Release
1. Check GitHub Actions: Run completed successfully
2. Verify Docker Hub: Image pushed with correct tags
3. Check GitHub Releases: Release page created
4. Pull and test: `docker pull USERNAME/notes-app:1.1.0`

### Rollback Procedure
If issues found with released version:

```bash
# Deploy previous version
docker pull USERNAME/notes-app:1.0.0
docker run -d -p 3000:3000 USERNAME/notes-app:1.0.0

# Create hotfix release
git checkout -b hotfix/fix-issue
# Make fixes
git commit -m "fix: issue description"
# Merge to main
# Create new tag: v1.1.1
```

## Integration with CI/CD Pipeline

The release workflow works alongside existing CI/CD:

```
main branch commits
        ↓
    CI Pipeline (ci.yml)
    - Test
    - Build
    - Deploy to staging
        ↓
    Tag pushed (v1.1.0)
        ↓
    Release Pipeline (release.yml)
    - Verify version
    - Build & Push Docker
    - Generate artifacts
    - Create GitHub release
    - Notify Slack
```

## Files Created/Modified

```
.github/
├── workflows/
│   ├── ci.yml           (modified - added Slack notifications)
│   └── release.yml      (new - release workflow)

scripts/
└── release.sh           (new - release management script)

VERSION                  (new - version tracking)
package.json             (modified - added release scripts)
```

## Next Steps

1. Set up Docker Hub account if not already done
2. Configure GitHub secrets (DOCKER_USERNAME, DOCKER_PASSWORD)
3. Test release workflow with a minor version bump
4. Set up Slack notifications (optional but recommended)
5. Document in team wiki: Release procedures
6. Train team on release process

## References

- [Semantic Versioning](https://semver.org/)
- [Docker Hub](https://hub.docker.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/)
- [GitHub Actions](https://docs.github.com/en/actions)
