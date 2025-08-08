const core = require('@actions/core');
const fs = require('fs');
const crypto = require('crypto');
const { SeqeraPlatformAPI } = require('./seqera-api');

/**
 * Create log file with timestamp matching entrypoint.sh format
 */
function createLogFile() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '_')
    .replace(/\..*/, '')
    .replace(/-/g, '_');
  return `tower_action_${timestamp}.log`;
}

/**
 * Create JSON file with UUID matching entrypoint.sh format
 */
function createJsonFile() {
  const uuid = crypto.randomUUID();
  return `tower_action_${uuid}.json`;
}

/**
 * Write message to log file and console
 */
function logMessage(logFile, message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level}: ${message}\n`;
  
  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    core.error(`Failed to write to log file: ${error.message}`);
  }
}

/**
 * Main action entry point
 */
async function run() {
  let logFile, jsonFile;
  
  try {
    // Create log files
    logFile = createLogFile();
    jsonFile = createJsonFile();
    
    logMessage(logFile, 'Starting Seqera Platform workflow launch', 'INFO');
    core.info('🚀 Starting Seqera Platform workflow launch');
    
    // Get action inputs
    const inputs = {
      accessToken: core.getInput('access_token', { required: true }),
      pipeline: core.getInput('pipeline') || `https://github.com/${process.env.GITHUB_REPOSITORY}`,
      workspaceId: core.getInput('workspace_id'),
      computeEnv: core.getInput('compute_env'),
      apiEndpoint: core.getInput('api_endpoint') || 'https://api.cloud.seqera.io',
      revision: core.getInput('revision'),
      workdir: core.getInput('workdir'),
      parameters: core.getInput('parameters'),
      profiles: core.getInput('profiles'),
      runName: core.getInput('run_name'),
      nextflowConfig: core.getInput('nextflow_config'),
      preRunScript: core.getInput('pre_run_script'),
      labels: core.getInput('labels'),
      wait: core.getBooleanInput('wait'),
      debug: core.getBooleanInput('debug')
    };
    
    // Mask sensitive data
    core.setSecret(inputs.accessToken);
    if (inputs.workspaceId) core.setSecret(inputs.workspaceId);
    
    // Log input configuration
    logMessage(logFile, `Pipeline: ${inputs.pipeline}`);
    logMessage(logFile, `API Endpoint: ${inputs.apiEndpoint}`);
    logMessage(logFile, `Workspace ID: ${inputs.workspaceId || '<not set>'}`);
    logMessage(logFile, `Compute Environment: ${inputs.computeEnv || '<not set>'}`);
    
    // Debug mode logging
    if (inputs.debug) {
      core.info('🐛 Debug mode enabled');
      logMessage(logFile, 'Debug mode enabled', 'DEBUG');
      core.info(`Pipeline: ${inputs.pipeline}`);
      core.info(`API Endpoint: ${inputs.apiEndpoint}`);
      core.info(`Workspace ID: ${inputs.workspaceId || '<not set>'}`);
      core.info(`Compute Environment: ${inputs.computeEnv || '<not set>'}`);
      core.info(`Revision: ${inputs.revision || '<not set>'}`);
      core.info(`Work Directory: ${inputs.workdir || '<not set>'}`);
      core.info(`Config Profiles: ${inputs.profiles || '<not set>'}`);
      core.info(`Run Name: ${inputs.runName || '<not set>'}`);
      core.info(`Labels: ${inputs.labels || '<not set>'}`);
      core.info(`Wait: ${inputs.wait}`);
      core.info(`Parameters: ${inputs.parameters ? `${inputs.parameters.length} chars` : '<not set>'}`);
      core.info(`Nextflow Config: ${inputs.nextflowConfig ? `${inputs.nextflowConfig.length} chars` : '<not set>'}`);
      core.info(`Pre-run Script: ${inputs.preRunScript ? `${inputs.preRunScript.length} chars` : '<not set>'}`);
    }
    
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
    
    // Initialize API client
    const apiClient = new SeqeraPlatformAPI({
      baseUrl: inputs.apiEndpoint,
      accessToken: inputs.accessToken,
      debug: inputs.debug
    });
    
    // Test API connectivity
    core.info('🔗 Testing API connectivity...');
    logMessage(logFile, 'Testing API connectivity...');
    const connectionTest = await apiClient.testConnection();
    if (!connectionTest.success) {
      logMessage(logFile, `API connectivity test failed: ${connectionTest.error}`, 'ERROR');
      throw new Error(`API connectivity test failed: ${connectionTest.error}`);
    }
    core.info('✅ API connectivity confirmed');
    logMessage(logFile, 'API connectivity confirmed');
    
    // Launch the workflow
    core.info('🎯 Launching workflow...');
    logMessage(logFile, 'Launching workflow...');
    const launchResult = await apiClient.launchWorkflow(inputs);
    
    if (!launchResult.success) {
      // Provide detailed error information
      let errorMessage = `Workflow launch failed: ${launchResult.error}`;
      
      if (launchResult.statusCode === 401) {
        errorMessage += '\n\n💡 This usually indicates an invalid or expired access token.';
        errorMessage += '\n   Please check that your TOWER_ACCESS_TOKEN secret is valid.';
      } else if (launchResult.statusCode === 403) {
        errorMessage += '\n\n💡 This usually indicates insufficient permissions.';
        errorMessage += '\n   Please check workspace permissions and compute environment access.';
      } else if (launchResult.statusCode === 404) {
        errorMessage += '\n\n💡 This usually indicates the pipeline or workspace was not found.';
        errorMessage += '\n   Please check the pipeline URL and workspace ID.';
      }
      
      if (launchResult.details && inputs.debug) {
        errorMessage += `\n\n🐛 Debug details: ${launchResult.details}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const workflowData = launchResult.data;
    core.info(`✅ Workflow launched successfully!`);
    core.info(`📊 Workflow ID: ${workflowData.workflowId}`);
    logMessage(logFile, `Workflow launched successfully! ID: ${workflowData.workflowId}`);
    
    // Build workflow URL (this might need adjustment based on actual API responses)
    let workflowUrl = workflowData.workflowUrl;
    if (!workflowUrl) {
      // Construct URL if not provided by API
      const baseUrl = inputs.apiEndpoint.replace('/api.', '/').replace('/api', '');
      if (inputs.workspaceId) {
        workflowUrl = `${baseUrl}/orgs/-/workspaces/${inputs.workspaceId}/watch/${workflowData.workflowId}`;
      } else {
        workflowUrl = `${baseUrl}/workflow/${workflowData.workflowId}`;
      }
    }
    
    // Set outputs
    const outputs = {
      workflowId: workflowData.workflowId,
      workflowUrl: workflowUrl,
      workspaceId: workflowData.workspaceId || inputs.workspaceId || '',
      workspaceRef: workflowData.workspaceRef || '[personal]',
      json: JSON.stringify({
        workflowId: workflowData.workflowId,
        workflowUrl: workflowUrl,
        workspaceId: workflowData.workspaceId || inputs.workspaceId || '',
        workspaceRef: workflowData.workspaceRef || '[personal]'
      })
    };
    
    // Set GitHub Action outputs
    Object.entries(outputs).forEach(([key, value]) => {
      core.setOutput(key, value);
      // Mask sensitive values
      if (key.includes('Id') && value) {
        core.setSecret(value);
      }
    });
    
    core.info(`🌐 Workflow URL: ${workflowUrl}`);
    logMessage(logFile, `Workflow URL: ${workflowUrl}`);
    
    // Write JSON output file
    const jsonOutput = {
      workflowId: workflowData.workflowId,
      workflowUrl: workflowUrl,
      workspaceId: workflowData.workspaceId || inputs.workspaceId || '',
      workspaceRef: workflowData.workspaceRef || '[personal]',
      timestamp: new Date().toISOString(),
      success: true
    };
    
    try {
      fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
      logMessage(logFile, `JSON output written to: ${jsonFile}`);
    } catch (error) {
      logMessage(logFile, `Failed to write JSON file: ${error.message}`, 'ERROR');
    }
    
    // Handle wait functionality
    if (inputs.wait) {
      core.info('⏳ Wait mode enabled - monitoring workflow status...');
      logMessage(logFile, 'Wait mode enabled - monitoring workflow status...');
      
      const waitResult = await apiClient.waitForCompletion(
        workflowData.workflowId,
        inputs.workspaceId,
        {
          maxWaitTime: 30 * 60 * 1000, // 30 minutes
          pollInterval: 30 * 1000      // 30 seconds
        }
      );
      
      if (!waitResult.success) {
        logMessage(logFile, `Wait failed: ${waitResult.error}`, 'ERROR');
        throw new Error(`Wait failed: ${waitResult.error}`);
      }
      
      if (waitResult.status === 'COMPLETED') {
        core.info('🎉 Workflow completed successfully!');
        logMessage(logFile, 'Workflow completed successfully!');
      } else {
        logMessage(logFile, `Workflow ended with status: ${waitResult.status}`, 'ERROR');
        throw new Error(`Workflow ended with status: ${waitResult.status}`);
      }
    } else {
      core.info('⚡ Launch complete - not waiting for workflow completion');
      core.info('💡 Set wait: true to monitor workflow progress');
      logMessage(logFile, 'Launch complete - not waiting for workflow completion');
    }
    
    core.info('🏁 Action completed successfully');
    logMessage(logFile, 'Action completed successfully');
    
    // Log final summary
    logMessage(logFile, '='.repeat(50));
    logMessage(logFile, 'Action execution completed successfully');
    logMessage(logFile, `Log file: ${logFile}`);
    logMessage(logFile, `JSON file: ${jsonFile}`);
    logMessage(logFile, '='.repeat(50));
    
  } catch (error) {
    // Log error to file
    if (logFile) {
      logMessage(logFile, `Action failed: ${error.message}`, 'ERROR');
      if (error.stack) {
        logMessage(logFile, `Stack trace: ${error.stack}`, 'ERROR');
      }
      
      // Write error JSON file
      if (jsonFile) {
        const errorOutput = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack
        };
        
        try {
          fs.writeFileSync(jsonFile, JSON.stringify(errorOutput, null, 2));
          logMessage(logFile, `Error JSON output written to: ${jsonFile}`);
        } catch (writeError) {
          logMessage(logFile, `Failed to write error JSON file: ${writeError.message}`, 'ERROR');
        }
      }
    }
    
    // Additional debugging information
    const isDebug = process.env.NODE_ENV === 'test' ? false : core.getBooleanInput('debug');
    if (error.stack && isDebug) {
      core.error(`Stack trace: ${error.stack}`);
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