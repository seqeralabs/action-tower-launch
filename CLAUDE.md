# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `action-tower-launch`, a GitHub Action that launches Nextflow workflows using Seqera Tower (now Seqera Platform). It's a Docker-based action that uses the Tower CLI to submit pipeline runs.

## Architecture

### Core Components

- **`action.yml`**: GitHub Action metadata defining inputs, outputs, and Docker configuration
- **`entrypoint.sh`**: Main shell script executed in the Docker container that handles Tower CLI operations
- **`Dockerfile`**: Container definition that installs Tower CLI and sets up the execution environment

### Key Flow

1. GitHub Action receives inputs (access tokens, pipeline config, etc.)
2. Docker container starts with Alpine Linux + Tower CLI v0.12.0
3. `entrypoint.sh` processes inputs and constructs Tower CLI commands
4. Tower CLI launches pipeline on Seqera Platform
5. Action outputs workflow metadata (ID, URL, workspace info) for downstream jobs

### Input Processing

The action handles sensitive data masking and parameter file generation:
- Masks secrets from GitHub logs (`entrypoint.sh:5-8`)
- Generates temporary files: `params.json`, `pre_run.sh`, `nextflow.config`
- Base64 encodes Tower CLI JSON output to bypass GitHub secret filters

### Output Structure

Returns structured JSON containing:
- `workflowId`: Unique pipeline run identifier
- `workflowUrl`: Direct link to Tower monitoring page  
- `workspaceId`: Workspace identifier
- `workspaceRef`: Human-readable workspace reference

## Development Commands

### Testing Locally
```bash
# Build Docker image
docker build -t action-tower-launch .

# Test entrypoint script directly
docker run --rm -it action-tower-launch /bin/sh
```

### CI/CD Testing
The CI pipeline (`ci.yml`) tests against three cloud providers (AWS, Azure, GCP) and validates failure scenarios.

### Version Management
- Uses semantic versioning with major version tags
- `update-tag.yml` automatically updates major version tags on release
- Tower CLI version pinned in `Dockerfile` (currently v0.12.0)

## Configuration

### Required Inputs
- `access_token`: Seqera Platform personal access token

### Key Optional Inputs
- `workspace_id`: Target workspace (defaults to personal workspace)
- `compute_env`: Compute environment name
- `api_endpoint`: Platform API URL (defaults to `api.cloud.seqera.io`)
- `pipeline`: Repository URL or pre-configured pipeline name
- `parameters`: Pipeline parameters as JSON string
- `wait`: Whether to wait for pipeline completion (default: false)

### Environment Variables (entrypoint.sh)
All GitHub Action inputs are passed as environment variables prefixed with `TOWER_` or as direct variables:
- `TOWER_ACCESS_TOKEN`, `TOWER_WORKSPACE_ID`, `TOWER_API_ENDPOINT`, etc.
- `PIPELINE`, `REVISION`, `WORKDIR`, `PARAMETERS`, `RUN_NAME`, etc.

## Security Considerations

- Extensive secret masking throughout the execution flow
- Secrets are stripped from log files before output
- Base64 encoding used to prevent accidental secret exposure in JSON output
- All sensitive environment variables are masked in GitHub Actions logs

## Tower CLI Integration

The action is a wrapper around the Tower CLI `launch` command with conditional parameter passing:
```bash
tw launch $PIPELINE \
  ${PARAMETERS:+"--params-file=params.json"} \
  ${WORKDIR:+"--work-dir=$WORKDIR"} \
  # ... other conditional parameters
```

Uses bash parameter expansion to only include flags when variables are set.

## File Outputs

- `tower_action_TIMESTAMP.log`: Verbose execution log with secrets scrubbed
- `tower_action_UUID.json`: Structured JSON output for programmatic use
- Both files are designed for artifact upload in GitHub Actions workflows