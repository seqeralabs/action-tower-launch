#!/bin/sh
set -euo pipefail

# Mask certain variables from Github logs
echo "::add-mask::$TOWER_WORKSPACE_ID"
echo "::add-mask::$TOWER_API_ENDPOINT"
echo "::add-mask::$TOWER_ACCESS_TOKEN"
echo "::add-mask::$TOWER_COMPUTE_ENV"

LOG_FN=tower_action_$(date +'%Y_%m_%d-%H_%M').log
LOG_JSON="tower_action_"$(uuidgen)".json"

# Manual curl of service-info
curl https://api.cloud.seqera.io/service-info >> $LOG_FN
echo -e "\n\n------\n\n" >> $LOG_FN

# Print the params input to a file
echo -e "$PARAMETERS" > params.json

# Print the pre-run script to a file
echo -e "$PRE_RUN_SCRIPT" > pre_run.sh

# Print the nextflow config  to a file
echo -e "$NEXTFLOW_CONFIG" > nextflow.config

# If wait is set to false then unset wait to disable waiting
if [ "$WAIT" = false ]; then unset WAIT; fi

# Launch the pipeline
# We use capture the JSON as variable $OUT. We encode it as base64 to get around Github secrets filters but we still mask it anyway to make sure the details don't leak.
OUT=$(tw -o json -v \
    launch \
    $PIPELINE \
    ${PARAMETERS:+"--params-file=params.json"} \
    ${WORKDIR:+"--work-dir=$WORKDIR"} \
    ${TOWER_COMPUTE_ENV:+"--compute-env=$TOWER_COMPUTE_ENV"} \
    ${REVISION:+"--revision=$REVISION"} \
    ${CONFIG_PROFILES:+"--profile=$CONFIG_PROFILES"} \
    ${RUN_NAME:+"--name=${RUN_NAME/:/_}"} \
    ${PRE_RUN_SCRIPT:+"--pre-run=pre_run.sh"} \
    ${NEXTFLOW_CONFIG:+"--config=nextflow.config"} \
    ${WAIT:+"--wait=$WAIT"} \
    2>> $LOG_FN | base64 -w 0)

# Base64 decode and extract specific value for output
export workflowId=$(echo $OUT | base64 -d | jq -r '.workflowId')
export workflowUrl=$(echo $OUT | base64 -d | jq -r '.workflowUrl')
export workspaceId=$(echo $OUT | base64 -d | jq -r '.workspaceId')
export workspaceRef=$(echo $OUT | base64 -d | jq -r '.workspaceRef')

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
sed -i "s/$TOWER_ACCESS_TOKEN/xxxxxx/" $LOG_FN

# Create output json file
echo $OUT | base64 -d > $LOG_JSON

cat $LOG_FN
