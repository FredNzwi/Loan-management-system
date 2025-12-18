# Phase 6: Deploy - Quick Reference

## Quick Start

### Deploy with Rolling Updates (Recommended)
```bash
./scripts/deploy.sh khalifa7/loan-management-system:1.3.0 rolling
```

### Deploy with Blue-Green
```bash
./scripts/deploy.sh khalifa7/loan-management-system:1.3.0 blue-green
```

### Manage Blue-Green Deployment
```bash
# Check status
./scripts/blue-green.sh status

# Switch traffic to green
./scripts/blue-green.sh switch green

# Deploy new version
./scripts/blue-green.sh deploy green khalifa7/loan-management-system:1.4.0

# Test environment
./scripts/blue-green.sh test green

# Complete upgrade (deploy, test, switch)
./scripts/blue-green.sh upgrade khalifa7/loan-management-system:1.4.0
```

## Resource Requirements Summary

### Per Application Pod
| Metric | Request | Limit |
|--------|---------|-------|
| CPU | 100m (0.1 cores) | 500m (0.5 cores) |
| Memory | 256Mi | 512Mi |

### Per MySQL Pod
| Metric | Request | Limit |
|--------|---------|-------|
| CPU | 250m (0.25 cores) | 500m (0.5 cores) |
| Memory | 512Mi | 1Gi |

### Storage
- MySQL PersistentVolume: 10Gi
- Database data partition

### Cluster Minimum (3 app + 1 MySQL)
| Metric | Requests | Limits |
|--------|----------|--------|
| CPU | 0.55 cores | 2 cores |
| Memory | 1.28Gi | 2.5Gi |
| Storage | 10Gi | - |

**Recommended Cluster:** 2 worker nodes with 2 CPU + 4Gi RAM each

## Deployment Strategies

### Rolling Updates
- **Uptime:** Zero-downtime (always serving traffic)
- **Speed:** Gradual (pod by pod)
- **Rollback:** Slow (requires reversing)
- **Testing:** During deployment
- **Use Case:** Regular updates, minor patches

**Configuration:**
```yaml
maxSurge: 1          # Allow 1 extra pod (4 total during update)
maxUnavailable: 0    # Never remove pod without replacement
minReadySeconds: 10  # Wait for pod stability
```

### Blue-Green Deployment
- **Uptime:** Zero-downtime (instant switch)
- **Speed:** Instant traffic switch
- **Rollback:** Instant (flip service selector)
- **Testing:** Before production switch
- **Use Case:** Major releases, critical features

**Process:**
1. Deploy green environment (new version) - no traffic
2. Run tests and validation on green
3. Switch service selector to green
4. Monitor production
5. If needed, instantly switch back to blue

## Auto-Scaling

### Horizontal Pod Autoscaler (HPA)

**Triggers:**
- CPU utilization > 70% → scale up
- Memory utilization > 80% → scale up

**Behavior:**
- Min replicas: 3 (high availability)
- Max replicas: 10 (cost control)
- Scale up: 100% per 30 seconds
- Scale down: 50% per 60 seconds (gradual)

**Example:**
```
3 pods @ 50% CPU
  ↓ [Traffic spike]
3 pods @ 85% CPU (exceeds 70% threshold)
  ↓ [HPA triggers]
5 pods (100% increase) @ ~51% CPU per pod
  ↓ [If more traffic]
7 pods (100% increase) @ ~36% CPU per pod
  ↓ [Continue until max 10 or CPU stabilizes]
```

## Health Checks

### Liveness Probe (Restart if unhealthy)
```
Endpoint: GET /health
Initial Delay: 30 seconds
Check Interval: 10 seconds
Failure Threshold: 3 = restart pod
```

### Readiness Probe (Remove from service if not ready)
```
Endpoint: GET /health
Initial Delay: 10 seconds
Check Interval: 5 seconds
Failure Threshold: 2 = remove from service
```

## Deployment Verification

```bash
# Check all resources
kubectl get all -n loan-management

# Check pod status
kubectl get pods -n loan-management -o wide

# Check resource usage
kubectl top pods -n loan-management
kubectl top nodes

# View pod logs
kubectl logs -n loan-management -l app=loan-management

# Check service endpoints
kubectl get endpoints -n loan-management

# Watch rollout progress
kubectl rollout status deployment/loan-management-app -n loan-management

# Check HPA status
kubectl get hpa -n loan-management
describe hpa loan-management-hpa -n loan-management
```

## Common Operations

### Update Application Version
```bash
# Rolling update
kubectl set image deployment/loan-management-app \
  loan-management=khalifa7/loan-management-system:1.4.0 \
  -n loan-management

# Watch progress
kubectl rollout status deployment/loan-management-app -n loan-management
```

### Rollback to Previous Version
```bash
# Rollback
kubectl rollout undo deployment/loan-management-app -n loan-management

# Check history
kubectl rollout history deployment/loan-management-app -n loan-management

# Rollback to specific revision
kubectl rollout undo deployment/loan-management-app --to-revision=2 -n loan-management
```

### Scale Manually
```bash
# Scale to 5 pods
kubectl scale deployment/loan-management-app --replicas=5 -n loan-management

# Verify
kubectl get pods -n loan-management
```

### Blue-Green Traffic Switch
```bash
# Current active
kubectl get service loan-management-blue-green -n loan-management -o jsonpath='{.spec.selector.color}'

# Switch to green
kubectl patch service loan-management-blue-green -n loan-management \
  -p '{"spec":{"selector":{"color":"green"}}}'

# Verify
kubectl get service loan-management-blue-green -n loan-management -o jsonpath='{.spec.selector.color}'

# Switch back to blue (rollback)
kubectl patch service loan-management-blue-green -n loan-management \
  -p '{"spec":{"selector":{"color":"blue"}}}'
```

## Troubleshooting

### Pod in CrashLoopBackOff
```bash
# View logs
kubectl logs -n loan-management <pod-name> --previous

# Check pod status
kubectl describe pod -n loan-management <pod-name>

# Check liveness probe
kubectl get pod -n loan-management <pod-name> -o yaml | grep -A 10 liveness
```

### Service Not Accessible
```bash
# Check endpoints (should have multiple IPs)
kubectl get endpoints -n loan-management

# Check service selector
kubectl get service -n loan-management -o yaml

# Test DNS resolution
kubectl exec -it -n loan-management <pod-name> -- nslookup loan-management-service

# Port-forward for testing
kubectl port-forward -n loan-management svc/loan-management-service 8080:80
curl http://localhost:8080/health
```

### HPA Not Scaling
```bash
# Check HPA status
kubectl describe hpa loan-management-hpa -n loan-management

# Check metrics availability
kubectl top pods -n loan-management

# View HPA events
kubectl get events -n loan-management --sort-by='.lastTimestamp'

# Note: Requires metrics-server installed
kubectl get deployment metrics-server -n kube-system
```

### Database Connection Failures
```bash
# Check MySQL status
kubectl get pods -n loan-management -l app=mysql

# Check MySQL logs
kubectl logs -n loan-management deployment/mysql

# Test MySQL connectivity
kubectl exec -it -n loan-management <app-pod> -- \
  mysql -h mysql-service -u root -p <password> -e "SELECT 1;"

# Check PVC
kubectl get pvc -n loan-management
```

## Files Included

```
k8s/
├── namespace.yaml              # Kubernetes namespace
├── configmap.yaml              # App and database config
├── mysql.yaml                  # MySQL deployment
├── deployment-rolling.yaml     # Rolling update deployment
├── deployment-blue-green.yaml  # Blue-green deployment
├── autoscaling.yaml            # HPA and PDB
├── ingress.yaml                # Ingress and SSL
└── monitoring.yaml             # Prometheus monitoring

scripts/
├── deploy.sh                   # Main deployment script
└── blue-green.sh              # Blue-green management script

Documentation/
├── PHASE_6_DEPLOY.md          # Comprehensive guide
└── PHASE_6_DEPLOY_QUICK_REF.md # This file
```

## CI/CD Integration

### GitHub Actions
- Automatic Kubernetes deployment on version tags
- Blue-green or rolling update selection
- Artifact generation and release
- Slack notifications

### Trigger Deployment
```bash
# Create version tag to trigger pipeline
git tag v1.4.0
git push origin v1.4.0

# Workflow automatically:
# 1. Builds Docker image
# 2. Pushes to Docker Hub
# 3. Creates GitHub release
# 4. (Optional) Deploys to Kubernetes
```

## Next Steps

1. **Prepare Kubernetes Cluster**
   - [ ] Set up cluster (Minikube, EKS, AKS, GKE, etc.)
   - [ ] Install kubectl
   - [ ] Configure kubeconfig

2. **Install Requirements**
   - [ ] NGINX Ingress Controller (for ingress)
   - [ ] cert-manager (for SSL)
   - [ ] metrics-server (for HPA)
   - [ ] Prometheus (for monitoring)

3. **Deploy Application**
   - [ ] Deploy MySQL
   - [ ] Deploy app (rolling or blue-green)
   - [ ] Configure auto-scaling
   - [ ] Verify health checks

4. **Setup Monitoring**
   - [ ] Install Prometheus
   - [ ] Configure alerts
   - [ ] Setup dashboards

5. **Test Deployment**
   - [ ] Test rolling update
   - [ ] Test blue-green switch
   - [ ] Test auto-scaling
   - [ ] Test rollback

## Support Resources

- [Kubernetes Docs](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Helm Charts](https://helm.sh/)
- [Kustomize](https://kustomize.io/)
