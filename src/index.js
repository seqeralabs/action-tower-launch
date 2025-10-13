const core = require('@actions/core');
const fs = require('fs');
const crypto = require('crypto');
const { SeqeraPlatformAPI } = require('./seqera-api');

/**
 * Create log file with timestamp matching the old entrypoint.sh format (from v2)
 */
function createLogFile() {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '_')
    .replace(/\..*/, '')
    .replace(/-/g, '_');
  return `platform_action_${timestamp}.log`;
}

/**
 * Create JSON file with unique ID in filename
 */
function createJsonFile() {
  const uuid = crypto.randomUUID();
  return `platform_action_${uuid}.json`;
}

/**
 * Logger that writes to both console and file
 */
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
  }

  /**
   * Write message to log file with timestamp and level
   */
  _writeToFile(message, level = 'INFO') {
    if (!this.logFile) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;

    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      core.error(`Failed to write to log file: ${error.message}`);
    }
  }

  /**
   * Log info message to both console and file
   */
  info(message) {
    core.info(message);
    this._writeToFile(message, 'INFO');
  }

  /**
   * Log error message to both console and file
   */
  error(message) {
    core.error(message);
    this._writeToFile(message, 'ERROR');
  }

  /**
   * Log debug message to both console and file
   */
  debug(message) {
    core.debug(message);
    this._writeToFile(message, 'DEBUG');
  }

  /**
   * Log grouped configuration with consistent formatting
   */
  logConfig(title, configs) {
    core.startGroup(title);
    this._writeToFile(`=== ${title} ===`);

    configs.forEach(({ label, value, truncate = false }) => {
      let displayValue = value || '<not set>';
      let fileValue = displayValue;

      if (
        value &&
        truncate &&
        typeof value === 'string' &&
        value.length > 200
      ) {
        fileValue = `${value.substring(0, 200)}...`;
        displayValue = `${value.length} chars`;
      }

      const message = `${label}: ${displayValue}`;
      core.info(message);
      this._writeToFile(`${label}: ${fileValue}`);
    });

    core.endGroup();
    this._writeToFile(`=== End ${title} ===`);
  }

  /**
   * Log separator for file organization
   */
  separator(message = '') {
    const sep = '='.repeat(50);
    if (message) {
      this._writeToFile(sep);
      this._writeToFile(message);
      this._writeToFile(sep);
    } else {
      this._writeToFile(sep);
    }
  }
}

/**
 * Main action entry point
 */
async function run() {
  let logger, jsonFile;

  try {
    // Create log files and logger
    const logFile = createLogFile();
    jsonFile = createJsonFile();
    logger = new Logger(logFile);

    logger.info('🚀 Starting Seqera Platform workflow launch');

    // Get action inputs
    const inputs = {
      accessToken: core.getInput('access_token', { required: true }),
      pipeline:
        core.getInput('pipeline') ||
        `https://github.com/${process.env.GITHUB_REPOSITORY}`,
      workspaceId: core.getInput('workspace_id'),
      computeEnv: core.getInput('compute_env'),
      apiEndpoint:
        core.getInput('api_endpoint') || 'https://api.cloud.seqera.io',
      revision: core.getInput('revision'),
      workdir: core.getInput('workdir'),
      parameters: core.getInput('parameters'),
      profiles: core.getInput('profiles'),
      runName: core.getInput('run_name'),
      nextflowConfig: core.getInput('nextflow_config'),
      preRunScript: core.getInput('pre_run_script'),
      labels: core.getInput('labels'),
      wait: core.getBooleanInput('wait'),
    };

    // Mask sensitive data (access token and workspace ID)
    core.setSecret(inputs.accessToken);
    if (inputs.workspaceId) {
      core.setSecret(inputs.workspaceId);
    }

    // Always show configuration info using unified logging with GitHub groups
    logger.logConfig('📋 Configuration', [
      { label: 'Pipeline', value: inputs.pipeline },
      { label: 'API Endpoint', value: inputs.apiEndpoint },
      { label: 'Workspace ID', value: inputs.workspaceId },
      { label: 'Compute Environment', value: inputs.computeEnv },
      { label: 'Revision', value: inputs.revision },
      { label: 'Work Directory', value: inputs.workdir },
      { label: 'Config Profiles', value: inputs.profiles },
      { label: 'Run Name', value: inputs.runName },
      { label: 'Labels', value: inputs.labels },
      { label: 'Wait', value: inputs.wait?.toString() },
      { label: 'Parameters', value: inputs.parameters, truncate: true },
      {
        label: 'Nextflow Config',
        value: inputs.nextflowConfig,
        truncate: true,
      },
      { label: 'Pre-run Script', value: inputs.preRunScript, truncate: true },
    ]);

    // Validate required inputs
    if (!inputs.accessToken || inputs.accessToken.trim() === '') {
      throw new Error(`access_token is required and cannot be empty.

💡 Common causes:
   • Missing TOWER_ACCESS_TOKEN secret in repository settings
   • Secret value is empty or contains only whitespace
   • Incorrect secret name in workflow file

📖 To fix this:
   1. Go to your repository Settings → Secrets and variables → Actions
   2. Add/update TOWER_ACCESS_TOKEN with your Seqera Platform token
   3. Ensure your workflow uses: access_token: \${{ secrets.TOWER_ACCESS_TOKEN }}`);
    }

    if (!inputs.pipeline) {
      throw new Error('pipeline is required');
    }

    // Initialize API client with debug enabled for comprehensive logging
    const apiClient = new SeqeraPlatformAPI({
      baseUrl: inputs.apiEndpoint,
      accessToken: inputs.accessToken,
      debug: true, // Always enable debug for comprehensive logging
    });

    // Test API connectivity
    logger.info('🔗 Testing API connectivity...');
    const connectionTest = await apiClient.testConnection();
    if (!connectionTest.success) {
      logger.error(`API connectivity test failed: ${connectionTest.error}`);
      throw new Error(`API connectivity test failed: ${connectionTest.error}`);
    }
    logger.info('✅ API connectivity confirmed');

    // Launch the workflow
    logger.info('🎯 Launching workflow...');
    const launchResult = await apiClient.launchWorkflow(inputs);

    if (!launchResult.success) {
      // Provide detailed error information
      let errorMessage = `Workflow launch failed: ${launchResult.error}`;

      if (launchResult.statusCode === 401) {
        errorMessage +=
          '\n\n💡 This usually indicates an invalid or expired access token.';
        errorMessage +=
          '\n   Please check that your TOWER_ACCESS_TOKEN secret is valid.';
      } else if (launchResult.statusCode === 403) {
        errorMessage +=
          '\n\n💡 This usually indicates insufficient permissions.';
        errorMessage +=
          '\n   Please check workspace permissions and compute environment access.';
      } else if (launchResult.statusCode === 404) {
        errorMessage +=
          "\n\n💡 This usually indicates the pipeline or workspace was not found, or you don't have access permissions.";
        errorMessage +=
          '\n   Please check the pipeline URL and workspace ID and ensure that you have the correct permissions.';
      }

      if (launchResult.details) {
        errorMessage += `\n\n🐛 Debug details: ${launchResult.details}`;
      }

      throw new Error(errorMessage);
    }

    const workflowData = launchResult.data;
    logger.info(`✅ Workflow launched successfully!`);
    logger.info(`📊 Workflow ID: ${workflowData.workflowId}`);

    // Build workflow URL
    let workflowUrl = workflowData.workflowUrl;
    if (!workflowUrl) {
      // Construct URL if not provided by API - convert API endpoint to web URL
      let baseUrl = inputs.apiEndpoint;
      if (baseUrl.includes('api.cloud.seqera.io')) {
        baseUrl = baseUrl.replace('api.cloud.seqera.io', 'cloud.seqera.io');
      } else if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.replace(/\/api$/, '');
      }

      // For workspace-specific workflows, we need the workspace info from the API response
      // Fall back to a simple workflow URL if we don't have org/workspace details
      if (
        inputs.workspaceId &&
        workflowData.workspaceRef &&
        workflowData.workspaceRef !== '[personal]'
      ) {
        // Try to parse org from workspaceRef format like "[org / workspace]"
        const orgMatch = workflowData.workspaceRef.match(
          /\[\s*([^/]+)\s*\/\s*([^/]+)\s*\]/,
        );
        if (orgMatch) {
          const org = orgMatch[1].trim();
          const workspace = orgMatch[2].trim();
          workflowUrl = `${baseUrl}/orgs/${org}/workspaces/${workspace}/watch/${workflowData.workflowId}`;
        } else {
          workflowUrl = `${baseUrl}/workflow/${workflowData.workflowId}`;
        }
      } else {
        // Personal workspace or fallback URL
        workflowUrl = `${baseUrl}/workflow/${workflowData.workflowId}`;
      }
    }

    // Prepare output data structure
    const outputData = {
      workflowId: workflowData.workflowId,
      workflowUrl: workflowUrl,
      workspaceId: workflowData.workspaceId || inputs.workspaceId || '',
      workspaceRef: workflowData.workspaceRef || '[personal]',
    };

    // Set GitHub Action outputs
    Object.entries(outputData).forEach(([key, value]) => {
      core.setOutput(key, value);
      // Only mask workspace ID (not workflow ID - it's needed for URLs)
      if (key === 'workspaceId' && value) {
        core.setSecret(value);
      }
    });
    // Add JSON string representation as output
    core.setOutput('json', JSON.stringify(outputData));

    logger.info(`🌐 Workflow URL: ${workflowUrl}`);

    // Write JSON output file with additional metadata
    const jsonOutput = {
      ...outputData,
      timestamp: new Date().toISOString(),
      success: true,
    };

    try {
      fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
      logger.debug(`JSON output written to: ${jsonFile}`);
    } catch (error) {
      logger.error(`Failed to write JSON file: ${error.message}`);
    }

    // Handle wait functionality
    if (inputs.wait) {
      logger.info('⏳ Wait mode enabled - monitoring workflow status...');

      const waitResult = await apiClient.waitForCompletion(
        workflowData.workflowId,
        inputs.workspaceId,
        {
          maxWaitTime: 30 * 60 * 1000, // 30 minutes
          pollInterval: 30 * 1000, // 30 seconds
        },
      );

      if (!waitResult.success) {
        logger.error(`Wait failed: ${waitResult.error}`);
        throw new Error(`Wait failed: ${waitResult.error}`);
      }

      if (waitResult.status === 'COMPLETED') {
        logger.info('🎉 Workflow completed successfully!');
      } else {
        logger.error(`Workflow ended with status: ${waitResult.status}`);
        throw new Error(`Workflow ended with status: ${waitResult.status}`);
      }
    } else {
      logger.info('⚡ Launch complete - not waiting for workflow completion');
      logger.info('💡 Set wait: true to monitor workflow progress');
    }

    logger.info('🏁 Action completed successfully');

    // Log final summary to file
    logger.separator('Action execution completed successfully');
  } catch (error) {
    // Log error using unified logger
    if (logger) {
      logger.error(`Action failed: ${error.message}`);
      if (error.stack) {
        logger.debug(`Stack trace: ${error.stack}`);
      }

      // Write error JSON file
      if (jsonFile) {
        const errorOutput = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack,
        };

        try {
          fs.writeFileSync(jsonFile, JSON.stringify(errorOutput, null, 2));
          logger.debug(`Error JSON output written to: ${jsonFile}`);
        } catch (writeError) {
          logger.error(
            `Failed to write error JSON file: ${writeError.message}`,
          );
        }
      }

      logger.separator('Action execution failed');
    }

    // Set action as failed (this will log the error message once)
    core.setFailed(`❌ Action failed\n${error.message}`);
  }
}

// Run the action
if (require.main === module) {
  run();
}

module.exports = { run };
