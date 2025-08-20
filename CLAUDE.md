# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `action-tower-launch`, a GitHub Action that launches Nextflow workflows using Seqera Platform. It's a **Node.js-based action** that uses the **Seqera Platform REST API directly** to submit pipeline runs, replacing the previous Docker/Tower CLI approach.

## Architecture

### Core Components

- **`action.yml`**: GitHub Action metadata defining inputs, outputs, and Node.js configuration
- **`src/index.js`**: Main action entry point with input validation, logging, and orchestration
- **`src/seqera-api.js`**: Seqera Platform API client with workflow launch and monitoring capabilities
- **`dist/index.js`**: Compiled action bundle (generated via `npm run build`)
- **Legacy Components** (still present for transition):
  - `entrypoint.sh`: Previous shell script for Docker-based approach
  - `Dockerfile`: Previous container definition with Tower CLI

### Key Flow

1. GitHub Action receives inputs (access tokens, pipeline config, etc.)
2. Node.js runtime loads the compiled action (`dist/index.js`)
3. Action validates inputs and initializes Seqera Platform API client
4. API client tests connectivity and launches workflow via REST API
5. Action outputs workflow metadata (ID, URL, workspace info) for downstream jobs
6. Optional: Waits for workflow completion if `wait: true`

### Architecture Transition

The action now supports **dual modes**:
- **Primary**: Native JavaScript action using Seqera Platform REST API (`runs.using: "node20"`)
- **Legacy**: Docker-based action using Tower CLI (available via separate Docker files)

This allows for backward compatibility while providing better performance and maintainability.

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

### Input Processing (JavaScript Action)
The action directly processes GitHub Action inputs using `@actions/core`:
- Input validation with detailed error messages and troubleshooting tips
- Automatic secret masking for sensitive inputs (`access_token`, `workspace_id`, etc.)
- JSON parameter parsing with validation
- Debug mode with comprehensive logging

### Input Processing (Legacy Shell Script)
For the legacy Docker approach (`entrypoint.sh`), inputs are passed as environment variables:
- `TOWER_ACCESS_TOKEN`, `TOWER_WORKSPACE_ID`, `TOWER_API_ENDPOINT`, etc.
- `PIPELINE`, `REVISION`, `WORKDIR`, `PARAMETERS`, `RUN_NAME`, etc.

## Development Commands

### Node.js Action Development
```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:coverage

# Lint code
npm run lint

# Build the action (required before committing)
npm run build

# Package and test
npm run package
```

### Testing & Quality Assurance
```bash
# Unit tests with Vitest
npm run test:watch     # Watch mode for development
npm run test:coverage  # Coverage report
npm run test:ci        # CI pipeline testing

# Code quality
npm run lint           # ESLint checks
```

### Legacy Docker Development
```bash
# Build Docker image
docker build -t action-tower-launch .

# Test entrypoint script directly
docker run --rm -it action-tower-launch /bin/sh
```

## Security Considerations

### JavaScript Action Security
- Uses `@actions/core.setSecret()` for automatic secret masking
- Input validation prevents injection attacks
- Structured error handling without exposing sensitive data
- HTTP client with proper authentication headers

### Legacy Security (Docker/Shell)
- Extensive secret masking throughout the execution flow
- Secrets are stripped from log files before output
- Base64 encoding used to prevent accidental secret exposure in JSON output
- All sensitive environment variables are masked in GitHub Actions logs

## API Integration

### Seqera Platform REST API
The JavaScript action uses direct REST API calls:
```javascript
// API client initialization
const apiClient = new SeqeraPlatformAPI({
  baseUrl: inputs.apiEndpoint,
  accessToken: inputs.accessToken,
  debug: inputs.debug
});

// Workflow launch
const launchResult = await apiClient.launchWorkflow(inputs);
```

### Legacy Tower CLI Integration
The Docker action wraps Tower CLI commands:
```bash
tw launch $PIPELINE \
  ${PARAMETERS:+"--params-file=params.json"} \
  ${WORKDIR:+"--work-dir=$WORKDIR"} \
  # ... other conditional parameters
```

## File Outputs

Both action modes create consistent output files:
- `tower_action_TIMESTAMP.log`: Verbose execution log with secrets scrubbed
- `tower_action_UUID.json`: Structured JSON output for programmatic use
- Both files are designed for artifact upload in GitHub Actions workflows

## Error Handling & Debugging

### Enhanced Error Messages
The JavaScript action provides detailed error messages with troubleshooting guidance:
- **401 errors**: "Invalid or expired access token" with token validation steps
- **403 errors**: "Insufficient permissions" with workspace/compute environment checks
- **404 errors**: "Pipeline or workspace not found" with URL/ID validation tips

### Debug Mode
Enable comprehensive logging with `debug: true`:
- API request/response details
- Input parameter processing
- Workflow status monitoring (when using `wait: true`)
- HTTP client debugging information

## CI/CD & Testing

### Testing Infrastructure
The project uses **Vitest** for JavaScript testing with comprehensive coverage:
- **Unit tests**: Core functionality and API client testing (`src/__tests__/`)
- **Integration tests**: End-to-end workflow launch scenarios
- **Coverage reporting**: Generated in `coverage/` directory
- **Mocking**: HTTP requests and GitHub Actions core functions

### CI/CD Pipeline
Multi-approach testing strategy:
- **JavaScript Action**: Unit tests, integration tests, code coverage, and ESLint
- **Legacy Docker**: Tests against multiple cloud providers (AWS, Azure, GCP) and failure scenarios
- **Dual Mode Validation**: Ensures both approaches produce consistent results

### Version Management
- **Semantic versioning**: Currently v3.0.0 for the JavaScript rewrite
- **Build process**: `dist/index.js` must be committed after `npm run build`
- **Automated tagging**: `update-tag.yml` workflow updates major version tags on release
- **Dependency management**: Regular security updates via Dependabot

## Key Implementation Details

### Wait Functionality
The JavaScript action includes sophisticated workflow monitoring:
```javascript
// Poll workflow status with configurable timeouts
const waitResult = await apiClient.waitForCompletion(
  workflowData.workflowId,
  inputs.workspaceId,
  {
    maxWaitTime: 30 * 60 * 1000, // 30 minutes
    pollInterval: 30 * 1000      // 30 seconds
  }
);
```

### Output Compatibility
Both action modes maintain consistent output format for backward compatibility:
```json
{
  "workflowId": "unique-workflow-identifier",
  "workflowUrl": "https://cloud.seqera.io/...",
  "workspaceId": "workspace-identifier", 
  "workspaceRef": "[organization/workspace]",
  "json": "base64-encoded-json-for-github-outputs"
}
```

### Migration Benefits
The JavaScript action provides several advantages over the Docker approach:
- **Faster startup**: No container initialization overhead
- **Better error handling**: Structured error responses with troubleshooting tips  
- **Native GitHub integration**: Direct use of `@actions/core` and `@actions/http-client`
- **Improved debugging**: Comprehensive logging and debug modes
- **Easier maintenance**: Standard Node.js development workflow