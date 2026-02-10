const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client/lib/index');

/**
 * Seqera Platform API Client
 * Handles all interactions with the Seqera Platform REST API
 */
class SeqeraPlatformAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://api.cloud.seqera.io';
    this.accessToken = options.accessToken;
    this.debug = options.debug || false;
    
    if (!this.accessToken || (typeof this.accessToken === 'string' && this.accessToken.trim() === '')) {
      throw new Error('Access token is required');
    }
    
    // Initialize HTTP client with authentication
    this.httpClient = new HttpClient('action-tower-launch', undefined, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Version': '1'
      }
    });
    
    this.debugLog('Seqera API client initialized');
    this.debugLog(`Base URL: ${this.baseUrl}`);
  }
  
  debugLog(message) {
    if (this.debug) {
      core.info(`[DEBUG] ${message}`);
    }
  }
  
  /**
   * Test API connectivity and authentication
   */
  async testConnection() {
    try {
      this.debugLog('Testing API connectivity...');
      const url = `${this.baseUrl}/service-info`;
      const response = await this.httpClient.get(url);
      
      if (response.message.statusCode >= 200 && response.message.statusCode < 300) {
        this.debugLog('API connectivity test successful');
        return { success: true, status: response.message.statusCode };
      } else {
        const body = await response.readBody();
        return { 
          success: false, 
          status: response.message.statusCode,
          error: `HTTP ${response.message.statusCode}: ${body}`
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Connection failed: ${error.message}`
      };
    }
  }
  
  /**
   * Build the launch request payload from action inputs
   */
  buildLaunchPayload(inputs) {
    const launch = {
      pipeline: inputs.pipeline
    };
    
    // Add optional parameters
    if (inputs.revision) {
      launch.revision = inputs.revision;
      this.debugLog(`Added revision: ${inputs.revision}`);
    }
    
    if (inputs.workdir) {
      launch.workDir = inputs.workdir;
      this.debugLog(`Added workDir: ${inputs.workdir}`);
    }
    
    if (inputs.runName) {
      // Replace colons with underscores as per original implementation
      launch.runName = inputs.runName.replace(/:/g, '_');
      this.debugLog(`Added runName: ${launch.runName}`);
    }
    
    if (inputs.computeEnv) {
      launch.computeEnvId = inputs.computeEnv;
      this.debugLog(`Added computeEnvId: ${inputs.computeEnv}`);
    }
    
    if (inputs.profiles) {
      // Convert comma-separated string to array for configProfiles field
      const profilesArray = inputs.profiles.split(',').map(profile => profile.trim()).filter(profile => profile.length > 0);
      if (profilesArray.length > 0) {
        launch.configProfiles = profilesArray;
        this.debugLog(`Added configProfiles: ${profilesArray.join(', ')}`);
      }
    }
    
    // Handle parameters JSON
    // Only set launch.params if we have meaningful parameters to override
    // This prevents overriding profile-defined parameters (like 'input' from test profiles)
    if (inputs.parameters) {
      try {
        const params = JSON.parse(inputs.parameters);
        // Use paramsText instead of params - Tower creates ephemeral params file
        // This ensures proper parameter precedence with Nextflow profiles
        launch.paramsText = JSON.stringify(params);
        this.debugLog(`Added paramsText (${Object.keys(params).length} keys)`);
        
        // Log if we're setting any parameters that commonly come from profiles
        const profileCommonParams = ['input', 'genome'];
        const profileOverrides = Object.keys(params).filter(key => profileCommonParams.includes(key));
        if (profileOverrides.length > 0) {
          this.debugLog(`Note: Overriding profile parameters: ${profileOverrides.join(', ')}`);
        }
      } catch (error) {
        throw new Error(`Invalid parameters JSON: ${error.message}`);
      }
    }
    
    // Handle Nextflow config
    if (inputs.nextflowConfig) {
      launch.nextflowConfig = inputs.nextflowConfig;
      this.debugLog(`Added nextflowConfig (${inputs.nextflowConfig.length} chars)`);
    }
    
    // Handle pre-run script
    if (inputs.preRunScript) {
      launch.preRunScript = inputs.preRunScript;
      this.debugLog(`Added preRunScript (${inputs.preRunScript.length} chars)`);
    }
    
    // Handle labels - API expects array of objects with name field
    if (inputs.labels) {
      const labelsArray = inputs.labels.split(',').map(label => label.trim()).filter(label => label.length > 0);
      if (labelsArray.length > 0) {
        launch.labelIds = labelsArray.map(name => ({ name }));
        this.debugLog(`Added labels: ${labelsArray.join(', ')}`);
      }
    }
    
    return { launch };
  }
  
  /**
   * Launch a workflow on Seqera Platform
   */
  async launchWorkflow(inputs) {
    try {
      // Build the API URL
      let url = `${this.baseUrl}/workflow/launch`;
      if (inputs.workspaceId) {
        url += `?workspaceId=${inputs.workspaceId}`;
        this.debugLog(`Added workspace ID: ${inputs.workspaceId}`);
      }
      
      // Build the request payload
      const payload = this.buildLaunchPayload(inputs);
      const payloadJson = JSON.stringify(payload);
      
      this.debugLog(`Launch URL: ${url}`);
      this.debugLog(`Payload size: ${payloadJson.length} chars`);
      
      // Make the API request
      this.debugLog('Making launch API request...');
      const response = await this.httpClient.post(url, payloadJson);
      const statusCode = response.message.statusCode;
      const body = await response.readBody();
      
      this.debugLog(`HTTP Status: ${statusCode}`);
      this.debugLog(`Response body length: ${body.length} chars`);
      
      // Handle non-success status codes
      if (statusCode < 200 || statusCode >= 300) {
        let errorMessage = `HTTP ${statusCode}`;
        
        // Try to extract error message from JSON response
        try {
          const errorResponse = JSON.parse(body);
          if (errorResponse.message) {
            errorMessage = errorResponse.message;
          } else if (errorResponse.error) {
            errorMessage = errorResponse.error;
          }
        } catch (parseError) {
          // If not JSON, use the raw body
          errorMessage = body || errorMessage;
        }
        
        return {
          success: false,
          statusCode,
          error: errorMessage,
          details: body
        };
      }
      
      // Parse successful response
      try {
        const responseData = JSON.parse(body);
        
        // Validate required fields
        if (!responseData.workflowId) {
          return {
            success: false,
            error: 'Missing workflowId in API response',
            details: 'This usually indicates the pipeline submission was rejected'
          };
        }
        
        this.debugLog(`Workflow launched successfully: ${responseData.workflowId}`);
        
        return {
          success: true,
          statusCode,
          data: responseData
        };
        
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid JSON response from API',
          details: `Parse error: ${parseError.message}`
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: `Launch request failed: ${error.message}`,
        details: error.stack
      };
    }
  }
  
  /**
   * Get current user info (for URL construction)
   */
  async getUserInfo() {
    try {
      const url = `${this.baseUrl}/user-info`;
      const response = await this.httpClient.get(url);
      const statusCode = response.message.statusCode;
      const body = await response.readBody();
      
      if (statusCode >= 200 && statusCode < 300) {
        const data = JSON.parse(body);
        return { success: true, data: data.user || data };
      } else {
        return { success: false, error: `HTTP ${statusCode}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get workflow status (for wait functionality)
   */
  async getWorkflowStatus(workflowId, workspaceId) {
    try {
      let url = `${this.baseUrl}/workflow/${workflowId}`;
      if (workspaceId) {
        url += `?workspaceId=${workspaceId}`;
      }
      
      this.debugLog(`Getting workflow status: ${url}`);
      const response = await this.httpClient.get(url);
      const statusCode = response.message.statusCode;
      const body = await response.readBody();
      
      if (statusCode >= 200 && statusCode < 300) {
        const data = JSON.parse(body);
        return {
          success: true,
          data: data
        };
      } else {
        return {
          success: false,
          statusCode,
          error: `Failed to get workflow status: HTTP ${statusCode}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Status request failed: ${error.message}`
      };
    }
  }
  
  /**
   * Poll workflow status until completion (for wait functionality)
   */
  async waitForCompletion(workflowId, workspaceId, options = {}) {
    const maxWaitTime = options.maxWaitTime || 6 * 60 * 60 * 1000; // 6 hours
    const pollInterval = options.pollInterval || 30 * 1000; // 30 seconds
    const startTime = Date.now();
    
    core.info(`Waiting for workflow completion: ${workflowId}`);
    
    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getWorkflowStatus(workflowId, workspaceId);
      
      if (!result.success) {
        return result;
      }
      
      const status = result.data.workflow?.status || result.data.status;
      core.info(`Workflow status: ${status}`);
      
      // Check if workflow is complete
      if (status === 'COMPLETED' || status === 'SUCCEEDED') {
        return { success: true, status: 'COMPLETED', data: result.data };
      } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'ABORTED') {
        return { success: false, status, data: result.data, error: `Workflow ${status.toLowerCase()}` };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    return {
      success: false,
      error: 'Workflow wait timeout exceeded',
      details: `Waited ${maxWaitTime / 1000} seconds`
    };
  }
}

module.exports = { SeqeraPlatformAPI };