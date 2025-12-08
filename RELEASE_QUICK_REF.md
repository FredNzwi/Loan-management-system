# Release Quick Reference

## TL;DR - Release in 5 Steps

```bash
# 1. Prepare release (bumps version and creates necessary files)
./scripts/release.sh prepare minor

# 2. Push changes
git push origin main

# 3. Create and tag release
./scripts/release.sh tag

# 4. Publish (triggers Docker build)
./scripts/release.sh publish

# 5. Done! Monitor at: https://github.com/YOUR_REPO/actions
```

## Common Release Commands

### Check Current Version
```bash
./scripts/release.sh current
npm run release:info
```

### Bump Version
```bash
./scripts/release.sh bump patch  # 1.0.0 → 1.0.1
./scripts/release.sh bump minor  # 1.0.0 → 1.1.0
./scripts/release.sh bump major  # 1.0.0 → 2.0.0
```

### Create Release
```bash
./scripts/release.sh tag        # Create git tag
git push origin v1.1.0          # Or use:
./scripts/release.sh publish    # Push and trigger
```

### List Releases
```bash
./scripts/release.sh list
git tag -l "v*"
```

## Before First Release

### 1. Set GitHub Secrets
- `DOCKER_USERNAME` - Your Docker Hub username
- `DOCKER_PASSWORD` - Your Docker Hub password/token
- `SLACK_WEBHOOK_URL` - Optional Slack notifications

### 2. Make Script Executable
```bash
chmod +x scripts/release.sh
```

## Version Numbering

| Change Type | Bump | Example |
|-------------|------|---------|
| New features, non-breaking | Minor | 1.0.0 → 1.1.0 |
| Bug fixes only | Patch | 1.0.0 → 1.0.1 |
| Breaking changes | Major | 1.0.0 → 2.0.0 |

## What Happens on Release

1. ✅ Version validated (must be X.Y.Z format)
2. 🏗️ Docker image built with version tag
3. 🐳 Image pushed to Docker Hub (USERNAME/notes-app:1.1.0)
4. 📦 Release artifacts generated
5. 🏷️ GitHub release page created
6. 💬 Slack notification sent (if configured)

## Docker Images After Release

For version 1.1.0:
- `USERNAME/notes-app:1.1.0` - Specific version
- `USERNAME/notes-app:latest` - Points to 1.1.0

## Docker Pull & Run

```bash
# Pull latest
docker pull USERNAME/notes-app:latest

# Pull specific version
docker pull USERNAME/notes-app:1.1.0

# Run
docker run -d -p 3000:3000 USERNAME/notes-app:1.1.0
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tag already exists | `git tag -d v1.0.0` then `git push origin :v1.0.0` |
| Workflow not starting | Check tag format: must be `v1.0.0` not `1.0.0` |
| Docker push fails | Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets |
| Version validation fails | Use format: `1.0.0` or `1.0.0-alpha` |

## Files Generated on Release

In GitHub release artifacts:
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `BUILD_INFO.txt` (deployment instructions)

## Using npm Scripts

```bash
npm run release:prepare patch   # Quick prepare
npm run release:bump minor      # Just bump version
npm run release:tag            # Just create tag
npm run release:publish        # Just push tag
npm run release:list           # List all releases
npm run release:info           # Show release info
```

## Safety Checks

Release workflow automatically:
- ✅ Validates version format
- ✅ Runs all tests before release
- ✅ Verifies Docker image after push
- ✅ Prevents duplicate tags

## Manual Docker Hub Upload (if needed)

```bash
docker build -t USERNAME/notes-app:1.1.0 .
docker tag USERNAME/notes-app:1.1.0 USERNAME/notes-app:latest
docker login
docker push USERNAME/notes-app:1.1.0
docker push USERNAME/notes-app:latest
```

## Integration Notes

Release workflow is separate from CI workflow:
- **CI Workflow (ci.yml)**: Runs on every push/PR
- **Release Workflow (release.yml)**: Runs only on version tags

Both can run independently!
