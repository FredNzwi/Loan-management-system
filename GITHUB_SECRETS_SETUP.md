# GitHub Secrets Setup Guide

## For Release Pipeline to Work

You need to configure 2 required secrets (and 1 optional).

### Step-by-Step Setup

#### 1. DOCKER_USERNAME

**What it is:** Your Docker Hub username

**How to get it:**
1. Go to https://hub.docker.com
2. Create account if needed
3. Note your username (visible in top right)

**How to set it in GitHub:**
1. Go to your GitHub repository
2. Click: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DOCKER_USERNAME`
5. Value: Your Docker Hub username
6. Click **Add secret**

#### 2. DOCKER_PASSWORD

**What it is:** Your Docker Hub password

**How to set it in GitHub:**
1. Log in to https://hub.docker.com
2. Go to **Account Settings** (top right)
3. Get your Docker Hub password (the one you use to log in)
4. Go to your GitHub repository
5. Click: **Settings** → **Secrets and variables** → **Actions**
6. Click **New repository secret**
7. Name: `DOCKER_PASSWORD`
8. Value: Your Docker Hub password
9. Click **Add secret**

**Note:** Make sure you're using your actual Docker Hub login password, not your email address.

#### 3. SLACK_WEBHOOK_URL (Optional)

**What it is:** Webhook URL for Slack notifications

**How to create it:**
1. Go to your Slack workspace
2. Visit: https://api.slack.com/apps
3. Click **Create New App** → **From scratch**
4. Name: `GitHub Releases`
5. Pick your workspace
6. In left menu, click **Incoming Webhooks**
7. Toggle **Activate Incoming Webhooks** to ON
8. Click **Add New Webhook to Workspace**
9. Select channel (e.g., #releases or #devops)
10. Click **Authorize**
11. **Copy the Webhook URL**

**How to set it in GitHub:**
1. Go to your GitHub repository
2. Click: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SLACK_WEBHOOK_URL`
5. Value: Paste the webhook URL
6. Click **Add secret**

### Using GitHub CLI (Alternative)

If you have GitHub CLI installed:

```bash
# Authenticate with GitHub
gh auth login

# Set secrets from command line
gh secret set DOCKER_USERNAME --body "your-docker-username"
gh secret set DOCKER_PASSWORD --body "your-docker-token"
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
```

### Verify Secrets Are Set

Go to: **Settings** → **Secrets and variables** → **Actions**

You should see:
- ✅ `DOCKER_USERNAME`
- ✅ `DOCKER_PASSWORD`
- ✅ `SLACK_WEBHOOK_URL` (if configured)

### Test Docker Hub Access

```bash
# Test login locally
docker login

# Enter username and token when prompted
# Should succeed with: "Login Succeeded"

# Test push
docker build -t USERNAME/test-image:latest .
docker push USERNAME/test-image:latest

# Clean up
docker rmi USERNAME/test-image:latest
```

### Troubleshooting Secrets

**Secret not working?**
1. Check the secret is set in GitHub
2. Verify spelling matches exactly (case-sensitive)
3. Regenerate Docker token if old one
4. Test Docker Hub credentials locally first

**Can't push to Docker Hub?**
1. Check DOCKER_USERNAME is correct
2. Generate new DOCKER_PASSWORD token
3. Verify token has push permissions
4. Check Docker Hub account status

## Security Best Practices

✅ **DO:**
- Use Personal Access Tokens (not passwords)
- Limit token permissions (Read & Write only)
- Regenerate tokens periodically
- Different secrets for different services

❌ **DON'T:**
- Share secrets anywhere
- Commit secrets to git
- Use your Docker Hub password directly
- Use one secret across multiple services

## When to Regenerate Secrets

- Quarterly security review
- Team member leaves
- Token compromised
- Environment changed

## Testing the Release Workflow

After setting up secrets:

```bash
# 1. Prepare a test release
./scripts/release.sh prepare patch

# 2. Push changes
git push origin main

# 3. Create tag
./scripts/release.sh tag

# 4. Publish
./scripts/release.sh publish

# 5. Monitor in GitHub Actions
# https://github.com/YOUR_REPO/actions

# 6. Check Docker Hub
# https://hub.docker.com/repository/docker/USERNAME/notes-app
```

## FAQs

**Q: Can I use my Docker Hub password?**
A: Not recommended. Use Personal Access Token instead for better security.

**Q: What if I forget the token?**
A: You can't recover it. Generate a new one and update GitHub secret.

**Q: Can someone see my secrets?**
A: Only in GitHub Actions logs (masked by default). Not visible in UI.

**Q: Do I need SLACK_WEBHOOK_URL to use releases?**
A: No, it's optional. Release works without it.

**Q: How often should I rotate secrets?**
A: Every 90 days or after team changes is recommended.

## Additional Security

Enable branch protection:
1. **Settings** → **Branches**
2. Add rule for `main`
3. Require status checks before merge
4. Include release workflow in checks

This prevents accidental releases to production.
