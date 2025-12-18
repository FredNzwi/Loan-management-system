#!/bin/bash

#################################
# Kubernetes Deployment Script
# Automates deployment to Kubernetes cluster
#################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="loan-management"
DEPLOYMENT_NAME="loan-management-app"

# Parse arguments - support both old and new style
COMMAND="${1:-deploy}"
DOCKER_IMAGE="${2:-khalifa7/loan-management-system:1.3.0}"
STRATEGY="${3:-rolling}"  # rolling or blue-green
DRY_RUN="${4:-false}"

# Handle old-style calls where image is first argument
# If first arg looks like an image (contains :), treat it as image not command
if [[ "$COMMAND" =~ : ]]; then
    DOCKER_IMAGE="$COMMAND"
    COMMAND="deploy"
    STRATEGY="${2:-rolling}"
    DRY_RUN="${3:-false}"
fi

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not installed"
        exit 1
    fi
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_namespace() {
    log_info "Creating namespace..."
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace already exists"
    else
        kubectl create namespace "$NAMESPACE"
        log_success "Namespace created"
    fi
}

deploy_mysql() {
    log_info "Deploying MySQL database..."
    
    local file="k8s/mysql.yaml"
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        kubectl apply -f "$file"
        log_success "MySQL deployment started"
    fi
    
    # Wait for MySQL to be ready
    if [ "$DRY_RUN" != "true" ]; then
        log_info "Waiting for MySQL to be ready..."
        kubectl rollout status deployment/mysql -n "$NAMESPACE" --timeout=300s || {
            log_warning "MySQL rollout timed out, checking status..."
            kubectl get pods -n "$NAMESPACE" | grep mysql
        }
    fi
}

deploy_app_rolling() {
    log_info "Deploying application with rolling update strategy..."
    
    local file="k8s/deployment-rolling.yaml"
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        # Update image in deployment
        sed "s|khalifa7/loan-management-system:[^ ]*|$DOCKER_IMAGE|g" "$file" | \
            kubectl apply -f -
        
        log_success "Rolling update deployment started"
        
        # Wait for rollout
        log_info "Waiting for rollout to complete..."
        kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=600s || {
            log_warning "Rollout timed out, checking status..."
            kubectl get pods -n "$NAMESPACE"
            exit 1
        }
    fi
}

deploy_app_blue_green() {
    log_info "Deploying application with blue-green strategy..."
    
    local file="k8s/deployment-blue-green.yaml"
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        # Update image in both blue and green
        sed "s|khalifa7/loan-management-system:[^ ]*|$DOCKER_IMAGE|g" "$file" | \
            kubectl apply -f -
        
        log_success "Blue-green deployment started"
        
        # Wait for both to be ready
        log_info "Waiting for deployments to be ready..."
        kubectl rollout status deployment/loan-management-blue -n "$NAMESPACE" --timeout=300s || {
            log_warning "Blue deployment timed out"
        }
        kubectl rollout status deployment/loan-management-green -n "$NAMESPACE" --timeout=300s || {
            log_warning "Green deployment timed out"
        }
        
        log_info "Blue-green deployments ready. Use 'kubectl patch service' to switch traffic"
    fi
}

deploy_autoscaling() {
    log_info "Deploying auto-scaling configuration..."
    
    local file="k8s/autoscaling.yaml"
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        kubectl apply -f "$file"
        log_success "Auto-scaling configured"
    fi
}

deploy_monitoring() {
    log_info "Deploying monitoring configuration..."
    
    local file="k8s/monitoring.yaml"
    if [ ! -f "$file" ]; then
        log_warning "Monitoring file not found: $file (skipping)"
        return
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        kubectl apply -f "$file" 2>/dev/null || {
            log_warning "Prometheus CRDs not installed, skipping monitoring"
        }
    fi
}

deploy_ingress() {
    log_info "Deploying ingress configuration..."
    
    local file="k8s/ingress.yaml"
    if [ ! -f "$file" ]; then
        log_warning "Ingress file not found: $file (skipping)"
        return
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        kubectl apply -f "$file" --namespace="$NAMESPACE" --dry-run=client -o yaml
    else
        kubectl apply -f "$file" 2>/dev/null || {
            log_warning "NGINX or cert-manager not installed, skipping ingress"
        }
    fi
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    log_info "Namespace status:"
    kubectl get namespace "$NAMESPACE"
    
    log_info "\nDeployments:"
    kubectl get deployments -n "$NAMESPACE"
    
    log_info "\nPods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    
    log_info "\nServices:"
    kubectl get services -n "$NAMESPACE" -o wide
    
    log_info "\nResource usage:"
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || \
        log_warning "Metrics not available (install metrics-server)"
}

rollback_deployment() {
    log_info "Rolling back deployment..."
    
    kubectl rollout undo deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"
    kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=300s
    
    log_success "Rollback completed"
}

cleanup() {
    log_info "Cleaning up resources..."
    
    kubectl delete all --all -n "$NAMESPACE" 2>/dev/null || true
    kubectl delete pvc --all -n "$NAMESPACE" 2>/dev/null || true
    kubectl delete namespace "$NAMESPACE" 2>/dev/null || true
    
    log_success "Cleanup completed"
}

show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [IMAGE] [STRATEGY] [DRY_RUN]
   or: $0 [IMAGE] [STRATEGY] [DRY_RUN]  (backward compatible)

Commands:
  deploy     Deploy application (default if IMAGE provided)
  rollback   Rollback to previous version
  cleanup    Remove all resources

Arguments:
  IMAGE      Docker image to deploy (default: khalifa7/loan-management-system:1.3.0)
             Can be first argument for backward compatibility
  STRATEGY   Deployment strategy: 'rolling' or 'blue-green' (default: rolling)
  DRY_RUN    Dry run mode: 'true' or 'false' (default: false)

Examples:
  # Deploy with defaults
  $0

  # Deploy specific version (backward compatible)
  $0 khalifa7/loan-management-system:1.4.0 rolling

  # Deploy with command syntax
  $0 deploy khalifa7/loan-management-system:1.4.0 rolling

  # Dry run to preview changes
  $0 khalifa7/loan-management-system:1.4.0 rolling true

  # Rollback to previous version
  $0 rollback

  # Cleanup resources
  $0 cleanup
EOF
}

#################################
# Main
#################################

case "${COMMAND}" in
    deploy)
        check_prerequisites
        create_namespace
        kubectl apply -f k8s/configmap.yaml || true
        deploy_mysql
        
        if [ "$STRATEGY" = "blue-green" ]; then
            deploy_app_blue_green
        else
            deploy_app_rolling
        fi
        
        deploy_autoscaling
        deploy_monitoring
        deploy_ingress
        verify_deployment
        
        log_success "Deployment completed successfully!"
        log_info "Next steps:"
        log_info "  1. Verify all pods are running: kubectl get pods -n $NAMESPACE"
        log_info "  2. Check logs: kubectl logs -n $NAMESPACE -l app=loan-management"
        log_info "  3. Get service URL: kubectl get service -n $NAMESPACE"
        ;;
    rollback)
        log_info "Rolling back to previous version..."
        rollback_deployment
        ;;
    cleanup)
        log_warning "This will delete all resources in namespace $NAMESPACE"
        read -p "Are you sure? (yes/no) " -n 3 -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            cleanup
        fi
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
