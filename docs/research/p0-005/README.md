# P0-005 research track — non-confidential review material

This draft records a bounded research protocol and published literature for future Twin capability experiments. It makes no AGI, novelty, production-readiness or measured-productivity claim.

The integration base is P0-004 `98174493e4a2b242a3b8eb8385f7ac41e13ea4aa`. The repository audit found PR #5 still draft, with no independent review submissions or hosted CI checks. That head is a reproducible baseline, not an independently approved release. P0-003 remediation PR #4 has newer commits through `ce1878b5b9876da4cfd24bbb97aa66d3ceef3324`; they require integration review separately. The competing P0-002 migration must not be overlaid.

FOUNDER-OS is public. The owner expressly requested that potentially novel implementation details remain unpublished until an IP filing decision. Accordingly this PR contains **literature and protocol documents only**. Experimental implementation, raw new results and invention-review materials are not included in this public branch. Review of those materials requires a separate private channel and publication decision. This PR does not represent delivery of a public production feature.

See [literature.md](literature.md) for primary references and [protocol.md](protocol.md) for evidence standards. Existing staging instructions remain in [the P0-004 runbook](../../assurance/staging-security-runbook.md). Local synthetic tests cannot close hosted Access/Worker/D1, legacy-account or real-model acceptance gates.

No deployment, merge, production identity change, new model provider, external-action connector or new D1 migration is introduced by this PR.
