# Phase 6: Deploy - Kubernetes Deployment Guide

## Overview

This phase implements a complete CD (Continuous Deployment) pipeline for the Loan Management System with:
- Kubernetes deployment manifests
- Rolling updates for zero-downtime deployments
- Blue-green deployment strategy
- Auto-scaling based on CPU and memory
- High availability configuration
- Monitoring and alerting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Ingress Controller (NGINX)              │   │
│  │         (LoadBalancer Service on port 80/443)       │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│         ┌─────────────┴──────────────┬────────────────┐     │
│         │                            │                │     │
│  ┌──────▼──────┐            ┌───────▼──────┐   ┌────▼─────┐│
│  │ LoadBalancer│            │   LoadBalancer│   │ LoadBalancer││
│  └──────┬──────┘            └───────┬──────┘   └────┬─────┘│
│         │                           │               │      │
│    ┌────┴────────┬─────────┬────────┴─────┐       │      │
│    │ Pod 1       │ Pod 2   │ Pod 3         │       │      │
│    │(100m/256Mi) │(100m...)│(100m/256Mi)   │       │      │
│    └─────┬───────┴────┬────┴─────────┬─────┘       │      │
│          │            │              │              │      │
│          └────────────┴──────────────┴──────────────┤      │
│                       │                             │      │
│              ┌────────▼─────────┐                   │      │
│              │   MySQL Service  │                   │      │
│              │  (Persistent)    │                   │      │
│              │  (512Mi-1Gi)     │                   │      │
│              │                  │                   │      │
│              └──────────────────┘                   │      │
│                                                      │      │
│  ┌───────────────────────────────────────────────┐  │      │
│  │    Monitoring (Prometheus & Alertmanager)     │  │      │
│  │         ServiceMonitor + PrometheusRules      │  │      │
│  └───────────────────────────────────────────────┘  │      │
│                                                      │      │
└──────────────────────────────────────────────────────┘      │
```

## Resource Requirements

### Application Pods (Loan Management System)

**Per Pod Request:**
- CPU: 100m (0.1 cores)
- Memory: 256Mi

**Per Pod Limits:**
- CPU: 500m (0.5 cores)
- Memory: 512Mi

**Per Pod Calculation:**
- 1 CPU core = 1000m
- 1 GiB RAM = 1024Mi
- Recommended ratio: request:limit = 1:2 for flexibility

**Cluster Sizing Example (3-10 pods):**

| Scenario | Min Pods | Max Pods | Min Resources | Max Resources |
|----------|----------|----------|--------------|--------------|
| Light Load | 3 | 3 | 0.3 CPU / 768Mi | 1.5 CPU / 1.5Gi |
| Moderate Load | 5 | 5 | 0.5 CPU / 1.25Gi | 2.5 CPU / 2.5Gi |
| Heavy Load | 10 | 10 | 1 CPU / 2.5Gi | 5 CPU / 5Gi |

### MySQL Database

**Request:**
- CPU: 250m (0.25 cores)
- Memory: 512Mi

**Limits:**
- CPU: 500m (0.5 cores)
- Memory: 1Gi

**Storage:**
- PersistentVolume: 10Gi (database data)

### Total Cluster Requirements (3 app pods + 1 MySQL)

**Minimum (Requests):**
- CPU: 0.3 + 0.25 = 0.55 cores
- Memory: 768Mi + 512Mi = 1.28Gi

**Maximum (Limits):**
- CPU: 1.5 + 0.5 = 2 cores
- Memory: 1.5Gi + 1Gi = 2.5Gi

**Recommended Cluster Size:**
- 2 worker nodes with 2 CPU and 4Gi RAM each
- Total: 4 CPU and 8Gi RAM available

## Deployment Strategies

### 1. Rolling Updates (deployment-rolling.yaml)

**Features:**
- Zero-downtime deployments
- Gradual replacement of old pods with new versions
- maxSurge: 1 (allows 4 pods during update: 3 old + 1 new)
- maxUnavailable: 0 (no pods taken offline)

**Update Timeline:**
```
Version 1.2.0 (3 pods running)
↓
New version 1.3.0 starts (4 pods: 3 old + 1 new)
↓
Old pod terminates, new pod becomes ready
↓
Repeat until all 3 pods updated
↓
Version 1.3.0 (3 pods running)
```

**When to Use:**
- Regular updates without coordinated testing
- When you need continuous service availability
- Most common production scenario

### 2. Blue-Green Deployment (deployment-blue-green.yaml)

**Features:**
- Two identical environments: blue (production) and green (staging)
- Instant traffic switching with zero downtime
- Easy rollback: just switch service selector back to blue

**Deployment Process:**
```
Step 1: Green (3 pods) running new version 1.3.0 - NOT receiving traffic
Step 2: Run smoke tests and validation on green environment
Step 3: Switch service selector: color: blue → color: green
Step 4: Monitor new version in production
Step 5: If issues: switch back to blue immediately
Step 6: Update blue environment for next release
```

**When to Use:**
- Major version upgrades
- When you need instant rollback capability
- Before critical features
- When you have strict SLA requirements

**Comparison:**

| Aspect | Rolling | Blue-Green |
|--------|---------|-----------|
| Downtime | 0 | 0 |
| Resource Usage | Lower (maxSurge: 1) | Higher (2x replicas) |
| Rollback Speed | Slow (reverse rolling) | Instant (flip selector) |
| Testing Window | No | Yes (before switch) |
| Complexity | Low | Medium |

## Auto-Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

**Triggers:**
- CPU: Scale up when > 70% utilization
- Memory: Scale up when > 80% utilization

**Scaling Behavior:**
- Minimum replicas: 3 (for HA)
- Maximum replicas: 10 (prevent runaway scaling)
- Scale-up: 100% increase per 30 seconds
- Scale-down: 50% decrease per 60 seconds (slower to prevent flapping)

**Example Scaling Scenario:**

```
Normal load: 3 pods @ 50% CPU
↓
Traffic spike: Pods reach 85% CPU
↓
HPA trigger: 70% threshold exceeded
↓
Scale to 5 pods (100% increase)
↓
New pods start and join service
↓
Load distributed across 5 pods @ 51% CPU per pod
↓
New traffic spike: 6 pods needed
↓
Scale to 7 pods (100% increase)
↓
Eventually reach 10 pod max limit
↓
CPU stays at 85% with all 10 pods
↓
(Possibly need larger pods or optimize code)
```

### Pod Disruption Budget (PDB)

Ensures minimum availability during:
- Node maintenance
- Cluster upgrades
- Voluntary evictions

**Config:** minAvailable: 2 (keep at least 2 pods running)

## Health Checks

### Liveness Probe
**Purpose:** Detect and restart unhealthy pods
**Endpoint:** GET /health
**Config:**
- Initial delay: 30 seconds (let app startup)
- Check interval: 10 seconds
- Failure threshold: 3 failures = restart

### Readiness Probe
**Purpose:** Determine if pod is ready to receive traffic
**Endpoint:** GET /health
**Config:**
- Initial delay: 10 seconds (quicker than liveness)
- Check interval: 5 seconds
- Failure threshold: 2 failures = remove from service

## Networking

### Service Types

1. **ClusterIP (MySQL Service)**
   - Internal communication only
   - DNS: mysql-service.loan-management.svc.cluster.local:3306

2. **LoadBalancer (Application Service)**
   - External IP for public access
   - Routes external traffic to port 80 → pod port 3000

### Network Policy

Restricts traffic to/from pods:
- **Ingress:** Only from ingress controller or loan-management namespace
- **Egress:** Only to MySQL, DNS services, and external APIs

## Deployment Steps

### 1. Prerequisites
```bash
# Install kubectl
# Configure kubeconfig for your cluster
# Verify cluster access
kubectl cluster-info
```

### 2. Deploy Namespace and Configuration
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMaps
kubectl apply -f k8s/configmap.yaml
```

### 3. Deploy Database
```bash
# Deploy MySQL with persistent storage
kubectl apply -f k8s/mysql.yaml

# Verify MySQL is running
kubectl get pods -n loan-management
kubectl logs -n loan-management deployment/mysql
```

### 4. Deploy Application (Choose one)

**Option A: Rolling Updates (Recommended for continuous deployment)**
```bash
kubectl apply -f k8s/deployment-rolling.yaml

# Watch rollout
kubectl rollout status deployment/loan-management-app -n loan-management

# View pods
kubectl get pods -n loan-management
```

**Option B: Blue-Green (Recommended for major releases)**
```bash
# Deploy both blue and green environments
kubectl apply -f k8s/deployment-blue-green.yaml

# Verify both environments
kubectl get deployments -n loan-management

# Test green environment
kubectl port-forward -n loan-management svc/loan-management-blue-green 8080:80

# When ready, update service selector to green
kubectl patch service loan-management-blue-green -n loan-management \
  -p '{"spec":{"selector":{"color":"green"}}}'
```

### 5. Configure Auto-Scaling
```bash
kubectl apply -f k8s/autoscaling.yaml

# View HPA status
kubectl get hpa -n loan-management
kubectl top pods -n loan-management
```

### 6. Setup Ingress (Optional)
```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx ingress-nginx/ingress-nginx

# Install cert-manager for SSL
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --set installCRDs=true

# Deploy ingress
kubectl apply -f k8s/ingress.yaml
```

### 7. Setup Monitoring (Optional)
```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Deploy monitoring rules
kubectl apply -f k8s/monitoring.yaml
```

## Verification Commands

```bash
# Check all resources in namespace
kubectl get all -n loan-management

# Check pod status
kubectl get pods -n loan-management -o wide

# View pod logs
kubectl logs -n loan-management deployment/loan-management-app

# Check resource usage
kubectl top pods -n loan-management
kubectl top nodes

# Get service endpoints
kubectl get endpoints -n loan-management

# Test service connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  wget -O- http://loan-management-service.loan-management.svc.cluster.local

# Check HPA status
kubectl get hpa -n loan-management
kubectl describe hpa loan-management-hpa -n loan-management

# View rollout history
kubectl rollout history deployment/loan-management-app -n loan-management
kubectl rollout history deployment/loan-management-app -n loan-management --revision=2
```

## Common Operations

### 1. Update Image (Rolling Update)
```bash
kubectl set image deployment/loan-management-app \
  loan-management=khalifa7/loan-management-system:1.4.0 \
  -n loan-management

# Wait for rollout
kubectl rollout status deployment/loan-management-app -n loan-management
```

### 2. Rollback to Previous Version
```bash
# View history
kubectl rollout history deployment/loan-management-app -n loan-management

# Rollback to previous
kubectl rollout undo deployment/loan-management-app -n loan-management

# Rollback to specific revision
kubectl rollout undo deployment/loan-management-app --to-revision=2 -n loan-management
```

### 3. Scale Manually
```bash
# Scale to 5 pods
kubectl scale deployment/loan-management-app --replicas=5 -n loan-management
```

### 4. Blue-Green Cutover
```bash
# Switch traffic to green
kubectl patch service loan-management-blue-green \
  -n loan-management \
  -p '{"spec":{"selector":{"color":"green"}}}'

# Verify traffic switched
kubectl get service loan-management-blue-green -n loan-management -o jsonpath='{.spec.selector.color}'

# To rollback
kubectl patch service loan-management-blue-green \
  -n loan-management \
  -p '{"spec":{"selector":{"color":"blue"}}}'
```

### 5. View Metrics
```bash
# Pod metrics
kubectl top pods -n loan-management

# Node metrics
kubectl top nodes

# Detailed resource requests/limits
kubectl describe nodes
```

## Troubleshooting

### Pod in CrashLoopBackOff
```bash
# Check logs
kubectl logs -n loan-management <pod-name>

# Check events
kubectl describe pod -n loan-management <pod-name>

# Check readiness
kubectl get pods -n loan-management -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'
```

### Service Not Accessible
```bash
# Check endpoints
kubectl get endpoints -n loan-management

# Check service selector
kubectl get service -n loan-management -o yaml

# Test DNS
kubectl exec -it -n loan-management <pod-name> -- nslookup loan-management-service

# Check network policies
kubectl get networkpolicies -n loan-management
```

### HPA Not Scaling
```bash
# Check HPA status
kubectl describe hpa loan-management-hpa -n loan-management

# Check metrics availability
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1/namespaces/loan-management/pods/*/cpu_usage

# View HPA events
kubectl get events -n loan-management --sort-by='.lastTimestamp'
```

## Security Best Practices

### Implemented
- ✅ Non-root user (runAsUser: 1001)
- ✅ No privilege escalation
- ✅ Read-only root filesystem (where possible)
- ✅ Dropped all capabilities
- ✅ Resource requests/limits
- ✅ Pod Disruption Budget
- ✅ Network Policies
- ✅ Health checks (automatic recovery)

### Additional Recommendations
- [ ] Use RBAC for pod access control
- [ ] Enable Pod Security Policies
- [ ] Use container image scanning
- [ ] Implement network segmentation
- [ ] Use private container registry with authentication
- [ ] Rotate secrets regularly
- [ ] Enable audit logging
- [ ] Use sealed secrets for sensitive data

## Cost Optimization

**Current Setup Cost Estimate:**

| Component | Count | CPU | Memory | Est. Cost/Month |
|-----------|-------|-----|--------|-----------------|
| Worker Nodes (2 CPUs, 4GB) | 1 | 2 | 4Gi | ~$50 |
| Load Balancer | 1 | - | - | ~$20 |
| Storage (10Gi) | 1 | - | - | ~$5 |
| **Total** | - | - | - | **~$75** |

**Optimization Tips:**
1. Use Reserved Instances (30% discount)
2. Use spot instances for non-critical workloads
3. Implement vertical pod autoscaling
4. Right-size resources based on actual metrics
5. Use namespace resource quotas
6. Implement pod eviction policies

## Next Steps

1. **Local Testing:** Use Minikube or Kind to test manifests
2. **Deploy to Dev:** Apply manifests to development cluster
3. **Load Testing:** Test auto-scaling behavior
4. **Setup Monitoring:** Configure Prometheus and alerting
5. **Documentation:** Document cluster-specific configurations
6. **CI/CD Integration:** Integrate with GitHub Actions workflow
7. **Disaster Recovery:** Plan backup and recovery strategy
8. **Regular Updates:** Plan Kubernetes cluster upgrades

## Files Included

- `namespace.yaml` - Kubernetes namespace definition
- `configmap.yaml` - Application and database configuration
- `mysql.yaml` - MySQL deployment with persistent storage
- `deployment-rolling.yaml` - Rolling update strategy
- `deployment-blue-green.yaml` - Blue-green deployment strategy
- `autoscaling.yaml` - HPA and PDB configuration
- `ingress.yaml` - Ingress and SSL configuration
- `monitoring.yaml` - Prometheus monitoring rules
- `PHASE_6_DEPLOY.md` - This file

## Support and Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Helm Charts](https://helm.sh/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
