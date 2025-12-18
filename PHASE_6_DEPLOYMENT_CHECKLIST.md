# Phase 6: Deploy - Implementation Checklist

## Pre-Deployment Preparation

### Cluster Setup
- [ ] Kubernetes cluster created (1.20+)
- [ ] 2+ worker nodes with 2 CPU + 4Gi RAM each
- [ ] kubectl installed and configured
- [ ] kubeconfig file accessible
- [ ] Cluster version verified: `kubectl version`
- [ ] Cluster access confirmed: `kubectl cluster-info`

### Docker Registry
- [ ] Docker Hub account created
- [ ] Login credentials available
- [ ] Repository created: `khalifa7/loan-management-system`
- [ ] Docker image built locally (v1.3.0 or latest)
- [ ] Image pushed to Docker Hub
- [ ] Image pull tested: `docker pull khalifa7/loan-management-system:1.3.0`

### Prerequisites in Cluster
- [ ] NGINX Ingress Controller installed (optional but recommended)
- [ ] metrics-server installed (required for HPA)
- [ ] cert-manager installed (optional, for SSL)
- [ ] Prometheus Operator installed (optional, for monitoring)

**Check with:**
```bash
kubectl get deployments -n ingress-nginx
kubectl get deployment metrics-server -n kube-system
kubectl get customresourcedefinitions | grep cert-manager
kubectl get customresourcedefinitions | grep prometheus
```

---

## Deployment Steps

### Step 1: Prepare Environment
- [ ] Clone/pull latest code
- [ ] Verify k8s manifest files exist (8 files in k8s/)
- [ ] Verify deployment scripts exist (deploy.sh, blue-green.sh)
- [ ] Scripts are executable: `ls -la scripts/`
- [ ] Dry-run test: `./scripts/deploy.sh khalifa7/loan-management-system:1.3.0 rolling true`

### Step 2: Deploy Kubernetes Manifests

#### Create Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```
- [ ] Namespace created: `kubectl get namespace loan-management`
- [ ] Namespace is active: `kubectl get ns | grep loan-management`

#### Deploy Configuration
```bash
kubectl apply -f k8s/configmap.yaml
```
- [ ] ConfigMap created: `kubectl get configmap -n loan-management`
- [ ] App config present: `kubectl get configmap app-config -n loan-management -o yaml`
- [ ] Database config present: `kubectl get configmap mysql-config -n loan-management -o yaml`

#### Deploy Database
```bash
./scripts/deploy.sh  # This deploys MySQL as part of full deployment
# OR manually:
kubectl apply -f k8s/mysql.yaml
```
- [ ] MySQL deployment created: `kubectl get deployment -n loan-management | grep mysql`
- [ ] MySQL pod running: `kubectl get pods -n loan-management | grep mysql`
- [ ] MySQL service created: `kubectl get svc -n loan-management | grep mysql`
- [ ] MySQL is ready: `kubectl rollout status deployment/mysql -n loan-management`

#### Deploy Application

**Choose One Strategy:**

**Option A: Rolling Updates (Recommended for regular deployments)**
```bash
./scripts/deploy.sh khalifa7/loan-management-system:1.3.0 rolling
```
- [ ] Deployment created: `kubectl get deployment -n loan-management | grep loan-management-app`
- [ ] Pods starting: `kubectl get pods -n loan-management -l app=loan-management`
- [ ] Rollout in progress: `kubectl rollout status deployment/loan-management-app -n loan-management`
- [ ] All pods running: 3 pods with Ready status
- [ ] Service created: `kubectl get svc -n loan-management | grep loan-management-service`

**Option B: Blue-Green (Recommended for major releases)**
```bash
./scripts/deploy.sh khalifa7/loan-management-system:1.3.0 blue-green
```
- [ ] Blue deployment created: `kubectl get deployment -n loan-management | grep blue`
- [ ] Green deployment created: `kubectl get deployment -n loan-management | grep green`
- [ ] Both deployments ready: 3 pods each
- [ ] Service selector active: `kubectl get service -n loan-management | grep blue-green`

#### Deploy Auto-Scaling
```bash
kubectl apply -f k8s/autoscaling.yaml
```
- [ ] HPA created: `kubectl get hpa -n loan-management`
- [ ] PDB created: `kubectl get pdb -n loan-management`
- [ ] Network Policy created: `kubectl get networkpolicies -n loan-management`

#### Deploy Monitoring (Optional)
```bash
kubectl apply -f k8s/monitoring.yaml
```
- [ ] ServiceMonitor created: `kubectl get servicemonitor -n loan-management`
- [ ] PrometheusRules created: `kubectl get prometheusrules -n loan-management`
- [ ] (Requires Prometheus Operator installed)

#### Deploy Ingress (Optional)
```bash
kubectl apply -f k8s/ingress.yaml
```
- [ ] Ingress created: `kubectl get ingress -n loan-management`
- [ ] TLS configured: `kubectl get certificate -n loan-management`
- [ ] (Requires NGINX Ingress Controller and cert-manager)

### Step 3: Verify Deployment

#### Pod Status
```bash
kubectl get pods -n loan-management -o wide
```
- [ ] All pods showing "Running"
- [ ] All pods showing "1/1" in READY column
- [ ] Each pod has an assigned node
- [ ] Each pod has an internal IP
- [ ] No pending pods

#### Pod Details
```bash
kubectl describe pods -n loan-management
```
- [ ] No error events in events section
- [ ] Liveness probe showing successful checks
- [ ] Readiness probe showing successful checks
- [ ] Resource requests/limits set correctly
- [ ] Volume mounts present

#### Service Connectivity
```bash
kubectl get svc -n loan-management -o wide
```
- [ ] loan-management-service has CLUSTER-IP
- [ ] loan-management-service has EXTERNAL-IP (or Pending for internal only)
- [ ] mysql-service has CLUSTER-IP
- [ ] All services have endpoints listed

#### Endpoint Status
```bash
kubectl get endpoints -n loan-management
```
- [ ] loan-management-service has multiple IP addresses (3 for rolling, 6 for blue-green)
- [ ] mysql-service has 1 IP address
- [ ] No endpoints show as "none"

#### Health Checks
```bash
# Port forward to test
kubectl port-forward -n loan-management svc/loan-management-service 8080:80 &
sleep 2

# Test health endpoint
curl http://localhost:8080/health

# Should return HTTP 200 with health status
```
- [ ] HTTP 200 response
- [ ] Health status shows "healthy" or similar
- [ ] Response time < 100ms

#### Database Connectivity
```bash
# Get MySQL pod
POD=$(kubectl get pod -n loan-management -l app=mysql -o jsonpath='{.items[0].metadata.name}')

# Test MySQL
kubectl exec -it -n loan-management $POD -- mysql -u root -p$(kubectl get configmap mysql-config -n loan-management -o jsonpath='{.data.MYSQL_ROOT_PASSWORD}') -e "SELECT 1;"
```
- [ ] MySQL is responding
- [ ] Query returns without errors
- [ ] Connection from app pod successful

#### Resource Usage
```bash
kubectl top pods -n loan-management
kubectl top nodes
```
- [ ] Pods showing CPU/Memory usage
- [ ] No pods exceeding resource limits
- [ ] Node resources not exhausted
- [ ] Headroom available for scaling

---

## Post-Deployment Configuration

### Update GitHub Secrets (if using CI/CD)
- [ ] DOCKER_USERNAME set: `khalifa7` (or your username)
- [ ] DOCKER_PASSWORD set: (Docker Hub password)
- [ ] KUBE_CONFIG set: (base64-encoded kubeconfig, optional)
- [ ] SLACK_WEBHOOK_URL set: (optional, for notifications)

### Configure Ingress (if applicable)
- [ ] Update hostname in ingress.yaml
- [ ] Update email in cert-manager config
- [ ] Point DNS to LoadBalancer IP
- [ ] Test HTTPS access

### Setup Monitoring (if applicable)
- [ ] Prometheus scraping loan-management targets
- [ ] Alerts configured and tested
- [ ] Dashboards created
- [ ] Slack integration tested

---

## Testing & Validation

### Functional Tests

#### Application Access
```bash
kubectl get svc -n loan-management
# Get EXTERNAL-IP or use port-forward
kubectl port-forward -n loan-management svc/loan-management-service 8080:80
# Browse to http://localhost:8080
```
- [ ] Application loads
- [ ] API endpoints respond
- [ ] Database queries work
- [ ] No error logs

#### Health Check Endpoints
```bash
curl http://service-ip:port/health
```
- [ ] /health endpoint responds
- [ ] Returns 200 status
- [ ] Includes health details

#### Scalability Test
```bash
# Get current replicas
kubectl get deployment/loan-management-app -n loan-management -o jsonpath='{.spec.replicas}'

# Manual scale test
kubectl scale deployment/loan-management-app --replicas=5 -n loan-management

# Wait for new pods
kubectl get pods -n loan-management -l app=loan-management
```
- [ ] Scales up to 5 pods
- [ ] All new pods become ready
- [ ] Service distributes traffic
- [ ] No errors in logs

```bash
# Scale back down
kubectl scale deployment/loan-management-app --replicas=3 -n loan-management
```
- [ ] Scales down cleanly
- [ ] Extra pods terminate
- [ ] Service still healthy

#### Load Testing
```bash
# Install Apache Bench (if not present)
sudo apt-get install apache2-utils

# Run load test (1000 requests, 10 concurrent)
ab -n 1000 -c 10 http://service-ip:port/

# Monitor during test
kubectl top pods -n loan-management --watch
```
- [ ] Service handles concurrent requests
- [ ] Response times acceptable
- [ ] No errors or timeouts
- [ ] Pods scale up if needed

### Deployment Strategy Tests

#### Rolling Update Test (if applicable)
```bash
# Start update
kubectl set image deployment/loan-management-app \
  loan-management=khalifa7/loan-management-system:test-tag \
  -n loan-management

# Monitor progress
kubectl rollout status deployment/loan-management-app -n loan-management -w
```
- [ ] Update starts smoothly
- [ ] No service interruption
- [ ] Old pods gradually replaced
- [ ] New pods become ready
- [ ] Service continues working
- [ ] Update completes successfully

#### Rollback Test (if rolling update)
```bash
# Rollback to previous
kubectl rollout undo deployment/loan-management-app -n loan-management

# Verify
kubectl rollout status deployment/loan-management-app -n loan-management
```
- [ ] Rollback successful
- [ ] Previous version running
- [ ] All pods ready
- [ ] Service operational

#### Blue-Green Test (if applicable)
```bash
# Switch to green
./scripts/blue-green.sh switch green

# Verify current
./scripts/blue-green.sh current
```
- [ ] Service selector switched
- [ ] Traffic flows to green
- [ ] Application works
- [ ] Metrics updated

```bash
# Switch back
./scripts/blue-green.sh switch blue
```
- [ ] Rollback instant
- [ ] Traffic back to blue
- [ ] No data loss

### Auto-Scaling Test

#### HPA Trigger Test
```bash
# Check HPA
kubectl get hpa -n loan-management

# Generate CPU load
kubectl run load --image=busybox --restart=Never -n loan-management -- \
  /bin/sh -c "while true; do echo foo; done"

# Monitor HPA
kubectl get hpa -n loan-management --watch

# Check scaling
kubectl get deployment/loan-management-app -n loan-management -w
```
- [ ] HPA detects high CPU
- [ ] Deployment scales up
- [ ] New pods become ready
- [ ] Scale-up completes

```bash
# Stop load
kubectl delete pod load -n loan-management

# Monitor scale-down (takes 5-10 minutes)
kubectl get deployment/loan-management-app -n loan-management --watch
```
- [ ] Load decreases
- [ ] HPA initiates scale-down
- [ ] Pods terminate gracefully
- [ ] Returns to minimum (3) replicas

### Health Check Test

#### Liveness Probe Test
```bash
# Verify liveness probe configured
kubectl describe pod -n loan-management <pod-name> | grep -A 5 "Liveness"

# Manually fail health check (if possible)
# and verify pod restarts
kubectl get pods -n loan-management -l app=loan-management -w
```
- [ ] Liveness probe configured
- [ ] Probe checking /health endpoint
- [ ] Pod restarts on failure
- [ ] Restart count increments

#### Readiness Probe Test
```bash
# Verify readiness probe configured
kubectl describe pod -n loan-management <pod-name> | grep -A 5 "Readiness"

# Service removes unready pods from endpoints
# Manual test: kubectl exec into pod and stop service
```
- [ ] Readiness probe configured
- [ ] Pod shows ready/not-ready status
- [ ] Service removes unready pods
- [ ] Service adds pods back when ready

---

## Operational Validation

### Logging
```bash
# Check logs
kubectl logs -n loan-management -l app=loan-management --tail=50

# Follow logs
kubectl logs -n loan-management -l app=loan-management -f

# Check specific pod
kubectl logs -n loan-management <pod-name>
```
- [ ] Application logs appear
- [ ] No error messages
- [ ] Health checks logged
- [ ] Database queries logged

### Monitoring
```bash
# Check metrics
kubectl top pods -n loan-management
kubectl top nodes

# Describe HPA for metrics
kubectl describe hpa loan-management-hpa -n loan-management
```
- [ ] Metrics available
- [ ] CPU/Memory realistic
- [ ] No data gaps
- [ ] Metrics being collected

### Security
```bash
# Verify non-root user
kubectl exec -it -n loan-management <pod-name> -- id

# Check network policies
kubectl get networkpolicies -n loan-management

# Verify resource limits
kubectl get pods -n loan-management -o json | grep -A 5 "limits"
```
- [ ] Pods running as non-root (uid 1001)
- [ ] Network policies in place
- [ ] Resource limits set
- [ ] RBAC configured (if applicable)

---

## Issue Resolution

### If Pods Don't Start
- [ ] Check pod events: `kubectl describe pod -n loan-management <pod>`
- [ ] Check logs: `kubectl logs -n loan-management <pod> --previous`
- [ ] Verify image exists: `docker pull khalifa7/loan-management-system:1.3.0`
- [ ] Check node resources: `kubectl top nodes`
- [ ] Check PVC binding (for MySQL): `kubectl get pvc -n loan-management`

→ See PHASE_6_DEPLOY.md "Troubleshooting" section

### If Service Not Accessible
- [ ] Check endpoints: `kubectl get endpoints -n loan-management`
- [ ] Check service selector: `kubectl get service -o yaml -n loan-management`
- [ ] Check network policies: `kubectl get networkpolicies -n loan-management`
- [ ] Test DNS: `kubectl run -it --rm debug --image=busybox -- nslookup loan-management-service.loan-management.svc.cluster.local`

### If HPA Not Scaling
- [ ] Install metrics-server: `kubectl get deployment metrics-server -n kube-system`
- [ ] Check metrics: `kubectl top pods -n loan-management`
- [ ] Check HPA status: `kubectl describe hpa -n loan-management`
- [ ] View HPA events: `kubectl get events -n loan-management --sort-by='.lastTimestamp'`

### If Database Connection Fails
- [ ] Check MySQL pod: `kubectl get pods -n loan-management -l app=mysql`
- [ ] Check MySQL logs: `kubectl logs -n loan-management deployment/mysql`
- [ ] Verify PVC: `kubectl get pvc -n loan-management`
- [ ] Check PV: `kubectl get pv`

---

## Sign-Off

### Deployment Complete ✅
- [ ] All pods running and ready
- [ ] Services accessible
- [ ] Health checks passing
- [ ] Database connected
- [ ] Scaling working
- [ ] Logs clean
- [ ] Metrics available
- [ ] No errors in events

### Ready for Production ✅
- [ ] Testing completed
- [ ] Monitoring configured
- [ ] Alerts enabled
- [ ] Backups configured
- [ ] Documentation updated
- [ ] Team trained
- [ ] Runbooks prepared
- [ ] Incident response plan ready

---

## Rollback Plan

### If Issues After Deployment
```bash
# Quick rollback to previous version (if rolling update)
kubectl rollout undo deployment/loan-management-app -n loan-management

# Or switch to blue environment (if blue-green)
./scripts/blue-green.sh switch blue

# Verify
kubectl rollout status deployment/loan-management-app -n loan-management
```

### Full Cleanup (if needed)
```bash
# Remove all resources
./scripts/deploy.sh cleanup

# Verify
kubectl get all -n loan-management
```

---

## Post-Deployment Actions

### Day 1
- [ ] Monitor all metrics
- [ ] Review logs for errors
- [ ] Test user workflows
- [ ] Verify database backups
- [ ] Check alert notifications

### Week 1
- [ ] Collect performance metrics
- [ ] Review resource usage
- [ ] Optimize resource requests/limits
- [ ] Document cluster-specific settings
- [ ] Plan monitoring dashboard

### Month 1
- [ ] Review costs
- [ ] Right-size resources
- [ ] Implement additional automation
- [ ] Plan for multi-region
- [ ] Schedule security audit

---

## References

- Complete Guide: `PHASE_6_DEPLOY.md`
- Quick Reference: `PHASE_6_DEPLOY_QUICK_REF.md`
- Summary: `PHASE_6_DEPLOYMENT_SUMMARY.md`
- Index: `PHASE_6_DEPLOY_INDEX.md`

---

**Deployment Checklist Version 1.0**
**Last Updated: 2025-12-09**
