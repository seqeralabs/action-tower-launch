#!/bin/sh
set -euo pipefail

# Mask certain variables from Github logs
echo "::add-mask::$TOWER_WORKSPACE_ID"
echo "::add-mask::$TOWER_API_ENDPOINT"
echo "::add-mask::$TOWER_ACCESS_TOKEN"
echo "::add-mask::$TOWER_COMPUTE_ENV"

# Use `tee` to print just stdout to the console but save stdout + stderr to a file
LOG_FN="tower_action_"$(date +'%Y_%m_%d-%H_%M')"_.log"
LOG_JSON="tower_action_"$(uuidgen)".json"

# Manual curl of service-info
curl https://api.tower.nf/service-info >> $LOG_FN
echo -e "\n\n------\n\n" >> $LOG_FN

# Health check - print basic settings
tw -v info \
    2>> $LOG_FN | tee -a $LOG_FN

# Print the params input to a file
echo -e "$PARAMETERS" > params.json

# Print the pre-run script to a file
echo -e "$PRE_RUN_SCRIPT" > pre_run.sh

# Print the nextflow config  to a file
echo -e "$NEXTFLOW_CONFIG" > nextflow.config

# If wait is set to false then unset wait to disable waiting
if [ "$WAIT" = false ]; then unset WAIT; fi

# Launch the pipeline
export OUT=$(tw -o json -v \
    launch \
    $PIPELINE \
    --params-file=params.json \
    ${WORKDIR:+"--work-dir=$WORKDIR"} \
    ${TOWER_COMPUTE_ENV:+"--compute-env=$TOWER_COMPUTE_ENV"} \
    ${REVISION:+"--revision=$REVISION"} \
    ${CONFIG_PROFILES:+"--profile=$CONFIG_PROFILES"} \
    ${RUN_NAME:+"--name=${RUN_NAME/:/_}"} \
    ${PRE_RUN_SCRIPT:+"--pre-run=pre_run.sh"} \
    ${NEXTFLOW_CONFIG:+"--config=nextflow.config"} \
    ${WAIT:+"--wait=$WAIT"} \
    2>> $LOG_FN | tee -a $LOG_FN)


export workflowId=$(echo $OUT | jq '.workflowId')
export workflowUrl=$(echo $OUT | jq '.workflowUrl')
export workspaceId=$(echo $OUT | jq '.workspaceId')
export workspaceRef=$(echo $OUT | jq '.workspaceRef')

echo "::add-mask::$OUT"
echo "::add-mask::$workflowId"
echo "::add-mask::$workflowUrl"
echo "::add-mask::$workspaceId"
echo "::add-mask::$workspaceRef"

echo "workflowId=$workflowId" >> $GITHUB_OUTPUT
echo "workflowUrl=$workflowUrl" >> $GITHUB_OUTPUT
echo "workspaceId=$workspaceId" >> $GITHUB_OUTPUT
echo "workspaceRef=$workspaceRef" >> $GITHUB_OUTPUT
echo "json=$OUT"  >> $GITHUB_OUTPUT



# Strip secrets from the log file
sed -i "s/$TOWER_ACCESS_TOKEN/xxxxxx/" $LOG_FN

# Create output json file
echo $OUT > $LOG_JSON