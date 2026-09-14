# seqeralabs/action-tower-launch: Changelog

## [ 2.4.0 ]

- Stop masking the `workflowId`, `workflowUrl`, `workspaceId` and `workspaceRef` outputs in the GitHub Actions log. They are not secrets, and masking is global for the rest of the job, so a link to the Seqera Platform run rendered as `***` in job summaries and PR comments ([#48](https://github.com/seqeralabs/action-tower-launch/issues/48))
- Write a clickable link to the launched run into the GitHub Actions job summary, and print the run URL in the step log ([#48](https://github.com/seqeralabs/action-tower-launch/issues/48))
- Print the (scrubbed) Tower CLI log with a `::error::` annotation when a launch fails, so the reason is visible in the GitHub Actions log rather than only in the uploaded artifact
- Security fix: always strip `TOWER_ACCESS_TOKEN` from `tower_action_*.log`/`.json`. Scrubbing now runs from an `EXIT` trap, so it also happens when `tw launch` fails and the script aborts early
- Fix: give `tower_action_*.log` a unique name per launch. The name was previously only minute-resolution, so several launches in one job shared a log file via `/github/workspace` and one step's error dump included the other steps' output
- CI: don't fail the test job when a launch fails on any cloud. AWS and GCP are now tolerated like Azure, and the PR comment reports per-cloud status instead of special-casing Azure

## [ 2.3.0 ]

- Update Tower CLI to v0.38.0 ([#31](https://github.com/seqeralabs/action-tower-launch/pull/31))
- Rename "Nextflow Tower" to "Seqera Platform" throughout descriptions, outputs and docs; env var names and behaviour are unchanged for backwards compatibility ([#41](https://github.com/seqeralabs/action-tower-launch/pull/41))
- Security fix: `tw launch` is no longer run with `-v` by default. Verbose mode logged full HTTP request/response bodies into `tower_action_*.log`. Verbose logging is now opt-in via the new `verbose` input ([#39](https://github.com/seqeralabs/action-tower-launch/pull/39))
- CI: pin GitHub Actions to commit SHAs and fix `zizmor` security findings ([#40](https://github.com/seqeralabs/action-tower-launch/pull/40))
- CI: don't fail the whole test job when the Azure compute environment is unavailable ([#42](https://github.com/seqeralabs/action-tower-launch/pull/42))
- chore(deps): pin GitHub Actions dependencies ([#32](https://github.com/seqeralabs/action-tower-launch/pull/32))

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
