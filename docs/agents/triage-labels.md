# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the label strings this repo uses, in both places work is tracked.

| Label in mattpocock/skills | On GitHub Issues  | In the local tracker | Meaning                                  |
| -------------------------- | ----------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`    | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`      | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent` | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human` | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`         | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

On GitHub these are repo labels. In the local tracker a label is the value of the `**Status:**` line in the issue file; see `issue-tracker.md`.

## What GitHub Issues adds

A GitHub issue is also a queue an unattended agent picks from, which the local files are not. Two more label families carry what that queue needs; they have no local equivalent.

| Label                                    | Meaning                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `risk:low` / `risk:medium` / `risk:high` | How much damage a wrong unattended change could do |
| `agent:wip`                              | An agent is working on this; do not pick it up     |
| `agent:done`                             | A draft pull request is open, waiting for review   |

`risk:high` covers authentication, the push quota, data migration and the signed job routes.

## The rule an agent picks work by

An unattended agent may pick up an issue only when it carries `ready-for-agent` **and** `risk:low` and carries none of `needs-info`, `ready-for-human`, `agent:wip`. Everything else waits for a human. It never touches a `dependabot/` branch or pull request, and it never merges.
