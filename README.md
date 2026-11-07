# Doc-Grounded Builder Agent — Pharos Agent Arena

**Challenge:** Hard / Cross-tool + Advanced · 200 points (optional +50 for a video)
**Repository:** https://github.com/trantanlong2411-droid/Doc-Grounded-Builder-Agent
**Expected linked Cloudflare Worker:** https://doc-grounded-builder-agent.trantanlong2411.workers.dev/ (verify after deployment)

## What this actually implements

An open public, read-only agent for Pharos Mainnet (chain ID 1672). Every supported request runs in this order:

1. Connect to **Pharos Developer Docs MCP** `https://docs.pharos.xyz/~gitbook/mcp`; call `tools/list`, then `getPage` to fetch the official [Chainlink Push Engine Feeds](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe) documentation.
2. **Validate source evidence** that the selected function, return type, PROS/USD proxy address and decimal precision or Feed ID are present in the MCP response. A missing source stops the workflow: Chain MCP is never called.
3. Produce a five-step **source-backed plan** *before* executing it. The response includes the exact source URL and quoted Solidity declaration.
4. Connect to **official Pharos Chain MCP** `https://mcp.pharos.xyz/mcp`, check Mainnet chain ID 1672, inspect deployed proxy code, encode the documented function signature and execute a real `eth_call` at a pinned block.
5. **Verify the outcome on chain** by reading the exact same function again at the same block and comparing results. Decode as ABI `int256`, `uint256`, or `bytes32`, using the return type stated by Docs MCP. The Feed ID is additionally compared to the documented ID.

The result contains the ordered MCP step trace, citation, plan, block number, response, diagnosis and verification state.

## Three distinct "How do I...?" requests

| Query | Docs-grounded operation | Execution and verification |
|---|---|---|
| How do I read the latest PROS/USD oracle price on Pharos? | `latestAnswer() returns (int256)` | `eth_call` + read-back; decode signed number at **18 decimals** |
| How do I check when the PROS/USD oracle price was last observed on Pharos? | `latestTimestamp() returns (uint256)` | `eth_call` + read-back; interpret UTC observation timestamp, not transaction timestamp |
| How do I check the feed ID of the PROS/USD Chainlink proxy on Pharos? | `getFeedId() returns (bytes32)` | `eth_call` + read-back; compare to docs' published feed ID |

All three are separate, live on-chain contract reads with distinct ABI selectors. These demonstrations are **read-only**; they do not move funds and have no transaction receipt/hash. The answer explicitly states this. No fake mined transaction proof is provided.

### Honest scope limitations

- The agent recognizes exactly the three supported intent patterns above, rather than pretending to be a general-purpose LLM or an autonomous wallet agent. Questions not grounded in the supported docs/workflow return **NOT_DOCUMENTED**, with no Chain MCP request.
- The official hosted Chain MCP is currently read-only; `send_raw_transaction` is disabled there. No private keys, approvals, transfers, or signing are requested or stored. Anything that moves funds would need a separate verified Docs-MCP-guided **unsigned** transaction preparation and a user's own wallet signature; it is not part of this release.
- Checks of live MCP integration run through GitHub Actions. A green local test only verifies classifier/decoder behavior, **not** remote MCP uptime. See workflow logs/artifacts for live proof.
- Oracle prices and timestamps may be stale. Read-only replay at a pinned block verifies deterministic data retrieval, not oracle economic correctness.

## Try it

1. Open the deployed Worker. Click the three sample questions in turn.
2. Check **Documentation evidence** and official Docs source URL.
3. Inspect the **Plan before execution** and sequential **Tool trace**.
4. Check `Chain MCP get_chain_info`, `get_code`, `eth_call`, and pinned-block recheck result.
5. Try "How do I bridge SOL to Pharos?" — it must return `NOT_DOCUMENTED` rather than pretend to execute.
6. Use **Copy JSON proof** for reviewer evidence.

### Routes

| Route | Purpose |
|---|---|
| `GET /` | Public UI (no login, keys or wallet) |
| `GET /api/health` | Local app / chain / integration metadata (not a remote availability claim) |
| `GET /api/examples` | 3 grounded questions + an unsupported question |
| `POST /api/run` | JSON `{"question":"How do I read the latest PROS/USD oracle price on Pharos?"}` |

## Develop and deploy

```sh
npm install
npm test
npm run build
npx wrangler deploy
```

Cloudflare Workers & Pages → **doc-grounded-builder-agent** → Settings → Builds: link this GitHub repository, use branch `main` and deploy command `npx wrangler deploy`. The CLI `npm run build` performs a Wrangler **dry run** only and does not publish the Worker. Use the Cloudflare dashboard to confirm the actual URL.

### Evidence

- `.github/workflows/verify.yml`: deterministic tests, bundle build, optional live MCP end-to-end checks.
- `scripts/live-smoke.mjs`: execute all 3 read-only workflows through real Docs MCP and Chain MCP; save outcomes to a CI artifact if available.
- `proof/README.md`: rubric mapping and what can / cannot be claimed.

## Official sources

- [Pharos Chainlink Push Engine Feeds documentation](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe)
- [Pharos Chain MCP tool list / read-only hosted endpoint](https://github.com/PharosNetwork/pharos-mcp)
- [Official Developer Docs MCP endpoint](https://docs.pharos.xyz/~gitbook/mcp)
