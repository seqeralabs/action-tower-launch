# seqeralabs/action-tower-launch: Changelog

## [ 3.0.0 ] - 2024-XX-XX

**BREAKING CHANGE: Complete architectural rewrite**

### Major Changes
- **Architecture**: Complete rewrite from Docker-based Tower CLI to native JavaScript action using Seqera Platform REST API
- **Runtime**: Changed from `runs: docker` to `runs: node20` for faster startup and better integration
- **API**: Direct REST API integration replacing Tower CLI dependency
- **Performance**: Significantly improved startup time by eliminating container initialization overhead

### New Features
- **Enhanced Error Handling**: Structured error messages with detailed troubleshooting guidance
- **Debug Mode**: Comprehensive debug logging with `debug: true` input
- **Improved Wait Functionality**: Native workflow status monitoring with configurable timeouts
- **Better Secret Management**: Native GitHub Actions secret masking using `@actions/core`
- **API Connectivity Testing**: Built-in connection validation before workflow launch
- **Input Validation**: Enhanced parameter validation with helpful error messages

### Technical Improvements
- **Modern JavaScript**: ES6+ with async/await patterns
- **HTTP Client**: Native `@actions/http-client` replacing curl commands
- **Testing Framework**: Comprehensive test suite using Vitest with coverage reporting
- **Code Quality**: ESLint integration with CI/CD pipeline
- **Build Process**: Webpack bundling via `@vercel/ncc` for optimized distribution

### Compatibility
- **Backward Compatible**: All inputs and outputs maintain compatibility with v2.x
- **Legacy Support**: Docker-based approach still available via separate entry points
- **Migration Path**: Seamless upgrade for existing workflows

### Dependencies
- **Added**: `@actions/core@^1.10.1`, `@actions/http-client@^2.2.1`
- **Removed**: Tower CLI binary dependency, Alpine Linux container dependency
- **Dev Dependencies**: Vitest, ESLint, @vercel/ncc for modern development workflow

### Migration Notes
- No changes required for existing workflow files
- `debug: true` now provides much more detailed logging
- Error messages include specific troubleshooting steps
- Faster execution due to elimination of Docker overhead

## [ 2.1.2 ]

- Add testing for all three cloud providers ([#19](https://github.com/seqeralabs/action-tower-launch/pull/19))
- Update Tower CLI to v0.9.1 ([#20](https://github.com/seqeralabs/action-tower-launch/pull/20))

## [ 2.1.1 ]

- Revert Tower CLI to v0.8.0 ([#17](https://github.com/seqeralabs/action-tower-launch/pull/17))

## [ 2.1.0 ]

- Update Tower CLI to v0.9.0 ([#16](https://github.com/seqeralabs/action-tower-launch/pull/16))

## [ 2.0.0 ]

- Update Tower CLI to v0.8.0 ([#11](https://github.com/seqeralabs/action-tower-launch/pull/11))
- Fix: Output JSON file not base64 encoded
- Fix: Additional underscore from log removed
- Feature: Additional comment to PR if launching fails

## [ 0.7.3 ]

- Feature: Action will now fail if pipeline submission fails ([#2](https://github.com/seqeralabs/action-tower-launch/pull/2))

## [ 0.7.2 ]

- Feature: Add outputs to action [#3](https://github.com/seqeralabs/action-tower-launch/pull/3)
- CI/CD: Add default test run to confirm correct running [#4](https://github.com/seqeralabs/action-tower-launch/pull/4)
- Fix: Remove quotes from output strings [#5](https://github.com/seqeralabs/action-tower-launch/pull/5)
- Docs: Simplify README.md [#6](https://github.com/seqeralabs/action-tower-launch/pull/6)
- Fix: Only run comment-pull-request if CI/CD was triggered by a pull_request[#7](https://github.com/seqeralabs/action-tower-launch/pull/7)

## [[Version 1.0](https://github.com/seqeralabs/action-tower-launch/releases/tag/1.0)] - 2023-03-28

Repository moved to [seqeralabs/action-tower-launch](https://github.com/seqeralabs/action-tower-launch).
See the [changelog](https://github.com/seqeralabs/tower-action/blob/main/CHANGELOG.md) in the nf-core repository for previous versions.
