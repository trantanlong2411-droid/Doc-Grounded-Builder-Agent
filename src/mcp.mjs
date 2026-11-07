// Two fixed, public MCP services; the user never supplies server URLs.
export const DOCS_URL = 'https://docs.pharos.xyz/~gitbook/mcp';
export const CHAIN_URL = 'https://mcp.pharos.xyz/mcp';
const VERSION = '2025-03-26';
function readEvent(raw,id) {
  for (const entry of raw.replace(/\r\n/g,'\n').split(/\n\n+/)) {
    const body = entry.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
    if (!body) continue;
    try { const v=JSON.parse(body); if(v.id===id)return v; } catch {}
  }
  throw Error('MCP stream did not include the requested result');
}
export async function connect(url,fetcher=fetch) {
  if(url!==DOCS_URL && url!==CHAIN_URL)throw Error('MCP endpoint not allowed');
  let session='',version=VERSION,id=0;
  async function request(method,params={},notify=false) {
    const msg={jsonrpc:'2.0',...(!notify?{id:++id}:{}),method,params};
    if(notify)delete msg.params;
    const res=await fetcher(url,{method:'POST',headers:{
      'content-type':'application/json','accept':'application/json, text/event-stream',
      'mcp-protocol-version':version,...(session?{'mcp-session-id':session}:{})
    },body:JSON.stringify(msg),signal:AbortSignal.timeout(24000)});
    if(!res.ok)throw Error('MCP '+new URL(url).hostname+' HTTP '+res.status+': '+(await res.text()).slice(0,140));
    session=res.headers.get('mcp-session-id')||session;
    if(notify){await res.text();return null;}
    const raw=await res.text();
    if(raw.length>1000000)throw Error('MCP response too large');
    const json=(res.headers.get('content-type')||'').includes('text/event-stream')?readEvent(raw,id):JSON.parse(raw);
    if(json.id!==id)throw Error('MCP response ID mismatch');
    if(json.error)throw Error('MCP '+String(json.error.message||'error'));
    return json.result;
  }
  const init=await request('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'pharos-doc-grounded-builder-agent',version:'1.0.0'}});
  if(init?.protocolVersion)version=init.protocolVersion;
  await request('notifications/initialized',{},true);
  return {
    list:async()=>{const out=await request('tools/list');return out.tools||[];},
    call:(name,args)=>request('tools/call',{name,arguments:args||{}}),
    close:async()=>{if(session){try{await fetcher(url,{method:'DELETE',headers:{'mcp-session-id':session,'mcp-protocol-version':version},signal:AbortSignal.timeout(2000)});}catch{}}},
    server:init?.serverInfo?.name||'unknown'
  };
}
export function chainResult(response,tool) {
  if(!response || response.isError)throw Error(tool+' returned an MCP error: '+JSON.stringify(response?.content||[]).slice(0,200));
  if(response.structuredContent && typeof response.structuredContent==='object') {
    const v=response.structuredContent;
    if(v.error)throw Error(tool+': '+String(v.error.message||v.error));
    if(v.chainId!==undefined||v.code!==undefined||v.result!==undefined||v.latestBlock!==undefined)return v;
  }
  const t=(response.content||[]).find(x=>x.type==='text');
  if(!t)throw Error(tool+' has no result');
  const v=JSON.parse(t.text);
  if(v.error||v.mcpError)throw Error(tool+' returned '+String(v.error?.message||v.mcpError?.message||'RPC error'));
  return v;
}
export function docsText(response) {
  if(!response || response.isError)throw Error('Docs MCP getPage returned an error');
  const parts=(response.content||[]).filter(x=>x.type==='text').map(x=>x.text||'');
  if(response.structuredContent)parts.push(JSON.stringify(response.structuredContent));
  const joined=parts.join('\n');
  if(joined.length<120)throw Error('Docs MCP returned empty documentation');
  return joined;
}
