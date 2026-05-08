# Migration Guide: v2 → v3

## Overview

Version 3.0 introduces a complete rewrite using JavaScript instead of Docker containers. This provides **99% smaller size**, **instant startup**, and **much better error messages**.

## Breaking Changes

### ⚠️ None for most users!

The JavaScript action maintains **full backward compatibility** with all existing inputs and outputs. Most workflows can upgrade with no changes:

```yaml
# Simply change the version - everything else stays the same!
- uses: seqeralabs/action-tower-launch@v3
  with:
    access_token: ${{ secrets.TOWER_ACCESS_TOKEN }}
    pipeline: https://github.com/nf-core/rnaseq
    # ... all other inputs work exactly the same
```

## What Changed

### Architecture
- **v2**: Docker container (188MB) + Tower CLI binary (87.8MB)
- **v3**: JavaScript action (~2MB) with direct API calls

### Performance
- **v2**: Container build + CLI startup time (~30-60 seconds)
- **v3**: Instant startup on GitHub runners (~2 seconds)

### Error Messages  
- **v2**: Generic "Tower CLI command failed with exit code 1"
- **v3**: Specific "HTTP 401: Invalid access token - Please check your secret"

### Debugging
- **v2**: Limited visibility into CLI internals
- **v3**: Complete HTTP request/response transparency

## New Features in v3

### Enhanced Error Messages
```
HTTP 401: Invalid access token
💡 This usually indicates an invalid or expired access token.
   Please check that your TOWER_ACCESS_TOKEN secret is valid.
```

### Better Debug Output
```yaml
- uses: seqeralabs/action-tower-launch@v3
  with:
    debug: true  # Now provides much more detailed information
    access_token: ${{ secrets.TOWER_ACCESS_TOKEN }}
```

### API Connectivity Testing
The action now tests API connectivity before attempting workflow launch, catching configuration issues early.

## Migration Steps

### 1. Update Version Reference
```yaml
# Old
- uses: seqeralabs/action-tower-launch@v2

# New  
- uses: seqeralabs/action-tower-launch@v3
```

### 2. Enable Debug Mode (Optional)
```yaml
- uses: seqeralabs/action-tower-launch@v3
  with:
    debug: true  # Get detailed troubleshooting info
    access_token: ${{ secrets.TOWER_ACCESS_TOKEN }}
```

### 3. Remove Artifact Upload (Optional)
Version 3 provides clear error messages directly in logs, so log file artifacts are no longer necessary:

```yaml
# You can remove this block - no longer needed
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: tower-debug-logs  
    path: tower_action_*.log
```

## Benefits After Migration

### 🚀 **Performance**
- **99% smaller**: 2MB vs 188MB  
- **Instant startup**: No container build time
- **Cross-platform**: Works on Windows, macOS, Linux runners

### 🐛 **Debugging**
- **HTTP status codes**: 401, 403, 404 with clear meanings
- **Specific error messages**: Know exactly what went wrong
- **API transparency**: See every request and response

### 🛠 **Maintenance**
- **Fewer dependencies**: No Docker containers to manage
- **Standard Node.js**: Uses GitHub's managed runtime
- **Better security**: No external binaries to trust

## Rollback Plan

If you encounter any issues, you can quickly rollback:

```yaml
# Rollback to v2 if needed
- uses: seqeralabs/action-tower-launch@v2
  with:
    # All the same inputs work
```

## Support

- **Issues**: Report problems at [GitHub Issues](https://github.com/seqeralabs/action-tower-launch/issues)
- **Questions**: Use the debug mode for detailed error information
- **Feature requests**: Open discussions on the repository

## Testing Your Migration

1. **Enable debug mode** for detailed output
2. **Test with existing workflow** - should work without changes  
3. **Check error messages** - now much more helpful
4. **Verify performance** - should be significantly faster

The migration should be seamless for most users while providing significant improvements in performance and debugging!