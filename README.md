# seqeralabs/action-seqera-launch

**A GitHub Action to launch a workflow using [Seqera Platform](https://seqera.io) (formerly Nextflow Tower).**

This action uses the Seqera Platform REST API directly for fast, reliable workflow launches.

> **✨ Version 3.0+**: Now a lightweight JavaScript action! No more Docker containers - 99% smaller and instant startup.

Contributed with ❤️ from the [@nf-core](https://github.com/nf-core/) community.

## Example usage

### Minimal example

This runs the current GitHub repository pipeline on [Seqera Platform](https://cloud.seqera.io) at the current commit hash when pushed to the `dev` branch. The workflow runs on the user's personal workspace.

```yaml
on:
  push:
    branches: [dev]

jobs:
  run-seqera:
    runs-on: ubuntu-latest
    steps:
      - uses: seqeralabs/action-seqera-launch@v1
        # Use repository secrets for sensitive fields
        with:
          access_token: ${{ secrets.SEQERA_ACCESS_TOKEN }}
```

### Complete example

This example never runs automatically, but creates a button under the GitHub repository _Actions_ tab that can be used to manually trigger the workflow.

It runs on a specified installation of Seqera Platform, with a specific organisation workspace. It also calls an external pipeline to be run at a pinned version tag.

The `--outdir` parameter is used to save results to a separate directory in the AWS bucket and the pipeline uses two config profiles.

```yaml
name: Launch on Seqera Platform

# Manually trigger the action with a button in GitHub
# Alternatively, trigger on release / push etc.
on:
  workflow_dispatch:

jobs:
  run-seqera:
    name: Launch on Seqera Platform
    # Don't try to run on forked repos
    if: github.repository == 'YOUR_USERNAME/REPO'
    runs-on: ubuntu-latest
    steps:
      - uses: seqeralabs/action-seqera-launch@v1
        # Use repository secrets for sensitive fields
        with:
          workspace_id: ${{ secrets.SEQERA_WORKSPACE_ID }}
          access_token: ${{ secrets.SEQERA_ACCESS_TOKEN }}
          api_endpoint: ${{ secrets.SEQERA_API_ENDPOINT }}
          compute_env: ${{ secrets.SEQERA_COMPUTE_ENV }}
          pipeline: YOUR_USERNAME/REPO
          revision: v1.2.1
          run_name: ${{ github.job }}_${{ github.run_attempt }}
          workdir: ${{ secrets.AWS_S3_BUCKET }}/work/${{ github.sha }}
          # Set any custom pipeline params here - JSON object as a string
          parameters: |
            {
                "outdir": "${{ secrets.AWS_S3_BUCKET }}/results/${{ github.sha }}"
            }
          # List of pipeline config profiles to use - comma separated list as a string
          profiles: test,aws_seqera

      - uses: actions/upload-artifact@v3
        with:
          name: ${{ needs.getdate.outputs.date }}_run_logs
          path: |
            seqera_action_*.log
            seqera_action_*.json
```

## Inputs

Please note that a number of these inputs are sensitive and should be kept secure. We recommend saving them as appropriate using GitHub repository [encrypted secrets](https://docs.github.com/en/actions/reference/encrypted-secrets). They can then be accessed with `${{ secrets.SECRET_NAME }}` in your GitHub actions workflow.

Note that if you are using secrets, these will be screened in the GitHub Actions log and appear as `***`.

### `access_token`

**[Required]** Seqera Platform personal access token.

Visit <https://cloud.seqera.io/tokens> to generate a new access token.

See the [Seqera Platform documentation for more details](https://docs.seqera.io/platform/latest/getting-started/):

> **Note:** For backward compatibility, you can still use `secrets.TOWER_ACCESS_TOKEN`, but we recommend updating to `secrets.SEQERA_ACCESS_TOKEN`.

![workspace ID](img/usage_create_token.png)
![workspace ID](img/usage_name_token.png)
![workspace ID](img/usage_token.png)

### `workspace_id`

**[Optional]** Seqera Platform workspace ID.

Seqera Platform organisations can have multiple _Workspaces_. Use this field to choose a specific workspace.

Default: Your personal user's workspace.

Your Workspace ID can be found in the organisation's _Workspaces_ tab:

![workspace ID](img/workspace_id.png)

Default: Your primary workspace.

### `compute_env`

**[Optional]** Seqera Platform compute environment name _(not ID)_.

Default: Your primary compute environment.

### `api_endpoint`

**[Optional]** Seqera Platform API URL endpoint.

Default: `api.cloud.seqera.io`

### `pipeline`

**[Optional]** Workspace pipeline name or full pipeline URL.

For example, `https://github.com/nf-core/sarek`.
Can also be the name of a preconfigured pipeline in Seqera Platform.

Default: The current GitHub repository (`https://github.com/${{github.repository}}`).

### `revision`

**[Optional]** Pipeline revision.

A pipeline release tag, branch or commit hash.

Default: The revision specified in Seqera Platform or the default branch of the repo.

### `workdir`

**[Optional]** Nextflow work directory.

The location that temporary working files should be stored. Must be accessible in the Seqera Platform compute environment used.

### `parameters`

**[Optional]** Pipeline parameters.

Additional pipeline parameters.

These should be supplied as a valid JSON object, quoted as a string in your GitHub Actions workflow. See example usage above for an example.

> JSON is required (not YAML) because we do some parsing and dumping to ensure that the action handles multi-line string formatting correctly.

### `profiles`

**[Optional]** Nextflow config profiles.

Pipeline config profiles to use. Should be comma separated without spaces.

### `run_name`

**[Optional]** Seqera Platform run name

Provide a name for the run in Seqera Platform.

### `nextflow_config`

**[Optional]** Nextflow config options.

Useful to pass custom Nextflow config options to the `tw launch` command e.g.

```yaml
jobs:
  run-seqera:
    steps:
      - uses: seqeralabs/action-seqera-launch@v1
        with:
          nextflow_config: |
            process.errorStrategy = 'retry'
            process.maxRetries = 3
          # Truncated..
```

### `pre_run_script`

**[Optional]** Pre-run script before launch.

Pre-run script executed before pipeline launch. This would be particularly useful if you wanted to use a different version of Nextflow than the default available in Seqera Platform. You can set this in the pipeline Github Actions:

```yaml
jobs:
  run-seqera:
    steps:
      - uses: seqeralabs/action-seqera-launch@v1
        with:
          pre_run_script: "export NXF_VER=21.10.3"
          # Truncated..
```

### `wait`

**[Optional]** Set GitHub action to wait for pipeline completion

The default setting is for GitHub actions to wait until a pipeline runs to completion. If you want GitHub actions to launch the workflow and then finish you can set the wait to false:

```yaml
jobs:
  run-seqera:
    steps:
      - uses: nf-core/tower-action@v2
        with:
          wait: false
          # Truncated..
```

### `debug`

**[Optional]** Enable debug logging for troubleshooting

Enable detailed debug logging to help troubleshoot issues with the action. When enabled, the action will output additional information about environment variables, Seqera CLI commands, and API connectivity.

```yaml
jobs:
  run-seqera:
    steps:
      - uses: seqeralabs/action-seqera-launch@v2
        with:
          debug: true
          # Truncated..
```

## Outputs

### Output variables

The action creates the output variable `json` which is a JSON string of metadata created by the Seqera Platform API. It looks like this and can be parsed using the built in `fromJSON()` method.

```
{
  "workflowId" : "7f061c344df044",
  "workflowUrl" : "https://cloud.seqera.io/orgs/myorg/workspaces/myworkspace/watch/7f061c344df044",
  "workspaceId" : 123456789,
  "workspaceRef" : "[myorg / myworkspace]"
}
```

In addition, each variable is available as a separate output available under the following IDs:

- `workflowId`
- `workflowUrl`
- `workspaceId`
- `workspaceRef`

From the example above, we can now extend it to use the output variables in downstream steps and jobs. In this example we use the output variables twice:

- We capture the output variables of the _step_ and use it as an output of the _job_. We then use it in a second job.
- We use the outputs in a following step where we echo them to the console.

```yaml
on:
  pull_request:
  push:
    branches: [dev]

jobs:
  run-seqera:
    runs-on: ubuntu-latest
    # Capture action outputs as outputs for the job
    outputs:
      workflow_id: ${{ steps.run.outputs.workflowId }}
      workspace_id: ${{ steps.run.outputs.workspaceId }}
    steps:
      - uses: seqeralabs/action-seqera-launch@v1
        with:
          access_token: ${{ secrets.SEQERA_ACCESS_TOKEN }}

      - name: Comment PR
        uses: thollander/actions-comment-pull-request@v2
        with:
          message: |
            Pipeline launched, monitor progress [here](${{ steps.runs.outputs.workflowUrl }})
            Details:
              - Workflow ID: ${{ steps.runs.outputs.workflowId }}
              - Workspace: ${{ steps.runs.outputs.WorkspaceRef }}
              - Workspace ID: ${{ steps.runs.outputs.workspaceId }}
              - Workflow URL: ${{ steps.runs.outputs.workflowUrl }}
          comment_tag: seqerarun

      # Capture JSON + logs and save as artifacts
      - uses: actions/upload-artifact@v3
        if: success() || failure()
        with:
          name: ${{ needs.getdate.outputs.date }}_run_logs
          path: |
            seqera_action_*.log
            seqera_action_*.json

  # We install the Seqera CLI and use the variables to get the details of the pipeline run.
  get_details:
    runs-on: ubuntu-latest
    needs: [run-seqera]
    steps:
      - name: Get run details
        run: |
          # Install TW CLI
          wget -L https://github.com/seqeralabs/tower-cli/releases/download/v0.7.3/tw-0.7.3-linux-x86_64
          sudo mv tw-* /usr/local/bin/tw
          chmod +x /usr/local/bin/tw

          # Use variables with ${{ needs.id.outputs.variable }} syntax
          tw -o json runs view \
             -w ${{ needs.run-seqera.outputs.workspace_id }} \
             -i ${{ needs.run-seqera.outputs.workflow_id }}
```

### Files

The action prints normal stdout info-level log messages to the actions console. However, it also saves a verbose log file and an output JSON of job details as a file. We recommend using [`actions/upload-artifact`](https://github.com/actions/upload-artifact) in your GitHub Actions workflow as shown in the examples above, this will then expose this file to be used in subsequent jobs and as a download through the workflow summary page.

The output log file is saved as `seqera_action_$(timestamp).log` and can be captured using `actions/upload-artifact using the following settings:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: Seqera debug log file
    path: seqera_action_*.log
```

The action writes a JSON file which has the same format as the `outputs.json` used above. This is wrtten to a file called `seqera_action_$(uuidgen).json`. It can be captured in a similar manner:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: Seqera output JSON file
    path: seqera_action_*.json
```

## Troubleshooting

### Action fails silently or with unclear errors

Enable debug logging to get detailed information about what's happening:

```yaml
- uses: seqeralabs/action-seqera-launch@v2
  with:
    debug: true
    access_token: ${{ secrets.SEQERA_ACCESS_TOKEN }}
    # ... other inputs
```

### Common issues and solutions

1. **"HTTP 401: Invalid access token"** - Check that your access token is valid and has the necessary permissions
2. **"HTTP 403: Insufficient permissions"** - Verify workspace permissions and compute environment access
3. **"HTTP 404: Not found"** - Check the pipeline URL and workspace ID are correct
4. **"API connectivity test failed"** - Verify the `api_endpoint` is correct and reachable
5. **"Missing or null workflowId"** - The API may have returned an error; check the debug logs

### Debug information

The JavaScript action provides comprehensive debug information when `debug: true` is set:

- **API connectivity tests** - Verifies connection to Seqera Platform
- **Input validation** - Checks all parameters before sending to API  
- **HTTP request/response details** - Full transparency into API calls
- **Clear error messages** - Specific guidance for common issues

Example debug output:
```
🐛 Debug mode enabled
Pipeline: https://github.com/nf-core/hello  
API Endpoint: https://api.cloud.seqera.io
🔗 Testing API connectivity...
✅ API connectivity confirmed
🎯 Launching workflow...
[DEBUG] Launch URL: https://api.cloud.seqera.io/workflow/launch
[DEBUG] HTTP Status: 200
✅ Workflow launched successfully!
```

## Credits

This GitHub Action was written by Phil Ewels ([@ewels](https://github.com/ewels)), with help from and based on earlier work by Gisela Gabernet ([@ggabernet](https://github.com/ggabernet)).
