import {id as hashSignature} from 'ethers';
export const DOC_URL='https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe';
export const PROXY='0x371Ed36aEe5bFFbED1A2aa9b7deD7F4EB30F5466';
export const FEED_ID='0x0003f73a1abb2eec1ecdde915c659cbb8f0cbb030156b75dd401fbfd5281e246';
export const TASKS=Object.freeze({
  price:{label:'Get latest PROS/USD price',question:'How do I read the latest PROS/USD oracle price on Pharos?',signature:'latestAnswer()',type:'int256',description:'Read the latest published PROS/USD price using the documented oracle proxy.',unit:'USD / PROS'},
  timestamp:{label:'Check oracle update time',question:'How do I check when the PROS/USD oracle price was last observed on Pharos?',signature:'latestTimestamp()',type:'uint256',description:'Read the last oracle observation timestamp to assess staleness.',unit:'Unix seconds'},
  feed:{label:'Read PROS/USD feed ID',question:'How do I check the feed ID of the PROS/USD Chainlink proxy on Pharos?',signature:'getFeedId()',type:'bytes32',description:'Read the proxy feed ID and compare it with the official documentation.',unit:'Feed identifier'}
});
export function resolveQuestion(question) {
  if(typeof question!=='string'||question.length<9||question.length>400)throw Error('Enter a question between 9 and 400 characters');
  const t=question.toLowerCase().trim();
  if(/(feed.?id|getfeedid|feed identifier)/.test(t))return 'feed';
  if(/(timestamp|when .* (update|observ|report)|update time|freshness|stale|last updated)/.test(t) && /(pros|oracle|feed|pharos|price)/.test(t))return 'timestamp';
  if(/(price|latestanswer|usd rate|price feed)/.test(t) && /(pros|oracle|feed|pharos)/.test(t))return 'price';
  return null;
}
export function requireEvidence(text,key) {
  const task=TASKS[key];
  const checks=['# Chainlink Push Engine Feeds','## Contract Interface','function '+task.signature,task.type,PROXY];
  for(const part of checks)if(!text.toLowerCase().includes(part.toLowerCase()))throw Error('Docs MCP page does not confirm '+part);
  if(key==='price'&&!/\|\s*Decimals\s*\|\s*18\s*\|/i.test(text))throw Error('Docs MCP does not verify price decimals');
  if(key==='feed'&&!text.toLowerCase().includes(FEED_ID.toLowerCase()))throw Error('Docs MCP does not confirm expected feed ID');
  const declaration=text.split('\n').find(s=>s.includes('function '+task.signature));
  if(!declaration || !declaration.includes(task.type))throw Error('Documented contract signature mismatch');
  return {
    source:DOC_URL,tool:'Developer Docs MCP getPage',signature:task.signature,returnType:task.type,
    contract:PROXY,excerpt:declaration.trim().slice(0,200),
    documentedFact:key==='price'?'18 decimals, PROS/USD proxy on Pharos Pacific Mainnet':key==='timestamp'?'Unix observation timestamp, verify staleness':'Feed ID is listed for the documented PROS/USD proxy'
  };
}
export function buildPlan(key,evidence) {
  if(evidence.signature!==TASKS[key].signature)throw Error('Documentation/plan mismatch');
  return [
    'Read the official Pharos documentation and cite '+evidence.source,
    'Confirm the documented '+evidence.signature+' interface, PROS/USD proxy and network',
    'Use official Chain MCP to check Pharos Mainnet (1672) and deployed proxy bytecode',
    'Execute '+evidence.signature+' using a read-only eth_call at a pinned block',
    'Repeat the read at the same block, compare results and explain success or failure'
  ];
}
export function decodeValue(key,raw,now=Date.now()) {
  if(typeof raw!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(raw))throw Error('Chain MCP returned an invalid 32-byte ABI value');
  let n=BigInt(raw);
  if(key==='price'){
    if(n>=2n**255n)n-=2n**256n;
    const negative=n<0n;const a=negative?-n:n;const scale=10n**18n;
    const frac=(a%scale).toString().padStart(18,'0').replace(/0+$/,'');
    const price=(negative?'-':'')+(a/scale).toString()+(frac?'.'+frac:'');
    return {value:price,unit:'USD per PROS',rawValue:n.toString(),
      explanation:'The oracle reports '+price+' USD per PROS using the 18 decimals documented by Pharos. A price feed can be stale; check the timestamp before relying on it.'};
  }
  if(key==='timestamp'){
    if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Oracle timestamp exceeds safe integer range');
    const seconds=Number(n),date=new Date(seconds*1000);
    if(Number.isNaN(date.getTime()))throw Error('Invalid feed timestamp');
    const age=Math.max(0,Math.floor(now/1000)-seconds);
    return {value:date.toISOString(),unit:'UTC observation time',rawValue:n.toString(),ageSeconds:age,
      explanation:'The price feed observation was recorded at '+date.toISOString()+'. This is the data observation time, not the time it was added to the blockchain. Check how old this report is.'};
  }
  const confirmed=raw.toLowerCase()===FEED_ID.toLowerCase();
  return {value:raw,unit:'bytes32',rawValue:raw,matchOfficialDocs:confirmed,
    explanation:confirmed?'The on-chain proxy feed ID matches the PROS/USD feed ID published in official Pharos documentation.':'The returned feed ID does NOT match the official PROS/USD identifier. Do not rely on this feed until it is checked.'};
}
export function verify(key,original,repeat) {
  if(typeof original!=='string'||original.toLowerCase()!==String(repeat).toLowerCase())return {ok:false,reason:'Pinned-block read-back differed from the original result'};
  if(key==='feed'&&original.toLowerCase()!==FEED_ID.toLowerCase())return {ok:false,reason:'Feed ID differs from official Pharos docs'};
  return {ok:true,reason:'Independent read-back at the same block matches'+(key==='feed'?' the official feed ID':' exactly')};
}
