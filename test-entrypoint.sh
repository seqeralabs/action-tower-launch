#!/bin/bash
# Test script to validate entrypoint.sh improvements

set -e

echo "=== Testing Tower Action Entrypoint Improvements ==="

# Test with missing required variables (should fail gracefully)
echo "1. Testing with minimal environment..."
export DEBUG=true
export PIPELINE="https://github.com/nf-core/hello"
export TOWER_API_ENDPOINT="https://api.cloud.seqera.io"

# Create a temporary copy for testing
cp entrypoint.sh test_entrypoint_temp.sh

# Test the debug functions
echo "2. Testing debug functions..."
bash -c '
source ./test_entrypoint_temp.sh 2>/dev/null || true
debug_log "This should show with DEBUG=true"
export DEBUG=false
debug_log "This should NOT show with DEBUG=false"
'

echo "3. Testing safe_mask function..."
bash -c '
source ./test_entrypoint_temp.sh 2>/dev/null || true
safe_mask "TEST_VAR" "secret123"
safe_mask "EMPTY_VAR" ""
'

echo "4. Testing Tower CLI availability..."
if command -v tw >/dev/null 2>&1; then
    echo "✓ Tower CLI found: $(tw --version)"
else
    echo "✗ Tower CLI not found - install it for full testing"
fi

# Clean up
rm -f test_entrypoint_temp.sh

echo "=== Basic validation complete ==="
echo "To test with real Tower credentials, set environment variables and run:"
echo "DEBUG=true ./entrypoint.sh"