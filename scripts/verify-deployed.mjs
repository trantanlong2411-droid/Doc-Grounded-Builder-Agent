import assert from 'node:assert/strict';
const base=(process.env.WORKER_URL||'https://doc-grounded-builder-agent.trantanlong2411.workers.dev').replace(/\/$/,'');
const expected='doc-grounded-2026-11-07-v1';
async function request(path,body=null){
  const r=await fetch(base+path,{method:body?'POST':'GET',
    headers:body?{'content-type':'application/json'}:{},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  return {status:r.status,data:await r.json()};
}
let health;
for(let i=0;i<18;i++){
  try{health=await request('/api/health');if(health.status===200&&health.data.version===expected)break;
    console.log('DEPLOY_PENDING',i+1,health.status,health.data.version||'unknown');
  }catch(e){console.log('DEPLOY_PENDING',i+1,String(e.message).slice(0,180));}
  await new Promise(r=>setTimeout(r,5000));
}
assert.equal(health?.status,200,'Worker is not reachable at '+base);
assert.equal(health.data.version,expected,'Cloudflare has not deployed the expected version yet');
assert.equal(health.data.readOnly,true);
const examples=await request('/api/examples');
assert.equal(examples.status,200);assert.equal(examples.data.examples.length,3);
for(const ex of examples.data.examples){
  const res=await request('/api/run',{question:ex.question});
  assert.equal(res.status,200,ex.id+': Worker HTTP '+res.status+' '+JSON.stringify(res.data).slice(0,170));
  assert.equal(res.data.status,'SUCCESS',ex.id+': '+res.data.message);
  assert.equal(res.data.verified.ok,true);
  assert.equal(res.data.executed.chainId,1672);
  assert.equal(res.data.readOnly,true);
  console.log('DEPLOYED_DOC_GROUNDED_VERIFIED',JSON.stringify({id:ex.id,block:res.data.executed.blockNumber,
    signature:res.data.executed.signature,result:res.data.decoded.value}));
}
const unsupported=await request('/api/run',{question:'How do I bridge SOL to Pharos?'});
assert.equal(unsupported.data.status,'NOT_DOCUMENTED');
console.log('DEPLOYED_DOC_GROUNDED_ALL_SUCCESS',base);
