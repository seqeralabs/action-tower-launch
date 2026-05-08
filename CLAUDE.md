# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `action-seqera-launch`, a GitHub Action that launches Nextflow workflows using Seqera Platform. It's a JavaScript-based action that uses the Seqera Platform REST API directly to submit pipeline runs.

## Architecture

### Core Components

- **`action.yml`**: GitHub Action metadata defining inputs, outputs, and Docker configuration
- **`src/index.js`**: Main JavaScript entry point that handles Seqera Platform API operations
- **`src/seqera-api.js`**: Seqera Platform API client library

### Key Flow

1. GitHub Action receives inputs (access tokens, pipeline config, etc.)
2. JavaScript action initializes Seqera Platform API client
3. `src/index.js` processes inputs and constructs API requests
4. Seqera Platform API launches pipeline
5. Action outputs workflow metadata (ID, URL, workspace info) for downstream jobs

### Input Processing

The action handles sensitive data masking and log file generation:
- Masks secrets from GitHub logs using `@actions/core`
- Generates log files: `seqera_action_*.log`, `seqera_action_*.json`
- Provides comprehensive error messages and troubleshooting guidance

### Output Structure

Returns structured JSON containing:
- `workflowId`: Unique pipeline run identifier
- `workflowUrl`: Direct link to Seqera Platform monitoring page  
- `workspaceId`: Workspace identifier
- `workspaceRef`: Human-readable workspace reference

## Development Commands

### Testing Locally
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build action
npm run build
```

### CI/CD Testing
The CI pipeline (`ci.yml`) tests the JavaScript action and validates failure scenarios.

### Version Management
- Uses semantic versioning with major version tags
- `update-tag.yml` automatically updates major version tags on release
- Seqera Platform API client built into the JavaScript action

## Configuration

### Required Inputs
- `access_token`: Seqera Platform personal access token

### Key Optional Inputs
- `workspace_id`: Target workspace (defaults to personal workspace)
- `compute_env`: Compute environment name
- `api_endpoint`: Platform API URL (defaults to `api.cloud.seqera.io`)
- `pipeline`: Repository URL or pre-configured pipeline name
- `parameters`: Pipeline parameters as JSON string
- `labels`: Workflow labels (comma-separated)
- `wait`: Whether to wait for pipeline completion (default: false)

### Environment Variables (src/index.js)
All GitHub Action inputs are processed through `@actions/core` methods:
- Sensitive values like access tokens are automatically masked in logs
- Input validation ensures required parameters are provided
- Backward compatibility maintained for `TOWER_ACCESS_TOKEN` alongside `SEQERA_ACCESS_TOKEN`

## Security Considerations

- Extensive secret masking throughout the execution flow
- Secrets are stripped from log files before output
- Base64 encoding used to prevent accidental secret exposure in JSON output
- All sensitive environment variables are masked in GitHub Actions logs

## Seqera Platform API Integration

The action uses the Seqera Platform REST API directly with the following endpoints:
- `GET /service-info` - API connectivity testing
- `POST /workflow/launch` - Workflow submission
- `GET /workflow/{id}` - Status monitoring (when wait=true)

All API requests include proper authentication headers and error handling.

## File Outputs

- `seqera_action_TIMESTAMP.log`: Verbose execution log with secrets scrubbed
- `seqera_action_UUID.json`: Structured JSON output for programmatic use
- Both files are designed for artifact upload in GitHub Actions workflows