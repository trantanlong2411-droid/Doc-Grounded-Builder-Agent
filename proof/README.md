# Reviewer proof — Doc-Grounded Builder Agent

**200-point task: 5 requirements.** Use the deployed demo and [workflow runs](https://github.com/trantanlong2411-droid/Doc-Grounded-Builder-Agent/actions) to check current evidence. This document does **not** assert a live check that has not completed.

| Requirement | Implementation | How to check |
|---|---|---|
| Docs MCP planning with citations before actions | Real Developer Docs MCP getPage; verifies signature, address and return type; emits five plan steps and source URL | Click a demo; verify steps 1–2 and cited source |
| Executes via Chain MCP / SkillEngine | Real Pharos Chain MCP get_chain_info, get_code and eth_call; SkillEngine not necessary for these read-only tasks | Check trace steps 3–5 |
| Confirms on-chain success/failure against the plan | Rereads exact same function at pinned block, compares raw value; additionally matches feed ID against docs | Step 6 and verified.ok |
| Works for three different "how do I" requests | latestAnswer, latestTimestamp, getFeedId, each different documented selector | Run three public UI buttons; inspect each independent response |
| Missing docs acknowledged instead of hallucination | NOT_DOCUMENTED return, no Chain MCP call | Ask "How do I bridge SOL to Pharos?" |

**Limitations:** All three flows perform read-only contract calls; they are not mined transactions and have no transaction hash. No user funds can move. Full fund-moving execution is out of scope for this version. A successful local unit test or dry-run bundle is not evidence of a successful live MCP run.

Source documentation: https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe

The real-protocol smoke test (`npm run smoke`) runs three Docs-MCP → Chain-MCP sequences and writes `proof/live-run.json` only after attempting the live calls. The CI workflow uploads that file for reviewers. Do not present a live result as verified unless it reports `ok:true`.
