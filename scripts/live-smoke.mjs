import {mkdir,writeFile} from 'node:fs/promises';
import {TASKS} from '../src/core.mjs';
import {run} from '../src/worker.mjs';
const results=[],timestamp=new Date().toISOString();
for(const [key,task] of Object.entries(TASKS)){
  const value=await run(task.question);
  const sample={key,question:task.question,ok:value.ok,status:value.status,
    blockNumber:value.executed?.blockNumber,signature:value.executed?.signature,
    docsSource:value.evidence?.source,verified:value.verified,
    result:value.decoded?.value,message:value.message||null};
  results.push(sample);console.log('DOC_GROUNDED_LIVE_SCENARIO',JSON.stringify(sample));
}
const unsupported=await run('How do I bridge SOL to Pharos?');
const proof={schema:'pharos-doc-grounded-live-v1',checkedAtUtc:timestamp,examples:results,
  unsupported:{status:unsupported.status,chainCalled:unsupported.steps.some(x=>x.tool==='Chain MCP')},
  allVerified:results.every(x=>x.ok&&x.verified?.ok)};
await mkdir('proof',{recursive:true});
await writeFile('proof/live-run.json',JSON.stringify(proof,null,2)+'\n');
console.log('DOC_GROUNDED_LIVE_SUMMARY',JSON.stringify(proof));
if(!proof.allVerified||unsupported.status!=='NOT_DOCUMENTED')process.exitCode=1;
