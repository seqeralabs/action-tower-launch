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

debug_log "Starting Tower Action entrypoint"
debug_log "Shell: $(ps -p $$ -o comm=)"
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

# Mask certain variables from Github logs
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

# Check Tower CLI installation
debug_log "Checking Tower CLI installation"
if ! command -v tw >/dev/null 2>&1; then
    error_log "Tower CLI (tw) not found in PATH"
    exit 1
fi

# Show Tower CLI version
debug_log "Tower CLI version: $(tw --version 2>&1 || echo 'Failed to get version')"

# Test API connectivity
API_URL="${TOWER_API_ENDPOINT:-https://api.cloud.seqera.io}"
debug_log "Testing API connectivity to: $API_URL"
if ! curl -f -s "$API_URL/service-info" >> "$LOG_FN" 2>&1; then
    error_log "Failed to connect to Tower API at $API_URL"
    error_log "Check network connectivity and API endpoint"
    echo "API connectivity test failed" >> "$LOG_FN"
else
    debug_log "API connectivity test successful"
fi
echo -e "\n\n------\n\n" >> "$LOG_FN"

# Print the params input to a file
debug_log "Creating parameter files"
echo -e "${PARAMETERS:-}" > params.json
debug_log "params.json size: $(wc -c < params.json) bytes"
if [ -s params.json ]; then
    debug_log "params.json preview: $(head -c 200 params.json)"
fi

# Print the pre-run script to a file
echo -e "${PRE_RUN_SCRIPT:-}" > pre_run.sh
if [ -s pre_run.sh ]; then
    debug_log "pre_run.sh created with $(wc -l < pre_run.sh) lines"
fi

# Print the nextflow config to a file
echo -e "${NEXTFLOW_CONFIG:-}" > nextflow.config
if [ -s nextflow.config ]; then
    debug_log "nextflow.config created with $(wc -l < nextflow.config) lines"
fi

# If wait is set to false then unset wait to disable waiting
if [ "${WAIT:-}" = "false" ]; then 
    unset WAIT
    debug_log "WAIT disabled (set to false)"
elif [ -n "${WAIT:-}" ]; then
    debug_log "WAIT enabled: $WAIT"
fi

# Build Tower CLI command
debug_log "Building Tower CLI command"
TW_CMD="tw -o json -v launch $PIPELINE"

# Add conditional parameters
if [ -s params.json ]; then
    TW_CMD="$TW_CMD --params-file=params.json"
    debug_log "Added --params-file=params.json"
fi

if [ -n "${WORKDIR:-}" ]; then
    TW_CMD="$TW_CMD --work-dir=$WORKDIR"
    debug_log "Added --work-dir=$WORKDIR"
fi

if [ -n "${TOWER_COMPUTE_ENV:-}" ]; then
    TW_CMD="$TW_CMD --compute-env=$TOWER_COMPUTE_ENV"
    debug_log "Added --compute-env=$TOWER_COMPUTE_ENV"
fi

if [ -n "${REVISION:-}" ]; then
    TW_CMD="$TW_CMD --revision=$REVISION"
    debug_log "Added --revision=$REVISION"
fi

if [ -n "${CONFIG_PROFILES:-}" ]; then
    TW_CMD="$TW_CMD --profile=$CONFIG_PROFILES"
    debug_log "Added --profile=$CONFIG_PROFILES"
fi

if [ -n "${RUN_NAME:-}" ]; then
    CLEAN_RUN_NAME="${RUN_NAME/:/_}"
    TW_CMD="$TW_CMD --name=$CLEAN_RUN_NAME"
    debug_log "Added --name=$CLEAN_RUN_NAME"
fi

if [ -s pre_run.sh ]; then
    TW_CMD="$TW_CMD --pre-run=pre_run.sh"
    debug_log "Added --pre-run=pre_run.sh"
fi

if [ -s nextflow.config ]; then
    TW_CMD="$TW_CMD --config=nextflow.config"
    debug_log "Added --config=nextflow.config"
fi

if [ -n "${WAIT:-}" ]; then
    TW_CMD="$TW_CMD --wait=$WAIT"
    debug_log "Added --wait=$WAIT"
fi

debug_log "Final Tower CLI command: $TW_CMD"

# Launch the pipeline
# We capture the JSON as variable $OUT. We encode it as base64 to get around Github secrets filters
debug_log "Executing Tower CLI command"
set +e  # Temporarily disable exit on error to capture the exit code
OUT=$(eval "$TW_CMD" 2>> "$LOG_FN" | base64 -w 0)
TW_EXIT_CODE=$?
set -e  # Re-enable exit on error

debug_log "Tower CLI exit code: $TW_EXIT_CODE"
if [ $TW_EXIT_CODE -ne 0 ]; then
    error_log "Tower CLI command failed with exit code $TW_EXIT_CODE"
    error_log "Command: $TW_CMD"
    error_log "Check the log file for details: $LOG_FN"
    echo "\n\n=== TOWER CLI ERROR OUTPUT ===" >> "$LOG_FN"
    echo "Exit code: $TW_EXIT_CODE" >> "$LOG_FN"
    echo "Command: $TW_CMD" >> "$LOG_FN"
    sanitize_log "$LOG_FN"
    cat "$LOG_FN" >&2  # Output sanitized log to stderr for GitHub Actions
    exit $TW_EXIT_CODE
fi

if [ -z "$OUT" ]; then
    error_log "Tower CLI returned empty output"
    error_log "Command: $TW_CMD"
    error_log "This usually indicates an authentication or connectivity issue"
    echo "\n\n=== EMPTY OUTPUT DEBUG ===" >> "$LOG_FN"
    echo "Command: $TW_CMD" >> "$LOG_FN"
    sanitize_log "$LOG_FN"
    cat "$LOG_FN" >&2
    exit 1
fi

debug_log "Tower CLI output captured (${#OUT} chars base64)"

# Base64 decode and extract specific values for output
debug_log "Decoding and parsing Tower CLI output"
DECODED_OUT=$(echo "$OUT" | base64 -d 2>/dev/null || {
    error_log "Failed to base64 decode Tower CLI output"
    error_log "Raw output length: ${#OUT} characters"
    error_log "This indicates corrupted or invalid Tower CLI response"
    exit 1
})

debug_log "Decoded JSON received (${#DECODED_OUT} characters)"

# Validate JSON and extract values
if ! echo "$DECODED_OUT" | jq -e . >/dev/null 2>&1; then
    error_log "Tower CLI output is not valid JSON"
    error_log "Output length: ${#DECODED_OUT} characters"
    error_log "First 100 chars: ${DECODED_OUT:0:100}"
    exit 1
fi

export workflowId=$(echo "$DECODED_OUT" | jq -r '.workflowId // "null"')
export workflowUrl=$(echo "$DECODED_OUT" | jq -r '.workflowUrl // "null"')
export workspaceId=$(echo "$DECODED_OUT" | jq -r '.workspaceId // "null"')
export workspaceRef=$(echo "$DECODED_OUT" | jq -r '.workspaceRef // "null"')

debug_log "Parsed values - workflowId: $workflowId, workspaceId: $workspaceId"

# Validate required fields
if [ "$workflowId" = "null" ] || [ -z "$workflowId" ]; then
    error_log "Missing or null workflowId in Tower response"
    error_log "This usually indicates the pipeline submission was rejected"
    error_log "Check workspace permissions and pipeline configuration"
    # Only show sanitized response info
    error_log "Response length: ${#DECODED_OUT} characters"
    exit 1
fi

# Hide from the logs for Github Actions. Not crucial but good practice.
echo "::add-mask::$OUT"
echo "::add-mask::$workflowId"
echo "::add-mask::$workflowUrl"
echo "::add-mask::$workspaceId"
echo "::add-mask::$workspaceRef"

# Export to Github variables
echo "workflowId=$workflowId" >> $GITHUB_OUTPUT
echo "workflowUrl=$(echo $workflowUrl | sed 's/"//g')" >> $GITHUB_OUTPUT # We must remove quotes for the URL
echo "workspaceId=$workspaceId" >> $GITHUB_OUTPUT
echo "workspaceRef=$workspaceRef" >> $GITHUB_OUTPUT
echo "json='$(echo $OUT | base64 -d | jq -rc)'"  >> $GITHUB_OUTPUT

# Strip secrets from the log file
sanitize_log() {
    local log_file="$1"
    if [ -n "${TOWER_ACCESS_TOKEN:-}" ] && [ -f "$log_file" ]; then
        # Use awk for safer replacement
        awk -v token="$TOWER_ACCESS_TOKEN" '{gsub(token, "****"); print}' "$log_file" > "${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
    fi
}
sanitize_log "$LOG_FN"

# Create output json file
echo "$DECODED_OUT" > "$LOG_JSON"
debug_log "Created output JSON file: $LOG_JSON"

debug_log "Action completed successfully"
debug_log "Workflow ID: $workflowId"
debug_log "Workflow URL: $workflowUrl"

# Output the sanitized log file for debugging
echo "\n\n=== TOWER ACTION LOG ==="
sanitize_log "$LOG_FN"
cat "$LOG_FN"
