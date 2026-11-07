import test from 'node:test';import assert from 'node:assert/strict';
import {TASKS,resolveQuestion,requireEvidence,buildPlan,decodeValue,verify,PROXY,FEED_ID} from '../src/core.mjs';
const docs=['# Chainlink Push Engine Feeds','## Contract Interface',PROXY,'| Decimals | 18 |','PROS/USD '+FEED_ID,
 'function latestAnswer() external view returns (int256);','function latestTimestamp() external view returns (uint256);',
 'function getFeedId() external view returns (bytes32 feedId);'].join('\n');
test('all three how-do-I requests resolve to distinct workflows',()=>{
 for(const [key,t] of Object.entries(TASKS))assert.equal(resolveQuestion(t.question),key);
});
test('unsupported and fund-moving requests do not get invented tools',()=>{
 assert.equal(resolveQuestion('How do I bridge SOL to Pharos?'),null);
 assert.equal(resolveQuestion('How do I send PROS to another wallet?'),null);
});
test('Docs MCP must confirm a matching function and proxy before Chain MCP',()=>{
 for(const key of Object.keys(TASKS)){
  const e=requireEvidence(docs,key);assert.equal(e.contract,PROXY);assert.equal(buildPlan(key,e).length,5);
 }
 assert.throws(()=>requireEvidence('unrelated docs','price'),/Docs MCP/);
});
test('price is decoded from signed int256 with 18 decimals',()=>{
 const encoded='0x'+(1500000000000000000n).toString(16).padStart(64,'0');
 assert.equal(decodeValue('price',encoded).value,'1.5');
});
test('feed identifier is verified with on-chain comparison',()=>{
 const id=FEED_ID;
 assert.equal(decodeValue('feed',id).matchOfficialDocs,true);
 assert.equal(verify('feed',id,id).ok,true);
 assert.equal(verify('feed','0x'+'0'.repeat(64),'0x'+'0'.repeat(64)).ok,false);
});
test('timestamp is decoded and repeat checks are strict',()=>{
 const time='0x'+(1793692029n).toString(16).padStart(64,'0');
 assert.ok(decodeValue('timestamp',time).value.startsWith('2026-'));
 assert.equal(verify('timestamp',time,time).ok,true);
 assert.equal(verify('timestamp',time,'0x'+'0'.repeat(64)).ok,false);
});
