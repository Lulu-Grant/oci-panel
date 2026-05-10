# OCI Native Operations Research - 2026-05-10

This note records the replacement path for the removed SSH/DD reinstall runtime. The goal is to keep advanced operations inside OCI-native, auditable APIs.

## Baseline Decision

- Do not restore SSH credential input, host password input, or arbitrary custom-image DD execution.
- Keep the Instances UI at "OCI managed capability detection" until a real managed instance is validated.
- Treat OS Management Hub as the first candidate for safe managed operations.

## SDK Surface Found Locally

The installed `oci-sdk` package exposes OS Management Hub clients through `oci.osmanagementhub`.

Current helper coverage:

- `src/lib/oci.ts` already provides `createOsManagementHubManagedInstanceClient(account)`.
- `src/lib/oci.ts` already provides `createOsManagementHubScheduledJobClient(account)`.

Relevant Managed Instance methods from `node_modules/oci-osmanagementhub/lib/client.d.ts`:

- `listManagedInstances`
- `getManagedInstance`
- `installPackagesOnManagedInstance`
- `updatePackagesOnManagedInstance`
- `rebootManagedInstance`

Relevant Scheduled Job methods:

- `createScheduledJob`
- `getScheduledJob`
- `listScheduledJobs`
- `updateScheduledJob`
- `deleteScheduledJob`

Relevant models:

- `CreateScheduledJobDetails`
- `ScheduledJobOperation`
- `ScheduleTypes.Onetime`
- `OperationTypes.UpdatePackages`
- `OperationTypes.UpdateSecurity`
- `OperationTypes.Reboot`
- `UpdatePackagesOnManagedInstanceDetails`
- `RebootManagedInstanceDetails`

## Smallest Safe Product Path

The smallest safe implementation should be staged as read-only first:

1. Keep the current capability endpoint as the entry point:
   - account must be active
   - user must own the account
   - response must use the standard API envelope
   - no SSH, host password, private key, or custom image fields are accepted

2. Validate managed instance matching against a real OCI account:
   - compare Compute instance OCID with `listManagedInstances({ managedInstanceId })`
   - if that is insufficient, test `displayName`, compartment, and OS Management Hub metadata matching
   - record whether the managed instance ID equals the Compute instance OCID in the tested tenancy

3. Expand capability details only after matching is verified:
   - managed instance ID
   - display name
   - lifecycle/status
   - OS family/architecture if returned by the SDK
   - whether reboot/update actions appear eligible

4. Add a task preview endpoint before any write operation:
   - action type: security update, full package update, reboot
   - target managed instance ID
   - generated request body
   - explicit "not submitted" status

5. Add write submission only after one verified tenant:
   - one-time Scheduled Job is preferred for auditability
   - use `ScheduleTypes.Onetime`
   - target `managedInstanceIds: [managedInstanceId]`
   - operation is one of `UpdateSecurity`, `UpdatePackages`, or `Reboot`
   - store operation log with work request/job ID

## Candidate One-Time Scheduled Job Shape

This is a research shape, not currently wired into runtime:

```ts
{
  createScheduledJobDetails: {
    compartmentId,
    displayName: "oci-panel-managed-operation",
    description: "Submitted by OCI Panel",
    scheduleType: "ONETIME",
    timeNextExecution: new Date(Date.now() + 2 * 60 * 1000),
    managedInstanceIds: [managedInstanceId],
    operations: [
      { operationType: "UPDATE_SECURITY" }
    ]
  }
}
```

For reboot:

```ts
{
  operations: [
    { operationType: "REBOOT", rebootTimeoutInMins: 30 }
  ]
}
```

## Current Runtime Status

- SSH/DD runtime endpoint is removed.
- Instances page exposes capability detection only.
- No runtime endpoint currently submits OS Management Hub jobs.
- The next implementation step is real-account validation of managed instance matching, not task submission.

