# Docker Registry Configuration

## Overview

This guide covers Docker image deployment to Docker Hub. Can also be adapted for private registries.

## Docker Hub Setup

### 1. Create Docker Hub Account

1. Go to https://hub.docker.com
2. Click **Sign Up**
3. Fill in details
4. Verify email
5. Create first repository (optional - can be auto-created)

### 2. Create Personal Access Token

This is what GitHub Actions uses to push images.

1. Log in to Docker Hub
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Name: `GitHub Actions` (or your preference)
5. Permissions: Keep defaults (Read & Write)
6. Click **Generate**
7. **Copy the token immediately**
8. Save it securely (password manager)

**Token Format:** Usually `dckr_pat_XXXXX`

### 3. Set GitHub Secrets

See `GITHUB_SECRETS_SETUP.md` for detailed instructions.

Required secrets:
- `DOCKER_USERNAME` - Your Docker Hub username
- `DOCKER_PASSWORD` - Personal Access Token from step 2

## Repository Naming

Recommended structure:

```
USERNAME/notes-app         # Main production image
USERNAME/notes-app-dev     # Development builds
USERNAME/notes-app-staging # Staging environment
```

The release workflow uses: `USERNAME/notes-app`

## Image Tagging Strategy

Release workflow tags images as:

```
USERNAME/notes-app:1.0.0      # Semantic version
USERNAME/notes-app:latest     # Always latest release
```

**Not used in this setup:**
- `master`, `main` branches
- Build numbers
- Timestamps

This keeps registry clean and versions clear.

## Docker Hub Repository Settings

### Visibility

**Public:** Anyone can pull
- Recommended for open-source
- Better for team collaboration
- No pull rate limits for authenticated users

**Private:** Only authorized users
- For proprietary applications
- Requires authentication to pull
- Requires `docker login`

### Settings to Configure

1. **Automated Builds:** Off (we use GitHub Actions)
2. **Build Rules:** N/A (using GitHub Actions)
3. **Webhook:** Off (not needed)
4. **Scans:** Optional (scan for vulnerabilities)

## Image Size Optimization

### Check Current Size

```bash
# Build image
docker build -t notes-app:latest .

# Check size
docker images | grep notes-app
```

### Reduce Size

1. **Use Alpine base image** (in Dockerfile):
```dockerfile
FROM node:18-alpine  # Instead of node:18
```

2. **Multi-stage builds**:
```dockerfile
# Build stage
FROM node:18 AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci --only=production

# Final stage
FROM node:18-alpine
COPY --from=builder /app/node_modules ./node_modules
```

3. **.dockerignore** file:
```
node_modules
.git
.github
tests
coverage
*.md
```

### Size Comparison

- Default Node.js: ~900MB
- Node Alpine: ~180MB
- Optimized Alpine: ~150MB

## Push & Pull

### Manual Push (Testing)

```bash
# Build
docker build -t USERNAME/notes-app:1.0.0 .

# Tag as latest
docker tag USERNAME/notes-app:1.0.0 USERNAME/notes-app:latest

# Login
docker login
# Enter username and token

# Push both tags
docker push USERNAME/notes-app:1.0.0
docker push USERNAME/notes-app:latest

# Verify
docker images USERNAME/notes-app
```

### Pull Released Image

```bash
# Pull specific version
docker pull USERNAME/notes-app:1.0.0

# Pull latest
docker pull USERNAME/notes-app:latest

# Run
docker run -d -p 3000:3000 USERNAME/notes-app:latest
```

## Private Registry Alternative

If using private registry instead of Docker Hub:

### Docker Registry (Self-hosted)

```bash
# Login to private registry
docker login registry.example.com

# Tag image
docker tag notes-app:latest registry.example.com/notes-app:1.0.0

# Push
docker push registry.example.com/notes-app:1.0.0
```

### Update GitHub Secrets

```
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-token
DOCKER_REGISTRY=registry.example.com  # Add this
```

### Modify `.github/workflows/release.yml`

In `build-and-push` job:

```yaml
- name: Login to Private Registry
  uses: docker/login-action@v3
  with:
    registry: ${{ secrets.DOCKER_REGISTRY }}
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_PASSWORD }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: |
      ${{ secrets.DOCKER_REGISTRY }}/notes-app:${{ needs.verify.outputs.version }}
      ${{ secrets.DOCKER_REGISTRY }}/notes-app:latest
```

## Image Scanning

### Docker Hub Scanning

1. Go to your repository
2. Click **Scans** tab
3. Enable **Scan on push**
4. Pushes will be scanned for vulnerabilities

### Local Scanning

```bash
# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Scan image
grype docker:USERNAME/notes-app:1.0.0

# Fix vulnerabilities
docker build -t USERNAME/notes-app:1.0.0 .
```

## Pulling from Different Networks

### From Docker Host

```bash
docker pull USERNAME/notes-app:1.0.0
```

### From Kubernetes

```yaml
spec:
  containers:
  - name: notes-app
    image: USERNAME/notes-app:1.0.0
    imagePullPolicy: IfNotPresent
```

### With Authentication

If private registry:

```bash
# Create secret
kubectl create secret docker-registry docker-credentials \
  --docker-server=registry.example.com \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD

# Use in deployment
spec:
  containers:
  - name: notes-app
    image: registry.example.com/notes-app:1.0.0
  imagePullSecrets:
  - name: docker-credentials
```

## Cleanup & Maintenance

### Remove Old Images

```bash
# List all versions
docker images USERNAME/notes-app

# Remove specific version
docker rmi USERNAME/notes-app:1.0.0

# Remove all local versions
docker image prune -a --filter "reference=USERNAME/notes-app"
```

### Docker Hub Cleanup

1. Go to https://hub.docker.com
2. Click repository
3. Go to **Tags** tab
4. Delete old/unused versions
5. Keep last 5-10 for rollback

## Monitoring

### View Push History

```bash
# Using docker CLI
docker pull USERNAME/notes-app:latest --dry-run

# Via Docker Hub UI
# Repository → Tags → View push history
```

### Track Image Usage

```bash
# See pull count
# Docker Hub → Repository → Tags → See pull count for each tag

# Local: see image size
docker images USERNAME/notes-app
```

## Best Practices

✅ **DO:**
- Use semantic versioning for tags
- Maintain latest tag
- Keep Dockerfile in version control
- Test images locally before push
- Document image contents
- Scan for vulnerabilities

❌ **DON'T:**
- Use `latest` as development tag
- Push without testing
- Store credentials in images
- Use large base images
- Forget to clean up old images
- Push on every commit (only on releases)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Push fails | Check credentials, verify Docker Hub account active |
| Image not found | Verify image name and tag, check visibility |
| Pull fails locally | `docker login` and verify username/token |
| Authentication error | Regenerate Personal Access Token |
| Image size huge | Use Alpine, optimize Dockerfile, add .dockerignore |

## References

- [Docker Hub Docs](https://docs.docker.com/docker-hub/)
- [Personal Access Tokens](https://docs.docker.com/docker-hub/access-tokens/)
- [Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Image Security](https://docs.docker.com/engine/security/)
