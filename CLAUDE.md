# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `action-tower-launch`, a GitHub Action that launches Nextflow workflows using Seqera Platform. It's a **Node.js-based action** that uses the **Seqera Platform REST API directly** to submit pipeline runs, replacing the previous Docker/Tower CLI approach.

## Architecture

### Core Components

- **`action.yml`**: GitHub Action metadata defining inputs, outputs, and Node.js configuration
- **`src/index.js`**: Main action entry point with input validation, logging, and orchestration
- **`src/seqera-api.js`**: Seqera Platform API client with workflow launch and monitoring capabilities
- **`src/test-action.js`**: Local testing script that simulates GitHub Actions environment
- **`dist/index.js`**: Compiled action bundle (generated via `npm run build` using `@vercel/ncc`)

**Note on `dist/index.js`**: This file bundles all dependencies into a single file for fast execution in GitHub Actions. It must be regenerated and committed whenever source code or dependencies change. The bundle includes source maps (`dist/index.js.map`) and a licenses file (`dist/licenses.txt`).

### Key Flow

1. GitHub Action receives inputs (access tokens, pipeline config, etc.)
2. Node.js runtime loads the compiled action (`dist/index.js`)
3. Action validates inputs and initializes Seqera Platform API client
4. API client tests connectivity and launches workflow via REST API
5. Action outputs workflow metadata (ID, URL, workspace info) for downstream jobs
6. Optional: Waits for workflow completion if `wait: true`

### Architecture Benefits

The action uses a **native JavaScript implementation** with Seqera Platform REST API (`runs.using: "node20"`), providing:
- **Faster startup**: No container initialization overhead
- **Better error handling**: Structured error responses with troubleshooting tips
- **Native GitHub integration**: Direct use of `@actions/core` and `@actions/http-client`
- **Improved debugging**: Comprehensive logging and debug modes
- **Easier maintenance**: Standard Node.js development workflow

### ES Modules (ESM)

The project uses **ES Modules** (`"type": "module"` in `package.json`):
- All source files use `import`/`export` syntax instead of `require()`/`module.exports`
- Test files use ESM natively with Vitest
- `@vercel/ncc` compiles ESM to a bundled format for GitHub Actions
- ESLint config uses `.eslintrc.cjs` extension (CommonJS) for compatibility
- Dependencies:
  - `@actions/core`: ^1.11.1 (supports both CommonJS and ESM)
  - `@actions/github`: ^6.0.0 (pure ESM, available for GitHub API operations)
  - `@actions/http-client`: ^2.2.3 (supports both CommonJS and ESM)

**Example using @actions/github**:
```javascript
import { getOctokit, context } from '@actions/github';

// Get authenticated Octokit client
const octokit = getOctokit(token);

// Access GitHub context
const { repo, owner } = context.repo;
const sha = context.sha;

// Make GitHub API calls
const { data } = await octokit.rest.repos.get({ owner, repo });
```

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
- `debug`: Enable detailed debug logging (default: false) - **useful for development and troubleshooting**
- `labels`: Comma-separated workspace-specific labels for workflow annotation

### Input Processing
The action processes GitHub Action inputs using `@actions/core`:
- Input validation with detailed error messages and troubleshooting tips
- Automatic secret masking for sensitive inputs (`access_token`, `workspace_id`, etc.)
- JSON parameter parsing with validation
- Debug mode with comprehensive logging

## Development Requirements

- **Node.js**: Version 20 or higher (specified in `package.json` engines)
- **Build Tool**: `@vercel/ncc` for bundling the action
- **Test Framework**: Vitest for unit and integration testing

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

# Build the action (CRITICAL: must be done before committing!)
npm run build

# Package and test
npm run package
```

**⚠️ IMPORTANT**: The `dist/index.js` file **must** be committed after running `npm run build`. The CI workflow will fail if `dist/` is not up to date with source changes. Always run `npm run build` before committing code changes.

### Testing & Quality Assurance
```bash
# Unit tests with Vitest
npm run test:watch     # Watch mode for development
npm run test:coverage  # Coverage report
npm run test:ci        # CI pipeline testing

# Code quality
npm run lint           # ESLint checks

# Local testing (simulates GitHub Actions environment)
node src/test-action.js
```

### ESLint Configuration
The project uses ESLint with the following key rules:
- ES2021 syntax with module support
- Unused variables must be prefixed with `_`
- Prefer `const` over `let`, no `var` allowed
- Test files have access to Vitest globals (`describe`, `it`, `expect`, etc.)

### Local Development Workflow

1. **Make code changes** in `src/` directory
2. **Run tests** to verify changes: `npm run test:watch`
3. **Lint code**: `npm run lint`
4. **Build the action**: `npm run build` (creates `dist/index.js`)
5. **Verify build**: Check that no unexpected changes were made to `dist/`
6. **Commit both source and dist**: Git commit should include both `src/` and `dist/` changes
7. **Local testing** (optional): `node src/test-action.js` to simulate GitHub Actions environment

**Common pitfall**: Forgetting to run `npm run build` before committing. The CI will catch this, but it's better to catch it locally.

## Security Considerations

- Uses `@actions/core.setSecret()` for automatic secret masking
- Input validation prevents injection attacks
- Structured error handling without exposing sensitive data
- HTTP client with proper authentication headers
- Base64 encoding used to prevent accidental secret exposure in JSON output

## API Integration

The action uses direct Seqera Platform REST API calls:
```javascript
// API client initialization
const apiClient = new SeqeraPlatformAPI({
  baseUrl: inputs.apiEndpoint,
  accessToken: inputs.accessToken
});

// Workflow launch
const launchResult = await apiClient.launchWorkflow(inputs);
```

## File Outputs

The action creates output files for logging and programmatic access:
- `platform_action_TIMESTAMP.log`: Verbose execution log with secrets scrubbed (format: `platform_action_YYYY_MM_DD_HH_MM_SS.log`)
- `platform_action_UUID.json`: Structured JSON output for programmatic use
- Both files are designed for artifact upload in GitHub Actions workflows

Example artifact upload configuration:
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: Platform debug log file
    path: platform_action_*.log
```

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
- **Coverage reporting**: Generated in `coverage/` directory (text, lcov, html formats)
- **Mocking**: HTTP requests and GitHub Actions core functions
- **Testing philosophy**: Focus on testing core functionality rather than arbitrary coverage percentages

### CI/CD Workflows

**`test.yml`** - Primary quality assurance workflow:
1. **Unit Tests**: Runs `npm run test:ci` with coverage reporting to Codecov
2. **Linting**: Validates code style with ESLint
3. **Build Verification**: Ensures `dist/` is up to date with source code (fails if uncommitted build changes exist)
4. **Optional API Test**: Real API integration test (only runs for maintainers with secrets)

**`ci.yml`** - Full integration testing:
- Tests the action against AWS, Azure, and GCP environments
- Validates error handling with intentionally failing pipeline
- Uploads artifacts for debugging
- Comments on PRs with workflow details

**`update-tag.yml`** - Version tagging:
- Automatically updates major version tags (e.g., `v3`) when new releases are published
- Allows users to reference `@v3` instead of specific patch versions

### Version Management
- **Semantic versioning**: Currently v3.0.0 for the JavaScript rewrite
- **Build process**: `dist/index.js` must be committed after `npm run build` (CI enforces this)
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

### Output Format
The action provides structured output for downstream jobs:
```json
{
  "workflowId": "unique-workflow-identifier",
  "workflowUrl": "https://cloud.seqera.io/...",
  "workspaceId": "workspace-identifier",
  "workspaceRef": "[organization/workspace]",
  "json": "base64-encoded-json-for-github-outputs"
}
```
