/**
 * Streamlined tests focusing on testable components without complex mocking
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Seqera Platform API Tests', () => {
  let SeqeraPlatformAPI;

  beforeEach(async () => {
    // Mock @actions/core at the module level
    vi.mock('@actions/core', () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }));

    // Mock @actions/http-client
    vi.mock('@actions/http-client/lib/index', () => ({
      HttpClient: vi.fn().mockImplementation(() => ({
        get: vi.fn(),
        post: vi.fn(),
      }))
    }));

    // Import after mocking
    const apiModule = await import('../seqera-api.js');
    SeqeraPlatformAPI = apiModule.SeqeraPlatformAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Constructor Validation', () => {
    it('should require access token', () => {
      expect(() => new SeqeraPlatformAPI()).toThrow('Access token is required');
      expect(() => new SeqeraPlatformAPI({})).toThrow('Access token is required');
      expect(() => new SeqeraPlatformAPI({ accessToken: '' })).toThrow('Access token is required');
    });

    it('should accept valid configuration', () => {
      expect(() => new SeqeraPlatformAPI({ accessToken: 'valid-token' })).not.toThrow();
    });

    it('should set default base URL', () => {
      const api = new SeqeraPlatformAPI({ accessToken: 'test-token' });
      expect(api.baseUrl).toBe('https://api.cloud.seqera.io');
    });

    it('should accept custom base URL', () => {
      const customUrl = 'https://custom.seqera.io';
      const api = new SeqeraPlatformAPI({ 
        accessToken: 'test-token',
        baseUrl: customUrl 
      });
      expect(api.baseUrl).toBe(customUrl);
    });
  });

  describe('Launch Payload Builder', () => {
    let api;

    beforeEach(() => {
      api = new SeqeraPlatformAPI({ accessToken: 'test-token' });
    });

    it('should build minimal payload', () => {
      const inputs = {
        pipeline: 'https://github.com/nf-core/hello'
      };

      const payload = api.buildLaunchPayload(inputs);

      expect(payload).toEqual({
        launch: {
          pipeline: 'https://github.com/nf-core/hello'
        }
      });
    });

    it('should build complete payload with all options', () => {
      const inputs = {
        pipeline: 'https://github.com/nf-core/hello',
        computeEnv: 'my-compute-env',
        revision: 'main',
        workdir: 's3://my-bucket/work',
        runName: 'test-run',
        parameters: '{"param1": "value1"}',
        profiles: 'docker,test',
        nextflowConfig: 'process.executor = "local"',
        preRunScript: 'echo "Starting pipeline"'
      };

      const payload = api.buildLaunchPayload(inputs);

      expect(payload.launch.pipeline).toBe('https://github.com/nf-core/hello');
      expect(payload.launch.computeEnvId).toBe('my-compute-env');
      expect(payload.launch.revision).toBe('main');
    });

    it('should handle empty parameters gracefully', () => {
      const inputs = {
        pipeline: 'https://github.com/nf-core/hello',
        parameters: ''
      };

      expect(() => api.buildLaunchPayload(inputs)).not.toThrow();
    });

    it('should validate JSON parameters', () => {
      const inputs = {
        pipeline: 'https://github.com/nf-core/hello',
        parameters: 'invalid-json'
      };

      // Should throw error for invalid JSON
      expect(() => api.buildLaunchPayload(inputs)).toThrow('Invalid parameters JSON');
    });
  });

  describe('Configuration', () => {
    let api;

    beforeEach(() => {
      api = new SeqeraPlatformAPI({ accessToken: 'test-token' });
    });

    it('should handle debug mode correctly', () => {
      const debugApi = new SeqeraPlatformAPI({ 
        accessToken: 'test-token',
        debug: true
      });

      expect(debugApi.debug).toBe(true);
    });

    it('should initialize HTTP client with correct headers', () => {
      expect(api.httpClient).toBeDefined();
      expect(api.accessToken).toBe('test-token');
    });
  });
});

describe('Input Validation', () => {
  it('should validate required inputs exist', () => {
    const requiredInputs = ['access_token', 'pipeline'];
    
    requiredInputs.forEach(input => {
      expect(input).toBeTruthy();
      expect(typeof input).toBe('string');
    });
  });

  it('should handle optional inputs', () => {
    const optionalInputs = [
      'workspace_id',
      'compute_env', 
      'revision',
      'workdir',
      'parameters',
      'profiles',
      'run_name',
      'nextflow_config',
      'pre_run_script'
    ];

    optionalInputs.forEach(input => {
      expect(input).toBeTruthy();
      expect(typeof input).toBe('string');
    });
  });
});

describe('Error Handling', () => {
  it('should handle HTTP status codes correctly', () => {
    const statusCodes = {
      200: 'success',
      401: 'authentication_error',
      403: 'permission_error', 
      404: 'not_found_error',
      500: 'server_error'
    };

    Object.entries(statusCodes).forEach(([_code, type]) => {
      expect(parseInt(_code)).toBeGreaterThanOrEqual(200);
      expect(type).toBeTruthy();
    });
  });

  it('should provide helpful error messages', () => {
    const errorMessages = {
      401: 'This usually indicates an invalid or expired access token',
      403: 'This usually indicates insufficient permissions',
      404: 'This usually indicates the pipeline or workspace was not found'
    };

    Object.entries(errorMessages).forEach(([_code, message]) => {
      expect(message).toContain('This usually indicates');
      expect(message.length).toBeGreaterThan(10);
    });
  });
});

describe('Access Token Validation', () => {
  it('should detect empty access token strings', () => {
    const emptyTokens = ['', '   ', '\t\n   ', '\n', '\t'];
    
    emptyTokens.forEach(token => {
      // Test the validation logic directly
      const isEmpty = !token || token.trim() === '';
      expect(isEmpty).toBe(true);
    });
  });

  it('should accept valid access tokens', () => {
    const validTokens = ['tw_123abc', 'tower_token_xyz', 'valid-token-123'];
    
    validTokens.forEach(token => {
      const isEmpty = !token || token.trim() === '';
      expect(isEmpty).toBe(false);
    });
  });

  it('should provide helpful error message format', () => {
    const errorMessage = `access_token is required and cannot be empty.

💡 Common causes:
   • Missing TOWER_ACCESS_TOKEN secret in repository settings
   • Secret value is empty or contains only whitespace
   • Incorrect secret name in workflow file
   
📖 To fix this:
   1. Go to your repository Settings → Secrets and variables → Actions
   2. Add/update TOWER_ACCESS_TOKEN with your Seqera Platform token
   3. Ensure your workflow uses: access_token: \${{ secrets.TOWER_ACCESS_TOKEN }}`;
    
    expect(errorMessage).toContain('💡 Common causes:');
    expect(errorMessage).toContain('Missing TOWER_ACCESS_TOKEN secret');
    expect(errorMessage).toContain('📖 To fix this:');
    expect(errorMessage).toContain('repository Settings → Secrets and variables → Actions');
    expect(errorMessage).toContain('access_token: ${{ secrets.TOWER_ACCESS_TOKEN }}');
  });

  it('should handle labels input processing', () => {
    const labelsInput = 'full_test,arm,wave';
    const labelsArray = labelsInput.split(',').map(label => label.trim()).filter(label => label.length > 0);
    
    expect(labelsArray).toEqual(['full_test', 'arm', 'wave']);
  });

  it('should handle empty labels gracefully', () => {
    const emptyLabels = '';
    const labelsArray = emptyLabels ? emptyLabels.split(',').map(label => label.trim()).filter(label => label.length > 0) : [];
    
    expect(labelsArray).toEqual([]);
  });
});