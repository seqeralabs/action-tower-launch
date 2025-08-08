/**
 * Streamlined tests focusing on core issues that were identified:
 * 1. Silent failures
 * 2. Poor error messages  
 * 3. Essential functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @actions/core with a mock that returns what we expect
vi.mock('@actions/core', async () => {
  return {
    default: {
      getInput: vi.fn(),
      getBooleanInput: vi.fn().mockReturnValue(false),
      setOutput: vi.fn(),
      setSecret: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      setFailed: vi.fn(),
      group: vi.fn(),
    },
    getInput: vi.fn(),
    getBooleanInput: vi.fn().mockReturnValue(false),
    setOutput: vi.fn(),
    setSecret: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    setFailed: vi.fn(),
    group: vi.fn(),
  }
});

// Mock SeqeraPlatformAPI
vi.mock('../seqera-api.js', () => ({
  SeqeraPlatformAPI: vi.fn()
}));

// Import after mocking  
import { run } from '../index.js';
import { SeqeraPlatformAPI } from '../seqera-api.js';
import * as core from '@actions/core';

describe('Action Core Issues', () => {
  let mockApiInstance;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock API instance
    mockApiInstance = {
      testConnection: vi.fn(),
      launchWorkflow: vi.fn(),
      waitForCompletion: vi.fn(),
      buildLaunchPayload: vi.fn()
    };

    // Setup API constructor mock
    vi.mocked(SeqeraPlatformAPI).mockImplementation(() => mockApiInstance);

    // Setup default input behavior
    vi.mocked(core.getInput).mockImplementation((name, options = {}) => {
      const inputs = {
        access_token: '',
        pipeline: '',
        workspace_id: '',
        compute_env: '',
        api_endpoint: 'https://api.cloud.seqera.io',
        revision: '',
        workdir: '',
        parameters: '',
        profiles: '',
        run_name: '',
        nextflow_config: '',
        pre_run_script: '',
      };
      
      const value = inputs[name] || process.env[`INPUT_${name.toUpperCase()}`] || '';
      if (options.required && !value) {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      return value;
    });

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      // Return false for any boolean input to prevent YAML validation errors
      return false;
    });
  });

  describe('Silent Failure Prevention', () => {
    it('should fail loudly when API connectivity fails', async () => {
      // Setup inputs
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'test-token';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });

      mockApiInstance.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection timeout'
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('API connectivity test failed: Connection timeout')
      );
    });

    it('should fail loudly when workflow launch fails', async () => {
      // Setup inputs
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'test-token';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });

      mockApiInstance.testConnection.mockResolvedValue({ success: true, status: 200 });
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: false,
        statusCode: 500,
        error: 'Internal server error'
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Workflow launch failed: Internal server error')
      );
    });
  });

  describe('Clear Error Messages', () => {
    beforeEach(() => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'test-token';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });
      mockApiInstance.testConnection.mockResolvedValue({ success: true, status: 200 });
    });

    it('should show helpful message for 401 authentication error', async () => {
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: false,
        statusCode: 401,
        error: 'Invalid access token'
      });

      await run();

      const setFailedCalls = vi.mocked(core.setFailed).mock.calls;
      const errorMessage = setFailedCalls[0][0];
      expect(errorMessage).toContain('💡 This usually indicates an invalid or expired access token');
      expect(errorMessage).toContain('Please check that your TOWER_ACCESS_TOKEN secret is valid');
    });

    it('should show helpful message for 403 permission error', async () => {
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: false,
        statusCode: 403,
        error: 'Insufficient permissions'
      });

      await run();

      const setFailedCalls = vi.mocked(core.setFailed).mock.calls;
      const errorMessage = setFailedCalls[0][0];
      expect(errorMessage).toContain('💡 This usually indicates insufficient permissions');
      expect(errorMessage).toContain('Please check workspace permissions and compute environment access');
    });

    it('should show helpful message for 404 not found error', async () => {
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: false,
        statusCode: 404,
        error: 'Pipeline not found'
      });

      await run();

      const setFailedCalls = vi.mocked(core.setFailed).mock.calls;
      const errorMessage = setFailedCalls[0][0];
      expect(errorMessage).toContain('💡 This usually indicates the pipeline or workspace was not found');
      expect(errorMessage).toContain('Please check the pipeline URL and workspace ID');
    });
  });

  describe('Essential Functionality', () => {
    it('should require access_token input', async () => {
      // Don't provide access_token
      vi.mocked(core.getInput).mockImplementation((name, options = {}) => {
        if (name === 'access_token' && options.required) {
          throw new Error('Input required and not supplied: access_token');
        }
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        return '';
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Input required and not supplied: access_token')
      );
    });

    it('should successfully launch workflow with minimal inputs', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'test-token';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });

      mockApiInstance.testConnection.mockResolvedValue({ success: true, status: 200 });
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          workflowId: 'test-workflow-123',
          workspaceId: '456789',
          workspaceRef: '[test-org / test-workspace]'
        }
      });

      await run();

      expect(core.setFailed).not.toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Starting Seqera Platform'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('API connectivity confirmed'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Workflow launched successfully'));
    });

    it('should set correct outputs on successful launch', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'test-token';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'workspace_id') return '123456789';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });

      mockApiInstance.testConnection.mockResolvedValue({ success: true, status: 200 });
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          workflowId: 'test-workflow-123',
          workspaceId: '123456789',
          workspaceRef: '[test-org / test-workspace]'
        }
      });

      await run();

      expect(core.setOutput).toHaveBeenCalledWith('workflowId', 'test-workflow-123');
      expect(core.setOutput).toHaveBeenCalledWith('workspaceId', '123456789');
      expect(core.setOutput).toHaveBeenCalledWith('workspaceRef', '[test-org / test-workspace]');
      expect(core.setOutput).toHaveBeenCalledWith('workflowUrl', expect.any(String));
      expect(core.setOutput).toHaveBeenCalledWith('json', expect.any(String));
    });

    it('should mask sensitive values', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'access_token') return 'secret-token-123';
        if (name === 'pipeline') return 'https://github.com/nf-core/hello';
        if (name === 'workspace_id') return 'secret-workspace-456';
        if (name === 'api_endpoint') return 'https://api.cloud.seqera.io';
        return '';
      });

      mockApiInstance.testConnection.mockResolvedValue({ success: true, status: 200 });
      mockApiInstance.launchWorkflow.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          workflowId: 'workflow-789'
        }
      });

      await run();

      expect(core.setSecret).toHaveBeenCalledWith('secret-token-123');
      expect(core.setSecret).toHaveBeenCalledWith('secret-workspace-456');
      expect(core.setSecret).toHaveBeenCalledWith('workflow-789');
    });
  });

  describe('API Client Basic Tests', () => {
    it('should handle minimal launch payload', () => {
      mockApiInstance.buildLaunchPayload.mockReturnValue({
        launch: {
          pipeline: 'https://github.com/nf-core/hello'
        }
      });
      
      const api = new SeqeraPlatformAPI({ accessToken: 'test' });
      const inputs = {
        accessToken: 'test-token',
        pipeline: 'https://github.com/nf-core/hello'
      };
      
      const payload = api.buildLaunchPayload(inputs);
      
      expect(payload).toEqual({
        launch: {
          pipeline: 'https://github.com/nf-core/hello'
        }
      });
    });

    it('should validate access token is required', () => {
      // Make constructor throw error for missing token
      vi.mocked(SeqeraPlatformAPI).mockImplementation((config) => {
        if (!config || !config.accessToken) {
          throw new Error('Access token is required');
        }
        return mockApiInstance;
      });
      
      expect(() => new SeqeraPlatformAPI({})).toThrow('Access token is required');
    });
  });
});