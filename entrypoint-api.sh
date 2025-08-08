#!/bin/bash
set -euo pipefail

# Function for debug logging
debug_log() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo "[DEBUG] $1" >&2
    fi
}

# Function for error logging
error_log() {
    echo "[ERROR] $1" >&2
}

# Function to safely mask variables (only if they exist and are non-empty)
safe_mask() {
    local var_name="$1"
    local var_value="$2"
    if [ -n "${var_value:-}" ]; then
        echo "::add-mask::$var_value"
        debug_log "Masked $var_name"
    else
        debug_log "Skipped masking empty $var_name"
    fi
}

debug_log "Starting Tower Action API entrypoint"
debug_log "Working directory: $(pwd)"

# Validate required environment variables
validate_required_vars() {
    local missing_vars=()
    [ -z "${TOWER_ACCESS_TOKEN:-}" ] && missing_vars+=("TOWER_ACCESS_TOKEN")
    [ -z "${PIPELINE:-}" ] && missing_vars+=("PIPELINE")
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        error_log "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
}

validate_required_vars

# Mask sensitive variables
safe_mask "TOWER_WORKSPACE_ID" "${TOWER_WORKSPACE_ID:-}"
safe_mask "TOWER_API_ENDPOINT" "${TOWER_API_ENDPOINT:-}"
safe_mask "TOWER_ACCESS_TOKEN" "${TOWER_ACCESS_TOKEN:-}"
safe_mask "TOWER_COMPUTE_ENV" "${TOWER_COMPUTE_ENV:-}"

# Debug environment variables
debug_log "Environment variables:"
debug_log "TOWER_API_ENDPOINT=${TOWER_API_ENDPOINT:-<unset>}"
debug_log "TOWER_WORKSPACE_ID=${TOWER_WORKSPACE_ID:-<unset>}"
debug_log "TOWER_COMPUTE_ENV=${TOWER_COMPUTE_ENV:-<unset>}"
debug_log "PIPELINE=${PIPELINE:-<unset>}"
debug_log "REVISION=${REVISION:-<unset>}"
debug_log "WORKDIR=${WORKDIR:-<unset>}"
debug_log "CONFIG_PROFILES=${CONFIG_PROFILES:-<unset>}"
debug_log "RUN_NAME=${RUN_NAME:-<unset>}"
debug_log "WAIT=${WAIT:-<unset>}"
debug_log "Parameters length: ${#PARAMETERS}"

LOG_FN=tower_action_$(date +'%Y_%m_%d-%H_%M').log
LOG_JSON="tower_action_"$(uuidgen)".json"

debug_log "Log files: $LOG_FN, $LOG_JSON"

# Set API endpoint
API_URL="${TOWER_API_ENDPOINT:-https://api.cloud.seqera.io}"
debug_log "API URL: $API_URL"

# Test API connectivity
debug_log "Testing API connectivity"
if ! curl -f -s -H "Authorization: Bearer $TOWER_ACCESS_TOKEN" "$API_URL/service-info" >> "$LOG_FN" 2>&1; then
    error_log "Failed to connect to Seqera Platform API at $API_URL"
    error_log "Check access token validity and API endpoint"
    echo "API connectivity test failed" >> "$LOG_FN"
    exit 1
else
    debug_log "API connectivity test successful"
fi
echo -e "\n\n------\n\n" >> "$LOG_FN"

# Build the launch request JSON
debug_log "Building launch request"

# Start building the JSON payload
LAUNCH_JSON='{"launch": {"pipeline": "'$PIPELINE'"'

# Add optional parameters
if [ -n "${REVISION:-}" ]; then
    LAUNCH_JSON="$LAUNCH_JSON"', "revision": "'$REVISION'"'
    debug_log "Added revision: $REVISION"
fi

if [ -n "${WORKDIR:-}" ]; then
    LAUNCH_JSON="$LAUNCH_JSON"', "workDir": "'$WORKDIR'"'
    debug_log "Added workDir: $WORKDIR"
fi

if [ -n "${RUN_NAME:-}" ]; then
    CLEAN_RUN_NAME="${RUN_NAME/:/_}"
    LAUNCH_JSON="$LAUNCH_JSON"', "runName": "'$CLEAN_RUN_NAME'"'
    debug_log "Added runName: $CLEAN_RUN_NAME"
fi

if [ -n "${TOWER_COMPUTE_ENV:-}" ]; then
    LAUNCH_JSON="$LAUNCH_JSON"', "computeEnvId": "'$TOWER_COMPUTE_ENV'"'
    debug_log "Added computeEnvId: $TOWER_COMPUTE_ENV"
fi

if [ -n "${CONFIG_PROFILES:-}" ]; then
    LAUNCH_JSON="$LAUNCH_JSON"', "profile": "'$CONFIG_PROFILES'"'
    debug_log "Added profile: $CONFIG_PROFILES"
fi

# Add parameters if provided
if [ -n "${PARAMETERS:-}" ] && [ "$PARAMETERS" != "{}" ]; then
    # Parse and add parameters - assuming PARAMETERS is already JSON
    LAUNCH_JSON="$LAUNCH_JSON"', "params": '$PARAMETERS
    debug_log "Added parameters (${#PARAMETERS} chars)"
fi

# Add Nextflow config if provided
if [ -n "${NEXTFLOW_CONFIG:-}" ]; then
    # Escape and add config
    ESCAPED_CONFIG=$(echo "$NEXTFLOW_CONFIG" | sed 's/"/\\"/g' | tr '\n' ' ')
    LAUNCH_JSON="$LAUNCH_JSON"', "nextflowConfig": "'$ESCAPED_CONFIG'"'
    debug_log "Added nextflow config (${#NEXTFLOW_CONFIG} chars)"
fi

# Add pre-run script if provided
if [ -n "${PRE_RUN_SCRIPT:-}" ]; then
    # Escape and add pre-run script
    ESCAPED_SCRIPT=$(echo "$PRE_RUN_SCRIPT" | sed 's/"/\\"/g' | tr '\n' ' ')
    LAUNCH_JSON="$LAUNCH_JSON"', "preRunScript": "'$ESCAPED_SCRIPT'"'
    debug_log "Added pre-run script (${#PRE_RUN_SCRIPT} chars)"
fi

# Close the JSON
LAUNCH_JSON="$LAUNCH_JSON"'}}'

debug_log "Launch JSON built (${#LAUNCH_JSON} chars)"

# Build the API URL with workspace parameter
API_LAUNCH_URL="$API_URL/workflow/launch"
if [ -n "${TOWER_WORKSPACE_ID:-}" ]; then
    API_LAUNCH_URL="$API_LAUNCH_URL?workspaceId=$TOWER_WORKSPACE_ID"
    debug_log "Added workspace ID to URL: $TOWER_WORKSPACE_ID"
fi

debug_log "Final API URL: $API_LAUNCH_URL"

# Make the API call
debug_log "Making launch API call"
set +e  # Temporarily disable exit on error
HTTP_RESPONSE=$(curl -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $TOWER_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept-Version: 1" \
    -d "$LAUNCH_JSON" \
    "$API_LAUNCH_URL" 2>> "$LOG_FN")
CURL_EXIT_CODE=$?
set -e  # Re-enable exit on error

debug_log "API call completed with curl exit code: $CURL_EXIT_CODE"

# Extract HTTP status and body
HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

debug_log "HTTP Status: $HTTP_STATUS"
debug_log "Response body length: ${#HTTP_BODY} chars"

# Log the response
echo -e "\n\n=== API LAUNCH RESPONSE ===" >> "$LOG_FN"
echo "HTTP Status: $HTTP_STATUS" >> "$LOG_FN"
echo "Response Body: $HTTP_BODY" >> "$LOG_FN"

# Check for errors
if [ $CURL_EXIT_CODE -ne 0 ]; then
    error_log "API call failed with curl exit code $CURL_EXIT_CODE"
    error_log "Check network connectivity and API endpoint"
    cat "$LOG_FN" >&2
    exit $CURL_EXIT_CODE
fi

if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    error_log "API call failed with HTTP status $HTTP_STATUS"
    error_log "Response: $HTTP_BODY"
    
    # Try to extract error message from response
    if command -v jq >/dev/null 2>&1 && echo "$HTTP_BODY" | jq -e . >/dev/null 2>&1; then
        ERROR_MSG=$(echo "$HTTP_BODY" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "Unknown error")
        error_log "API Error: $ERROR_MSG"
    fi
    
    cat "$LOG_FN" >&2
    exit 1
fi

# Validate and parse the response
if ! command -v jq >/dev/null 2>&1; then
    error_log "jq is required for JSON parsing but not found"
    exit 1
fi

if ! echo "$HTTP_BODY" | jq -e . >/dev/null 2>&1; then
    error_log "API response is not valid JSON"
    error_log "Response: $HTTP_BODY"
    exit 1
fi

# Extract workflow information
WORKFLOW_ID=$(echo "$HTTP_BODY" | jq -r '.workflowId // empty')
if [ -z "$WORKFLOW_ID" ]; then
    error_log "No workflowId in API response"
    error_log "This usually indicates the pipeline submission was rejected"
    error_log "Check pipeline name, workspace permissions, and parameters"
    exit 1
fi

# Build workflow URL (this may vary based on your setup)
WORKFLOW_URL="$API_URL/../workflow/$WORKFLOW_ID"
if [ -n "${TOWER_WORKSPACE_ID:-}" ]; then
    WORKFLOW_URL="$API_URL/../orgs/-/workspaces/$TOWER_WORKSPACE_ID/watch/$WORKFLOW_ID"
fi

# Extract additional information
WORKSPACE_ID="${TOWER_WORKSPACE_ID:-$(echo "$HTTP_BODY" | jq -r '.workspaceId // empty')}"
WORKSPACE_REF="[$(echo "$HTTP_BODY" | jq -r '.workspaceRef // "personal")]"

debug_log "Parsed response:"
debug_log "Workflow ID: $WORKFLOW_ID"
debug_log "Workspace ID: $WORKSPACE_ID"

# Mask the values for GitHub Actions
safe_mask "WORKFLOW_ID" "$WORKFLOW_ID"
safe_mask "WORKFLOW_URL" "$WORKFLOW_URL"
safe_mask "WORKSPACE_ID" "$WORKSPACE_ID"

# Export to GitHub outputs
echo "workflowId=$WORKFLOW_ID" >> "$GITHUB_OUTPUT"
echo "workflowUrl=$WORKFLOW_URL" >> "$GITHUB_OUTPUT"
echo "workspaceId=$WORKSPACE_ID" >> "$GITHUB_OUTPUT"
echo "workspaceRef=$WORKSPACE_REF" >> "$GITHUB_OUTPUT"

# Create compact JSON output
COMPACT_JSON=$(echo "$HTTP_BODY" | jq -c '{workflowId, workflowUrl: "'$WORKFLOW_URL'", workspaceId: "'$WORKSPACE_ID'", workspaceRef: "'$WORKSPACE_REF'"}' 2>/dev/null || echo '{}')
echo "json='$COMPACT_JSON'" >> "$GITHUB_OUTPUT"

# Save the response to JSON file
echo "$HTTP_BODY" > "$LOG_JSON"
debug_log "Created output JSON file: $LOG_JSON"

# Handle wait functionality if enabled
if [ "${WAIT:-false}" = "true" ] && [ "$WAIT" != "false" ]; then
    debug_log "Wait mode enabled - monitoring workflow status"
    # TODO: Implement workflow status polling using API
    error_log "Wait functionality not yet implemented for API mode"
fi

debug_log "Action completed successfully"
debug_log "Workflow ID: $WORKFLOW_ID"
debug_log "Workflow URL: $WORKFLOW_URL"

# Output the log file for debugging
echo -e "\n\n=== TOWER ACTION LOG ==="
cat "$LOG_FN"