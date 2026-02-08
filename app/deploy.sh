#!/bin/bash
# Deploy Meteo OMS AI Assistant workflow to local n8n Docker
set -e

WORKFLOW_FILE="$(dirname "$0")/workflow.json"
CONTAINER="meteo-n8n"
WORKFLOW_ID="sto28rkSpvr7OGke"

echo "Deploying workflow to $CONTAINER..."
docker cp "$WORKFLOW_FILE" "$CONTAINER:/tmp/workflow.json"
docker exec "$CONTAINER" n8n import:workflow --input=/tmp/workflow.json

echo "Activating workflow $WORKFLOW_ID..."
docker exec "$CONTAINER" n8n update:workflow --id="$WORKFLOW_ID" --active=true 2>/dev/null || true

echo "Restarting n8n..."
docker restart "$CONTAINER"

echo "Waiting for n8n to start..."
sleep 15
docker logs "$CONTAINER" --tail 8

echo ""
echo "Done. n8n available at http://localhost:5678"
