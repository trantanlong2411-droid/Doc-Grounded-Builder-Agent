import {connect,chainResult,docsText,DOCS_URL,CHAIN_URL} from './mcp.mjs';
import {resolveQuestion,requireEvidence,buildPlan,decodeValue,verify,TASKS,DOC_URL,PROXY} from './core.mjs';
import {PAGE} from './page.mjs';

export const VERSION='doc-grounded-2026-11-07-v1';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const failures=new Map();
function tooMany(req){
  const ip=(req.headers.get('cf-connecting-ip')||'anonymous').slice(0,90),now=Date.now();
  const current=failures.get(ip);
  if(!current||now-current.start>60000){failures.set(ip,{start:now,n:1});return false;}
  current.n++;return current.n>12;
}
export async function run(question,connector=connect){
  const started=new Date().toISOString(),steps=[],key=resolveQuestion(question);
  if(!key)return {ok:false,status:'NOT_DOCUMENTED',question,network:'Pharos Mainnet',
    message:'I could not find a supported, documented way to do that in this demo. I will not invent steps or make an on-chain call.',
    supportedQuestions:Object.values(TASKS).map(x=>x.question),steps,readOnly:true,transactionHash:null};
  const task=TASKS[key];let docs,chain;
  try{
    docs=await connector(DOCS_URL);
    const list=await docs.list();
    if(!list.some(t=>t.name==='getPage'))throw Error('Official Developer Docs MCP does not expose getPage');
    const page=docsText(await docs.call('getPage',{url:DOC_URL}));
    const evidence=requireEvidence(page,key);
    steps.push({n:1,tool:'Developer Docs MCP',operation:'getPage',status:'verified',
      detail:'Read official Chainlink Push Engine Feeds page and validated '+task.signature,
      source:evidence.source,excerpt:evidence.excerpt});
    const plan=buildPlan(key,evidence);
    steps.push({n:2,tool:'Planner',operation:'plan with sources',status:'verified',
      detail:'The documented function and proxy address are now validated. Only read-only calls are permitted.',source:evidence.source});
    chain=await connector(CHAIN_URL);
    const chainTools=await chain.list();
    for(const method of ['get_chain_info','get_code','eth_call'])
      if(!chainTools.some(t=>t.name===method))throw Error('Official Chain MCP missing '+method);
    const info=chainResult(await chain.call('get_chain_info',{}),'get_chain_info');
    if(Number(info.chainId)!==1672||info.chainIdMatches===false)throw Error('Chain MCP is not connected to Pharos Mainnet 1672');
    if(!/^\d+$/.test(String(info.latestBlock||'')))throw Error('Chain MCP did not provide an anchor block');
    const block=String(info.latestBlock);
    steps.push({n:3,tool:'Chain MCP',operation:'get_chain_info',status:'verified',detail:'Pharos Mainnet chain ID 1672, pinned block '+block});
    const code=chainResult(await chain.call('get_code',{address:PROXY,block}),'get_code');
    if(typeof code.code!=='string'||!/^0x[0-9a-f]+$/i.test(code.code)||code.code.length<4)throw Error('No deployed oracle bytecode at the documented proxy');
    steps.push({n:4,tool:'Chain MCP',operation:'get_code',status:'verified',detail:'Official documented proxy has deployed contract bytecode: '+PROXY});
    const calldata=(await import('ethers')).id(task.signature).slice(0,10);
    const args={transaction:{to:PROXY,data:calldata},block};
    const response=chainResult(await chain.call('eth_call',args),'eth_call');
    const decoded=decodeValue(key,response.result);
    steps.push({n:5,tool:'Chain MCP',operation:'eth_call',status:'verified',detail:'Called '+task.signature+' at block '+block+'. Result: '+decoded.rawValue});
    const repeated=chainResult(await chain.call('eth_call',args),'eth_call');
    const verified=verify(key,response.result,repeated.result);
    steps.push({n:6,tool:'Chain MCP',operation:'verify same pinned block',status:verified.ok?'verified':'failed',detail:verified.reason});
    const success=verified.ok;
    return {ok:success,status:success?'SUCCESS':'VERIFICATION_FAILED',question,task:key,
      summary:success?decoded.explanation:'On-chain verification failed: '+verified.reason,
      decoded,verified,plan,evidence,steps,executed:{method:'eth_call',signature:task.signature,selector:calldata,contract:PROXY,blockNumber:block,
        chainId:1672,network:'Pharos Mainnet',transactionBroadcast:false},readOnly:true,
      transactionHash:null,observedAtUtc:started,
      note:'This is a read-only execution. There is no mined transaction hash because no transaction was sent.'};
  }catch(error){
    return {ok:false,status:'ERROR_NO_VERIFIED_EXECUTION',question,task:key,
      message:String(error.message||error).slice(0,350),steps,readOnly:true,transactionHash:null,
      note:'Do not claim completion: a verified documentation or on-chain step failed.'};
  }finally{
    if(chain)await chain.close().catch(()=>{});
    if(docs)await docs.close().catch(()=>{});
  }
}
export default {
  async fetch(request){
    const u=new URL(request.url);
    if(request.method==='GET'&&u.pathname==='/')return new Response(PAGE,{headers:{
      'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    }});
    if(request.method==='GET'&&u.pathname==='/api/health')return json({ok:true,version:VERSION,docsMcp:DOCS_URL,chainMcp:CHAIN_URL,chainId:1672,readOnly:true,nativeTransferEnabled:false,functions:Object.keys(TASKS),note:'Only confirms web service health, not remote MCP availability'});
    if(request.method==='GET'&&u.pathname==='/api/examples')return json({ok:true,examples:Object.entries(TASKS).map(([id,t])=>({id,question:t.question,signature:t.signature})),unsupported:'How do I bridge SOL to Pharos?'});
    if(request.method==='POST'&&u.pathname==='/api/run'){
      if(tooMany(request))return json({ok:false,error:'Rate limit exceeded: retry after one minute'},429);
      try{
        const body=await request.text();if(body.length>1500) return json({ok:false,error:'Request body too large'},400);
        const input=JSON.parse(body);
        if(typeof input.question!=='string'||input.question.length<9||input.question.length>400)
          return json({ok:false,error:'Question must be 9-400 characters'},400);
        const result=await run(input.question);return json(result,result.status==='ERROR_NO_VERIFIED_EXECUTION'?502:200);
      }catch(e){return json({ok:false,error:'Invalid JSON request'},400);}
    }
    return json({ok:false,error:'Not found'},404);
  }
};
