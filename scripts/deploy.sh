#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Industrial Edge Anomaly Sentinel — Quick Deploy
# Supports: K3s, MicroK8s, Minikube, K8s
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/your-org}"
TAG="${TAG:-latest}"
NAMESPACE_SENTINEL="sentinel"
NAMESPACE_INDUSTRIAL="industrial"
NAMESPACE_MONITORING="monitoring"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[SENTINEL]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Detect kubectl ─────────────────────────────────────────────────────────────
if command -v kubectl &>/dev/null; then
    KUBECTL="kubectl"
elif command -v k3s &>/dev/null; then
    KUBECTL="k3s kubectl"
elif command -v microk8s &>/dev/null; then
    KUBECTL="microk8s kubectl"
else
    err "No kubectl found. Install kubectl, k3s, or microk8s first."
fi

log "Using kubectl: $KUBECTL"

# ── Check cluster connectivity ─────────────────────────────────────────────────
$KUBECTL cluster-info &>/dev/null || err "Cannot connect to Kubernetes cluster"
ok "Cluster reachable"

# ── Detect storage class ──────────────────────────────────────────────────────
STORAGE_CLASS=$($KUBECTL get storageclass -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "standard")
log "Using storage class: $STORAGE_CLASS"
sed -i "s/storageClassName: local-path/storageClassName: $STORAGE_CLASS/g" k8s/manifests/industrial-workloads.yaml 2>/dev/null || true

# ── Namespaces ─────────────────────────────────────────────────────────────────
log "Creating namespaces..."
for ns in $NAMESPACE_SENTINEL $NAMESPACE_INDUSTRIAL $NAMESPACE_MONITORING; do
    $KUBECTL create namespace $ns --dry-run=client -o yaml | $KUBECTL apply -f -
done

# ── Monitoring stack ──────────────────────────────────────────────────────────
log "Deploying monitoring stack..."
# kube-state-metrics
$KUBECTL apply -f https://github.com/kubernetes/kube-state-metrics/releases/download/v2.13.0/standard/ \
    --namespace monitoring 2>/dev/null || warn "kube-state-metrics: check manually"

# node-exporter as DaemonSet
$KUBECTL apply -f - <<'EOF'
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.8.2
          args:
            - --path.procfs=/host/proc
            - --path.sysfs=/host/sys
            - --path.rootfs=/host
          ports:
            - containerPort: 9100
              hostPort: 9100
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
          volumeMounts:
            - name: proc
              mountPath: /host/proc
              readOnly: true
            - name: sys
              mountPath: /host/sys
              readOnly: true
            - name: root
              mountPath: /host
              readOnly: true
      volumes:
        - name: proc
          hostPath: { path: /proc }
        - name: sys
          hostPath: { path: /sys }
        - name: root
          hostPath: { path: / }
      tolerations:
        - operator: Exists
EOF

$KUBECTL apply -f k8s/monitoring/prometheus.yaml
ok "Monitoring stack deployed"

# ── RBAC ──────────────────────────────────────────────────────────────────────
log "Applying RBAC..."
$KUBECTL apply -f k8s/rbac/rbac.yaml
ok "RBAC configured"

# ── Industrial workloads ──────────────────────────────────────────────────────
log "Deploying industrial workloads..."
$KUBECTL apply -f k8s/manifests/industrial-workloads.yaml
ok "Industrial pods deployed"

# ── Sentinel ──────────────────────────────────────────────────────────────────
log "Building and deploying Sentinel..."

# Build backend
if command -v docker &>/dev/null; then
    log "Building backend image..."
    docker build -f Dockerfile.backend -t $REGISTRY/sentinel-backend:$TAG .
    
    log "Building dashboard image..."
    cd dashboard
    docker build -t $REGISTRY/sentinel-dashboard:$TAG .
    cd ..
    
    # Push if registry set
    if [[ "$REGISTRY" != "ghcr.io/your-org" ]]; then
        docker push $REGISTRY/sentinel-backend:$TAG
        docker push $REGISTRY/sentinel-dashboard:$TAG
        ok "Images pushed to registry"
    else
        warn "Update REGISTRY env var to push to your registry"
        warn "For local testing with minikube: run 'eval \$(minikube docker-env)' first"
    fi
else
    warn "Docker not found — skipping image build. Update image refs in k8s manifests."
fi

# Update image refs
sed -i "s|ghcr.io/your-org|$REGISTRY|g" k8s/manifests/sentinel-deployment.yaml 2>/dev/null || true

$KUBECTL apply -f k8s/manifests/sentinel-deployment.yaml
ok "Sentinel deployed"

# ── Wait for pods ──────────────────────────────────────────────────────────────
log "Waiting for pods to become ready..."
$KUBECTL wait --for=condition=Available deployment/ml-inference -n industrial --timeout=120s 2>/dev/null || true
$KUBECTL wait --for=condition=Available deployment/sensor-ingestion -n industrial --timeout=120s 2>/dev/null || true
$KUBECTL wait --for=condition=Available deployment/alerting -n industrial --timeout=120s 2>/dev/null || true

# ── Access info ────────────────────────────────────────────────────────────────
NODE_IP=$($KUBECTL get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ⚡ Industrial Edge Anomaly Sentinel — DEPLOYED${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard:   ${BLUE}http://$NODE_IP:30080${NC}"
echo -e "  API:         ${BLUE}http://$NODE_IP:30800${NC}"
echo -e "  API Docs:    ${BLUE}http://$NODE_IP:30800/docs${NC}"
echo -e "  Prometheus:  Check NodePort for prometheus service"
echo ""
echo -e "  Quick health check:"
echo -e "  ${YELLOW}curl http://$NODE_IP:30800/health${NC}"
echo ""
echo -e "  Stream live insights:"
echo -e "  ${YELLOW}curl -N http://$NODE_IP:30800/api/v1/stream/insights${NC}"
echo ""
log "Deployment complete. Check pod status with: $KUBECTL get pods -A"
