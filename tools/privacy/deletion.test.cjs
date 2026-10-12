const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {runDeletion,replayLedger,verifyErased}=require('./deletion.cjs');
const plan={requestId:'11111111-1111-4111-8111-111111111111',userId:1,expectedCreatedAt:'2026-10-01',identityVerified:true,handoverReviewed:true,externalCopiesReviewed:true,freeTextReviewed:true,legacyDecisions:[],redactions:[],identifiers:['가상 대상'],exceptions:[]};
function fake(fail=false){const calls=[];return {calls,query:async(sql)=>{calls.push(sql);if(fail&&sql.startsWith('-- Must run'))throw Error('Changed since review');return{rowCount:1,rows:[{id:1}]};}};}
test('execution records durable intent before commit; intent failure rolls everything back',async()=>{
 const c=fake();await runDeletion(c,plan,{commit:true,beforeCommit:async()=>c.calls.push('DURABLE INTENT')});
 assert.deepEqual(c.calls.slice(-2),['DURABLE INTENT','COMMIT']);
 const rejected=fake();await assert.rejects(runDeletion(rejected,plan,{commit:true,beforeCommit:async()=>{throw Error('Disk full');}}));
 assert.equal(rejected.calls.at(-1),'ROLLBACK');assert.ok(!rejected.calls.includes('COMMIT'));
 await assert.rejects(runDeletion(fake(),{...plan,identityVerified:false}),/Review/);
});

test('missing-account residual audit runs on an isolated PostgreSQL database', {skip:!process.env.PRIVACY_AUDIT_PG_MODULE}, async()=>{
 const {Client}=require(process.env.PRIVACY_AUDIT_PG_MODULE),database=process.env.PRIVACY_AUDIT_DATABASE;
 assert.match(database,/^newave_privacy_[a-z0-9_]+$/);
 const c=new Client({host:'127.0.0.1',port:Number(process.env.PRIVACY_AUDIT_PORT),database,user:process.env.MIGRATION_TEST_USER,password:process.env.MIGRATION_TEST_PASSWORD});
 await c.connect();
 try{
  await c.query('BEGIN');
  await c.query("CREATE TABLE tts_legacy_score(id bigint PRIMARY KEY,name text); CREATE TABLE event_participants(id bigint PRIMARY KEY,kind text,person_id bigint,name text); CREATE TABLE reports(id bigint PRIMARY KEY,teacher_id bigint,note text)");
  await verifyErased(c,plan);
  await c.query("INSERT INTO reports VALUES(1,1,'보존 보고서')");
  await assert.rejects(verifyErased(c,plan),/reference/);
  await c.query("UPDATE reports SET teacher_id=NULL,note='가상 대상'");
  await assert.rejects(verifyErased(c,plan),/text/);
  const digest=(await c.query('SELECT md5(note) AS digest FROM reports')).rows[0].digest;
  await verifyErased(c,{...plan,exceptions:[{table:'reports',column:'note',id:1,beforeMd5:digest,reason:'다른 사람의 이름 보존'}]});
  await c.query("UPDATE reports SET note='보존 보고서'; INSERT INTO event_participants VALUES(1,'TEACHER',1,'옛 별명')");
  await assert.rejects(verifyErased(c,plan),/snapshot/);
  await c.query("DELETE FROM event_participants; INSERT INTO tts_legacy_score VALUES(1,'옛 별명')");
  await assert.rejects(verifyErased(c,{...plan,legacyDecisions:[{id:1,remove:true}]}),/snapshot/);
 }finally{await c.query('ROLLBACK');await c.end();}
});
test('rehearsal never commits, and database rejection rolls back',async()=>{
 const c=fake();await runDeletion(c,plan);assert.equal(c.calls.at(-1),'ROLLBACK');assert.ok(!c.calls.includes('COMMIT'));
 const broken=fake(true);await assert.rejects(runDeletion(broken,plan));assert.equal(broken.calls.at(-1),'ROLLBACK');
});
test('restore replays completed intent but blocks pending and changed records',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'newave-ledger-')));
 t.after(()=>{for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);});
 fs.writeFileSync(path.join(dir,plan.requestId+'.done.dpapi'),JSON.stringify(plan));
 const c=fake();assert.equal((await replayLedger(c,dir,b=>b)).replayed,1);assert.equal(c.calls.at(-1),'COMMIT');
 const changed=fake(true);await assert.rejects(replayLedger(changed,dir,b=>b));assert.equal(changed.calls.at(-1),'ROLLBACK');
 const absent={query:async()=>({rowCount:0,rows:[]})};
 assert.equal((await replayLedger(absent,dir,b=>b)).replayed,0);
 const resurrected={query:async sql=>({rowCount:sql.includes('FROM tts_legacy_score')?1:0,rows:[]})};
 await assert.rejects(replayLedger(resurrected,dir,b=>b),/snapshot/);
 fs.writeFileSync(path.join(dir,plan.requestId+'.pending.dpapi'),'pending');
 const pending=fake();await assert.rejects(replayLedger(pending,dir,b=>b),/Unresolved/);assert.equal(pending.calls.length,0);
});
