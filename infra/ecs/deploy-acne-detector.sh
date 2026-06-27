#!/usr/bin/env bash
#
# One-shot provisioner for the acne-detector ECS service.
# Auto-discovers ALL config (VPC subnets, security groups, execution role,
# log config, Cloud Map namespace) from the existing ml-worker + ml-inference
# services — so there is nothing to hardcode or configure by hand.
#
# Idempotent: creates the service + Cloud Map entry only if missing; otherwise
# forces a new deployment. Also injects ACNE_DETECTOR_SERVICE_URL into the
# ml-worker task definition (only re-registers if the value changed).
#
# Requirements: awscli v2 + jq, AWS creds with ECS/ServiceDiscovery permissions.
#
# Usage:
#   ./infra/ecs/deploy-acne-detector.sh
#
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
CLUSTER="${ECS_CLUSTER:-skinfit-cluster}"
REGISTRY="${ECR_REGISTRY:-417326870953.dkr.ecr.ap-south-1.amazonaws.com}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
WORKER_SERVICE="${ECS_WORKER_SERVICE:-skinfit-ml-worker-service-o26zxlzb}"
INFERENCE_SERVICE="${ECS_INFERENCE_SERVICE:-}"   # optional; used to find Cloud Map namespace

ACNE_FAMILY="skinfit-acne-detector"
ACNE_SERVICE="skinfit-acne-detector"
ACNE_CONTAINER="acne-detector"
ACNE_DNS_NAME="acne-detector"
NAMESPACE_NAME="skinfit.local"
ACNE_PORT=8000
IMAGE="${REGISTRY}/skinfit-acne-detector:${IMAGE_TAG}"
ACNE_URL="http://${ACNE_DNS_NAME}.${NAMESPACE_NAME}:${ACNE_PORT}"

echo "==> Deploying acne-detector ($IMAGE) to cluster $CLUSTER ($REGION)"

# ── 1. Discover network config + roles from the ml-worker service ────────────
echo "==> Reading ml-worker service config"
WORKER_SVC_JSON="$(aws ecs describe-services \
  --cluster "$CLUSTER" --services "$WORKER_SERVICE" --region "$REGION")"

NETWORK_CONFIG="$(echo "$WORKER_SVC_JSON" | jq -c '.services[0].networkConfiguration')"
if [[ "$NETWORK_CONFIG" == "null" || -z "$NETWORK_CONFIG" ]]; then
  echo "ERROR: could not read networkConfiguration from $WORKER_SERVICE" >&2
  exit 1
fi

# The acne service reuses the worker's subnets + security group. For the worker
# to reach acne on :8000 within that shared SG, add a self-referencing inbound
# rule (idempotent — ignore "already exists").
WORKER_SG="$(echo "$NETWORK_CONFIG" \
  | jq -r '.awsvpcConfiguration.securityGroups[0]')"
if [[ -n "$WORKER_SG" && "$WORKER_SG" != "null" ]]; then
  echo "==> Ensuring SG $WORKER_SG allows inbound TCP ${ACNE_PORT} from itself"
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$WORKER_SG" \
    --protocol tcp --port "$ACNE_PORT" \
    --source-group "$WORKER_SG" >/dev/null 2>&1 \
    || echo "    (rule already present)"
fi

WORKER_TD_ARN="$(echo "$WORKER_SVC_JSON" | jq -r '.services[0].taskDefinition')"
WORKER_TD_JSON="$(aws ecs describe-task-definition \
  --task-definition "$WORKER_TD_ARN" --region "$REGION")"

EXEC_ROLE="$(echo "$WORKER_TD_JSON" | jq -r '.taskDefinition.executionRoleArn // empty')"
TASK_ROLE="$(echo "$WORKER_TD_JSON" | jq -r '.taskDefinition.taskRoleArn // empty')"

# Reuse the worker's CloudWatch log group/region; swap the stream prefix.
LOG_GROUP="$(echo "$WORKER_TD_JSON" \
  | jq -r '.taskDefinition.containerDefinitions[0].logConfiguration.options["awslogs-group"] // "/ecs/skinfit-acne-detector"')"

echo "    exec role:  $EXEC_ROLE"
echo "    log group:  $LOG_GROUP"

# ── 2. Find / create the Cloud Map service for discovery ─────────────────────
echo "==> Resolving Cloud Map namespace '$NAMESPACE_NAME'"
NAMESPACE_ID="$(aws servicediscovery list-namespaces --region "$REGION" \
  --query "Namespaces[?Name=='${NAMESPACE_NAME}'].Id | [0]" --output text)"
if [[ "$NAMESPACE_ID" == "None" || -z "$NAMESPACE_ID" ]]; then
  echo "ERROR: Cloud Map namespace '$NAMESPACE_NAME' not found. Create it (DNS private, VPC=skinfit-vpc)." >&2
  exit 1
fi

SD_ARN="$(aws servicediscovery list-services --region "$REGION" \
  --query "Services[?Name=='${ACNE_DNS_NAME}'].Arn | [0]" --output text)"
if [[ "$SD_ARN" == "None" || -z "$SD_ARN" ]]; then
  echo "==> Creating Cloud Map service '$ACNE_DNS_NAME'"
  SD_ARN="$(aws servicediscovery create-service --region "$REGION" \
    --name "$ACNE_DNS_NAME" \
    --namespace-id "$NAMESPACE_ID" \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=10}]" \
    --health-check-custom-config FailureThreshold=1 \
    --query 'Service.Arn' --output text)"
fi
echo "    service discovery arn: $SD_ARN"

# ── 3. Register the acne-detector task definition ────────────────────────────
echo "==> Registering task definition '$ACNE_FAMILY'"
TASK_DEF=$(cat <<JSON
{
  "family": "${ACNE_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "${EXEC_ROLE}",
  $( [[ -n "$TASK_ROLE" ]] && echo "\"taskRoleArn\": \"${TASK_ROLE}\"," )
  "containerDefinitions": [
    {
      "name": "${ACNE_CONTAINER}",
      "image": "${IMAGE}",
      "essential": true,
      "portMappings": [{ "containerPort": ${ACNE_PORT}, "protocol": "tcp" }],
      "environment": [
        { "name": "CONF", "value": "0.2" },
        { "name": "GRID", "value": "4,4" },
        { "name": "IMGSZ", "value": "896" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP%/*}/skinfit-acne-detector",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "acne-detector",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
JSON
)
echo "$TASK_DEF" > /tmp/acne-td.json
ACNE_TD_ARN="$(aws ecs register-task-definition --region "$REGION" \
  --cli-input-json file:///tmp/acne-td.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)"
echo "    task def: $ACNE_TD_ARN"

# ── 4. Create or update the ECS service ──────────────────────────────────────
EXISTING="$(aws ecs describe-services --cluster "$CLUSTER" \
  --services "$ACNE_SERVICE" --region "$REGION" \
  --query "services[?status=='ACTIVE'].serviceName | [0]" --output text)"

if [[ "$EXISTING" == "None" || -z "$EXISTING" ]]; then
  echo "==> Creating service '$ACNE_SERVICE'"
  aws ecs create-service --region "$REGION" \
    --cluster "$CLUSTER" \
    --service-name "$ACNE_SERVICE" \
    --task-definition "$ACNE_TD_ARN" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "$NETWORK_CONFIG" \
    --service-registries "registryArn=${SD_ARN}" >/dev/null
else
  echo "==> Updating service '$ACNE_SERVICE'"
  aws ecs update-service --region "$REGION" \
    --cluster "$CLUSTER" \
    --service "$ACNE_SERVICE" \
    --task-definition "$ACNE_TD_ARN" \
    --force-new-deployment >/dev/null
fi

# ── 5. Ensure ml-worker knows the acne-detector URL (idempotent) ─────────────
CURRENT_URL="$(echo "$WORKER_TD_JSON" \
  | jq -r '.taskDefinition.containerDefinitions[0].environment[]? | select(.name=="ACNE_DETECTOR_SERVICE_URL") | .value')"
if [[ "$CURRENT_URL" != "$ACNE_URL" ]]; then
  echo "==> Injecting ACNE_DETECTOR_SERVICE_URL=$ACNE_URL into ml-worker task def"
  NEW_WORKER_TD="$(echo "$WORKER_TD_JSON" | jq \
    --arg url "$ACNE_URL" '
    .taskDefinition
    | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
          .compatibilities, .registeredAt, .registeredBy)
    | .containerDefinitions[0].environment =
        ((.containerDefinitions[0].environment // [])
         | map(select(.name != "ACNE_DETECTOR_SERVICE_URL"))
         + [{ "name": "ACNE_DETECTOR_SERVICE_URL", "value": $url }])')"
  echo "$NEW_WORKER_TD" > /tmp/worker-td.json
  NEW_WORKER_TD_ARN="$(aws ecs register-task-definition --region "$REGION" \
    --cli-input-json file:///tmp/worker-td.json \
    --query 'taskDefinition.taskDefinitionArn' --output text)"
  aws ecs update-service --region "$REGION" \
    --cluster "$CLUSTER" --service "$WORKER_SERVICE" \
    --task-definition "$NEW_WORKER_TD_ARN" --force-new-deployment >/dev/null
  echo "    ml-worker updated → $NEW_WORKER_TD_ARN"
else
  echo "==> ml-worker already has ACNE_DETECTOR_SERVICE_URL=$ACNE_URL"
fi

echo "==> Done. Acne detector reachable at $ACNE_URL"
