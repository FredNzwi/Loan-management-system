#!/bin/bash

# Release Management Script
# This script helps manage versioning, tagging, and releases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_JSON="package.json"
VERSION_FILE="VERSION"

# Functions
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

get_current_version() {
    grep '"version"' "$PACKAGE_JSON" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/'
}

validate_version_format() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
        print_error "Invalid version format: $version"
        print_info "Expected format: X.Y.Z or X.Y.Z-prerelease"
        return 1
    fi
    return 0
}

# Check if we have git
if ! command -v git &> /dev/null; then
    print_error "git is not installed"
    exit 1
fi

print_header "Release Management Tool"

# Parse command
COMMAND=${1:-help}

case "$COMMAND" in
    current)
        print_header "Current Version"
        CURRENT=$(get_current_version)
        echo "Version: $CURRENT"
        
        # Check git tags
        echo ""
        echo "Git Tags:"
        git tag -l "v*" --sort=-version:refname | head -10 || print_info "No version tags found"
        ;;
    
    bump)
        BUMP_TYPE=${2:-patch}
        print_header "Bump Version - $BUMP_TYPE"
        
        if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
            print_error "Invalid bump type: $BUMP_TYPE"
            print_info "Use: major, minor, or patch"
            exit 1
        fi
        
        CURRENT=$(get_current_version)
        print_info "Current version: $CURRENT"
        
        # Parse version parts
        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
        PATCH=${PATCH%%[-]*}  # Remove pre-release suffix
        
        case "$BUMP_TYPE" in
            major)
                MAJOR=$((MAJOR + 1))
                MINOR=0
                PATCH=0
                ;;
            minor)
                MINOR=$((MINOR + 1))
                PATCH=0
                ;;
            patch)
                PATCH=$((PATCH + 1))
                ;;
        esac
        
        NEW_VERSION="$MAJOR.$MINOR.$PATCH"
        
        if validate_version_format "$NEW_VERSION"; then
            print_success "New version: $NEW_VERSION"
            
            # Update package.json
            sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
            print_success "Updated package.json"
            
            # Create VERSION file
            echo "$NEW_VERSION" > "$VERSION_FILE"
            print_success "Created VERSION file"
            
            # Git operations
            git add "$PACKAGE_JSON" "$VERSION_FILE" 2>/dev/null || true
            git commit -m "chore: bump version to $NEW_VERSION" || print_info "No changes to commit"
            
            echo ""
            echo "Next steps:"
            echo "1. Review changes: git log -1"
            echo "2. Push: git push origin main"
            echo "3. Create tag: ./scripts/release.sh tag"
        fi
        ;;
    
    tag)
        print_header "Create Git Tag"
        
        VERSION=$(get_current_version)
        print_info "Current version: $VERSION"
        
        if validate_version_format "$VERSION"; then
            TAG="v$VERSION"
            
            # Check if tag already exists
            if git rev-parse "$TAG" >/dev/null 2>&1; then
                print_error "Tag $TAG already exists"
                exit 1
            fi
            
            # Create tag
            git tag -a "$TAG" -m "Release version $VERSION"
            print_success "Created tag: $TAG"
            
            echo ""
            echo "Next steps:"
            echo "1. Push tag: git push origin $TAG"
            echo "2. This will trigger the release workflow"
        fi
        ;;
    
    list)
        print_header "Available Tags"
        git tag -l "v*" --sort=-version:refname || print_info "No version tags found"
        ;;
    
    info)
        print_header "Release Information"
        
        VERSION=$(get_current_version)
        COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "N/A")
        BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A")
        
        echo "Version: $VERSION"
        echo "Branch: $BRANCH"
        echo "Commit: $COMMIT"
        echo "Repository: $(git config --get remote.origin.url 2>/dev/null || echo 'N/A')"
        echo ""
        
        # Check git status
        if [[ -n $(git status -s) ]]; then
            print_error "Uncommitted changes detected"
            git status -s
        else
            print_success "Working directory clean"
        fi
        ;;
    
    prepare)
        BUMP_TYPE=${2:-patch}
        print_header "Prepare Release - $BUMP_TYPE"
        
        # Check git status
        if [[ -n $(git status -s) ]]; then
            print_error "Please commit all changes before preparing release"
            git status -s
            exit 1
        fi
        
        print_success "Working directory clean"
        
        # Bump version
        print_info "Bumping version..."
        $0 bump "$BUMP_TYPE"
        
        echo ""
        print_success "Release preparation complete!"
        echo "Please review and push the changes"
        ;;
    
    publish)
        print_header "Publish Release"
        
        VERSION=$(get_current_version)
        TAG="v$VERSION"
        
        print_info "Publishing version: $VERSION"
        
        if git rev-parse "$TAG" >/dev/null 2>&1; then
            print_info "Tag already exists, pushing..."
            git push origin "$TAG"
            print_success "Release published!"
        else
            print_error "Tag $TAG does not exist"
            print_info "Run './scripts/release.sh tag' first"
            exit 1
        fi
        ;;
    
    help|--help|-h|"")
        cat << 'EOF'

Release Management Script
========================

Usage: ./scripts/release.sh [COMMAND] [OPTIONS]

Commands:

  current              Show current version and recent tags
  
  bump [TYPE]          Bump version (default: patch)
                       Types: major, minor, patch
                       Example: ./scripts/release.sh bump minor
  
  tag                  Create git tag for current version
                       Must be run after bump
  
  list                 List all release tags
  
  info                 Show current release information
  
  prepare [TYPE]       Complete release preparation (bump + info)
                       Types: major, minor, patch
                       Example: ./scripts/release.sh prepare minor
  
  publish              Push tag to trigger release workflow
                       Must be run after creating tag
  
  help                 Show this help message

Workflow Example:

  1. Prepare release (bumps version):
     ./scripts/release.sh prepare minor
  
  2. Review changes:
     git log -1 --stat
  
  3. Create and publish tag:
     ./scripts/release.sh tag
     ./scripts/release.sh publish
  
  4. Monitor release:
     - GitHub Actions will automatically build Docker image
     - Check: https://github.com/YOUR_REPO/actions

Requirements:

  - Git repository configured
  - package.json with version field
  - GitHub secrets configured:
    * DOCKER_USERNAME
    * DOCKER_PASSWORD
    * SLACK_WEBHOOK_URL (optional)

Docker Image Naming:

  Version v1.2.3 will create Docker images:
  - USERNAME/notes-app:1.2.3
  - USERNAME/notes-app:latest

EOF
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        $0 help
        exit 1
        ;;
esac
