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
  await c.query("CREATE TABLE kakao_auth_flows(id varchar(36) PRIMARY KEY,user_id bigint,kakao_id varchar(100)); INSERT INTO kakao_auth_flows VALUES('11111111-1111-4111-8111-000000000001',NULL,'9302')");
  await verifyErased(c,plan);
  await c.query("INSERT INTO kakao_auth_flows VALUES('11111111-1111-4111-8111-000000000002',NULL,'9301')");
  await assert.rejects(verifyErased(c,{...plan,identifiers:[...plan.identifiers,'9301']}),/text/);
  await c.query("DELETE FROM kakao_auth_flows WHERE kakao_id='9301'");
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
  await c.query('DELETE FROM tts_legacy_score');
  await c.query("CREATE TABLE moderated_photos(id bigint PRIMARY KEY,target_type text,target_id bigint,pending_image text,submitted_by bigint,reviewed_by bigint,review_note text); CREATE TABLE content_reports(id bigint PRIMARY KEY,target_type text,content_type text,target_id bigint,assigned_to_id bigint)");
  await c.query("INSERT INTO moderated_photos VALUES(1,'USER',1,NULL,NULL,NULL,NULL)");
  await assert.rejects(verifyErased(c,plan),/photo account reference/);
  await c.query("UPDATE moderated_photos SET target_id=2,submitted_by=1");
  await assert.rejects(verifyErased(c,plan),/account reference/);
  await c.query("UPDATE moderated_photos SET submitted_by=NULL,reviewed_by=1");
  await assert.rejects(verifyErased(c,plan),/account reference/);
  await c.query("UPDATE moderated_photos SET reviewed_by=NULL,pending_image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADElEQVR4XmP4z4AEAA0BAQAPfkcCAAAAAElFTkSuQmCC'");
  await verifyErased(c,{...plan,identifiers:['iVB']});
  await c.query("UPDATE moderated_photos SET review_note='iVB retained plaintext'");
  await assert.rejects(verifyErased(c,{...plan,identifiers:['iVB']}),/personal text/);
  await c.query("UPDATE moderated_photos SET review_note=NULL,pending_image='data:image/png;base64,iVBnot-valid'");
  await assert.rejects(verifyErased(c,{...plan,identifiers:['iVB']}),/personal text/);
  await c.query("UPDATE moderated_photos SET pending_image=NULL; INSERT INTO content_reports VALUES(1,'CONTENT','USER_PROFILE_PHOTO',1,NULL)");
  await assert.rejects(verifyErased(c,plan),/reported account reference/);
  await c.query("UPDATE content_reports SET target_id=2,assigned_to_id=1");
  await assert.rejects(verifyErased(c,plan),/account reference/);
  await c.query("UPDATE content_reports SET assigned_to_id=NULL");
  // Optional V011-style residual state: another account's valid hashes contain the erased name.
  // Omit format CHECKs here deliberately to exercise the audit's schema-drift rejection too.
  await c.query(`CREATE TABLE apple_notification_subjects(subject_hash varchar(64) PRIMARY KEY,user_id bigint);
   CREATE TABLE apple_notification_receipts(jti_hash varchar(64) PRIMARY KEY,subject_hash varchar(64) NOT NULL REFERENCES apple_notification_subjects(subject_hash) ON DELETE CASCADE,payload_hash varchar(64) NOT NULL);
   INSERT INTO apple_notification_subjects VALUES(repeat('c',61)||'ada',2);
   INSERT INTO apple_notification_receipts VALUES(repeat('3',61)||'ada',repeat('c',61)||'ada',repeat('7',61)||'ada')`);
  const collisionPlan={...plan,identifiers:[...plan.identifiers,'Ada']};
  const hashes=async()=>({subjects:(await c.query('SELECT * FROM apple_notification_subjects ORDER BY subject_hash')).rows,receipts:(await c.query('SELECT * FROM apple_notification_receipts ORDER BY jti_hash')).rows});
  const preservedHashes=await hashes();
  await verifyErased(c,collisionPlan);
  assert.deepEqual(await hashes(),preservedHashes,'A name fragment inside another account\'s SHA-256 data must not block or change restored data');
  await c.query('UPDATE apple_notification_subjects SET user_id=1');
  await assert.rejects(verifyErased(c,collisionPlan),/account reference/,'Hash exceptions must never skip the numeric owner audit');
  await c.query('UPDATE apple_notification_subjects SET user_id=2');
  await c.query("ALTER TABLE apple_notification_subjects ADD COLUMN unreviewed_note text; UPDATE apple_notification_subjects SET unreviewed_note='Ada retained plaintext'");
  await assert.rejects(verifyErased(c,collisionPlan),/personal text/,'New plaintext fields in a reviewed table must still be audited');
  await c.query('UPDATE apple_notification_subjects SET unreviewed_note=NULL');
  await c.query("UPDATE apple_notification_receipts SET payload_hash='Ada'");
  await assert.rejects(verifyErased(c,collisionPlan),/Invalid restored Apple notification hash/);
  await c.query("UPDATE apple_notification_receipts SET payload_hash=repeat('7',61)||'ada'");
  await verifyErased(c,collisionPlan);
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
