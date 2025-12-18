#!/bin/bash

#################################
# Blue-Green Deployment Manager
# Manages blue-green deployments with traffic switching
#################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="loan-management"
SERVICE_NAME="loan-management-blue-green"

#################################
# Functions
#################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

get_current_color() {
    kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.color}'
}

switch_traffic() {
    local target_color=$1
    
    if [ -z "$target_color" ]; then
        log_error "Target color not specified (blue or green)"
        exit 1
    fi
    
    if [ "$target_color" != "blue" ] && [ "$target_color" != "green" ]; then
        log_error "Invalid color: $target_color (must be blue or green)"
        exit 1
    fi
    
    log_info "Switching traffic to $target_color environment..."
    
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"color\":\"$target_color\"}}}"
    
    log_success "Traffic switched to $target_color"
}

deploy_version() {
    local color=$1
    local image=$2
    
    if [ -z "$color" ] || [ -z "$image" ]; then
        log_error "Usage: deploy_version [blue|green] [image:tag]"
        exit 1
    fi
    
    log_info "Deploying $image to $color environment..."
    
    kubectl set image deployment/"loan-management-$color" \
        loan-management="$image" \
        -n "$NAMESPACE"
    
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/"loan-management-$color" \
        -n "$NAMESPACE" --timeout=600s
    
    log_success "$color environment updated with $image"
}

test_environment() {
    local color=$1
    
    if [ -z "$color" ]; then
        log_error "Color not specified (blue or green)"
        exit 1
    fi
    
    log_info "Running health checks on $color environment..."
    
    # Get a pod from the deployment
    local pod=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=loan-management,color=$color" \
        -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod" ]; then
        log_error "No pods found for $color deployment"
        exit 1
    fi
    
    log_info "Testing pod: $pod"
    
    # Port forward and test
    kubectl port-forward -n "$NAMESPACE" "pod/$pod" 8080:3000 &
    local pf_pid=$!
    
    sleep 2
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
    
    kill $pf_pid 2>/dev/null || true
    
    if [ "$response" = "200" ]; then
        log_success "$color environment health check passed"
        return 0
    else
        log_error "$color environment health check failed (HTTP $response)"
        return 1
    fi
}

show_status() {
    log_info "Blue-Green Deployment Status"
    log_info "============================"
    
    local current=$(get_current_color)
    log_info "Current active environment: ${GREEN}${current}${NC}"
    
    log_info "\nBlue deployment:"
    kubectl get deployment loan-management-blue -n "$NAMESPACE" -o wide || true
    
    log_info "\nGreen deployment:"
    kubectl get deployment loan-management-green -n "$NAMESPACE" -o wide || true
    
    log_info "\nBlue pods:"
    kubectl get pods -n "$NAMESPACE" -l "app=loan-management,color=blue" -o wide || true
    
    log_info "\nGreen pods:"
    kubectl get pods -n "$NAMESPACE" -l "app=loan-management,color=green" -o wide || true
}

show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [ARGS]

Commands:
  status                   Show current deployment status
  current                  Show current active color (blue/green)
  switch [color]          Switch traffic to blue or green
  deploy [color] [image]  Deploy image to blue or green
  test [color]            Run health checks on blue or green
  upgrade [image]         Upgrade non-active environment and switch

Examples:
  # Show status
  $0 status

  # Switch traffic to green
  $0 switch green

  # Deploy new version to inactive environment
  $0 deploy green khalifa7/loan-management-system:1.4.0

  # Test the green environment
  $0 test green

  # Complete upgrade: deploy to inactive, test, and switch
  $0 upgrade khalifa7/loan-management-system:1.4.0
EOF
}

upgrade_complete() {
    local new_image=$1
    
    if [ -z "$new_image" ]; then
        log_error "Image not specified"
        exit 1
    fi
    
    local current=$(get_current_color)
    local target="green"
    
    if [ "$current" = "green" ]; then
        target="blue"
    fi
    
    log_info "Starting complete upgrade process..."
    log_info "Current: $current"
    log_info "Target: $target"
    log_info "Image: $new_image"
    
    # Deploy to inactive
    deploy_version "$target" "$new_image" || {
        log_error "Deployment failed"
        exit 1
    }
    
    # Test
    test_environment "$target" || {
        log_error "Health checks failed"
        exit 1
    }
    
    # Switch
    log_info "All checks passed, switching traffic..."
    switch_traffic "$target"
    
    log_success "Upgrade completed successfully!"
    show_status
}

#################################
# Main
#################################

case "${1:-status}" in
    status)
        show_status
        ;;
    current)
        get_current_color
        ;;
    switch)
        switch_traffic "$2"
        show_status
        ;;
    deploy)
        deploy_version "$2" "$3"
        ;;
    test)
        test_environment "$2"
        ;;
    upgrade)
        upgrade_complete "$2"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
