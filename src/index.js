const core = require('@actions/core');
const { SeqeraPlatformAPI } = require('./seqera-api');

/**
 * Main action entry point
 */
async function run() {
  try {
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
      wait: core.getBooleanInput('wait'),
      debug: core.getBooleanInput('debug')
    };
    
    // Mask sensitive data
    core.setSecret(inputs.accessToken);
    if (inputs.workspaceId) core.setSecret(inputs.workspaceId);
    
    // Debug mode logging
    if (inputs.debug) {
      core.info('🐛 Debug mode enabled');
      core.info(`Pipeline: ${inputs.pipeline}`);
      core.info(`API Endpoint: ${inputs.apiEndpoint}`);
      core.info(`Workspace ID: ${inputs.workspaceId || '<not set>'}`);
      core.info(`Compute Environment: ${inputs.computeEnv || '<not set>'}`);
      core.info(`Revision: ${inputs.revision || '<not set>'}`);
      core.info(`Work Directory: ${inputs.workdir || '<not set>'}`);
      core.info(`Config Profiles: ${inputs.profiles || '<not set>'}`);
      core.info(`Run Name: ${inputs.runName || '<not set>'}`);
      core.info(`Wait: ${inputs.wait}`);
      core.info(`Parameters: ${inputs.parameters ? `${inputs.parameters.length} chars` : '<not set>'}`);
      core.info(`Nextflow Config: ${inputs.nextflowConfig ? `${inputs.nextflowConfig.length} chars` : '<not set>'}`);
      core.info(`Pre-run Script: ${inputs.preRunScript ? `${inputs.preRunScript.length} chars` : '<not set>'}`);
    }
    
    // Validate required inputs
    if (!inputs.accessToken) {
      throw new Error('access_token is required');
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
    const connectionTest = await apiClient.testConnection();
    if (!connectionTest.success) {
      throw new Error(`API connectivity test failed: ${connectionTest.error}`);
    }
    core.info('✅ API connectivity confirmed');
    
    // Launch the workflow
    core.info('🎯 Launching workflow...');
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
    
    // Handle wait functionality
    if (inputs.wait) {
      core.info('⏳ Wait mode enabled - monitoring workflow status...');
      
      const waitResult = await apiClient.waitForCompletion(
        workflowData.workflowId,
        inputs.workspaceId,
        {
          maxWaitTime: 30 * 60 * 1000, // 30 minutes
          pollInterval: 30 * 1000      // 30 seconds
        }
      );
      
      if (!waitResult.success) {
        throw new Error(`Wait failed: ${waitResult.error}`);
      }
      
      if (waitResult.status === 'COMPLETED') {
        core.info('🎉 Workflow completed successfully!');
      } else {
        throw new Error(`Workflow ended with status: ${waitResult.status}`);
      }
    } else {
      core.info('⚡ Launch complete - not waiting for workflow completion');
      core.info('💡 Set wait: true to monitor workflow progress');
    }
    
    core.info('🏁 Action completed successfully');
    
  } catch (error) {
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