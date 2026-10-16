const fs=require('node:fs'),path=require('node:path');
const sqlRoot=path.resolve(__dirname,'../../backend/db/privacy');
const inputs=fs.readFileSync(path.join(sqlRoot,'request-tables.sql'),'utf8');
const deletion=fs.readFileSync(path.join(sqlRoot,'delete-account.sql'),'utf8');
const {scopeSql,validateContentReview,verifyContentErased}=require('./content-review.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appleNotificationHashes=new Set([
 'apple_notification_subjects.subject_hash',
 'apple_notification_receipts.subject_hash',
 'apple_notification_receipts.jti_hash',
 'apple_notification_receipts.payload_hash',
]);
// Match only the same reviewed binary image fields and bounded canonical formats as deletion SQL.
// Their ownership is checked separately; every ordinary URL/new plaintext column is still scanned.
function opaquePhotoFilter(table,column,quote){
 if(!new Set(['users.profile_image','students.profile_image','moderated_photos.pending_image']).has(`${table}.${column}`))return '';
 const field='t.'+quote(column);
 const bytes=`decode(split_part(${field},',',2),'base64')`;
 return ` AND NOT (CASE WHEN length(${field})<=2800000 AND ${field} ~ '^data:image/(png|jpeg);base64,([A-Za-z0-9+/]{4})+([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
 THEN replace(encode(${bytes},'base64'),E'\\n','')=split_part(${field},',',2)
 AND ((${field} LIKE 'data:image/png;%' AND encode(substring(${bytes} FROM 1 FOR 8),'hex')='89504e470d0a1a0a' AND right(encode(${bytes},'hex'),24)='0000000049454e44ae426082')
 OR (${field} LIKE 'data:image/jpeg;%' AND encode(substring(${bytes} FROM 1 FOR 3),'hex')='ffd8ff' AND right(encode(${bytes},'hex'),4)='ffd9')) ELSE false END)`;
}
function validate(plan){
 if(!UUID.test(plan.requestId)||!Number.isSafeInteger(plan.userId)||plan.userId<=0||!plan.expectedCreatedAt)throw Error('Invalid reviewed request');
 for(const k of ['identityVerified','handoverReviewed','externalCopiesReviewed','freeTextReviewed'])if(plan[k]!==true)throw Error('Review incomplete');
 for(const k of ['legacyDecisions','redactions','identifiers','exceptions'])if(!Array.isArray(plan[k]))throw Error('Missing review inputs');
 validateContentReview(plan);
}
async function runDeletion(client,plan,{commit=false,beforeCommit}={}){
 validate(plan);
 if(commit&&typeof beforeCommit!=='function')throw Error('Durable deletion intent is required');
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s'");
  // Stabilize the inventory before deriving its columns, including concurrent DDL.
  // delete-account.sql repeats these guards for direct SQL rehearsals as well.
  await client.query(`DO $privacy_lock$ DECLARE t record; BEGIN
   PERFORM pg_advisory_xact_lock(hashtext('newave_flow_schema'));
   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t.tablename);
   END LOOP; END $privacy_lock$`);
  await client.query(inputs);
  await client.query('CREATE TEMP TABLE privacy_content_scope ON COMMIT DROP AS '+scopeSql);
  await client.query('INSERT INTO privacy_request VALUES($1,$2,$3,$4,$5,$6,$7)',[plan.requestId,plan.userId,plan.expectedCreatedAt,true,true,true,true]);
  for(const r of plan.legacyDecisions)await client.query('INSERT INTO privacy_legacy_decisions VALUES($1,$2)',[r.id,r.remove]);
  for(const r of plan.redactions)await client.query('INSERT INTO privacy_redactions VALUES($1,$2,$3,$4,$5)',[r.table,r.column,r.id,r.beforeMd5,r.replacement]);
  for(const value of plan.identifiers)await client.query('INSERT INTO privacy_identifiers VALUES($1) ON CONFLICT DO NOTHING',[value]);
  for(const r of plan.exceptions)await client.query('INSERT INTO privacy_exceptions VALUES($1,$2,$3,$4,$5)',[r.table,r.column,r.id,r.beforeMd5,r.reason]);
  for(const r of plan.sharedContentReview)await client.query('INSERT INTO privacy_content_review VALUES($1,$2,$3,$4,$5,$6)',[r.table,r.column,r.id,r.beforeMd5,r.decision,r.reason]);
  for(const r of plan.ownedStudentMemos)await client.query('INSERT INTO privacy_owned_student_memos VALUES($1,$2)',[r.id,r.beforeMd5]);
  await client.query(deletion);
  if(commit){await beforeCommit();await client.query('COMMIT');}else await client.query('ROLLBACK');
  return {requestId:plan.requestId,mode:commit?'executed':'rehearsed-and-rolled-back'};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
}

// A backup made after deletion has no user row. Still reject re-imported legacy rows,
// orphaned numeric references and unreviewed text; absence of the account is not proof of erasure.
async function verifyErased(client,plan){
 await verifyContentErased(client,plan);
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 const columns=(await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'")).rows;
 for(const col of columns){
  if(['user_id','teacher_id','actor_id','reporter_id','moderator_id','assigned_to_id','submitted_by','reviewed_by'].includes(col.column_name)&&['bigint','integer','smallint'].includes(col.data_type)){
   const r=await client.query(`SELECT 1 FROM public.${quote(col.table_name)} WHERE ${quote(col.column_name)}=$1 LIMIT 1`,[plan.userId]);
   if(r.rowCount)throw Error('Restored account reference requires review');
  }
  if(!['text','character varying','character'].includes(col.data_type)||col.table_name==='schema_migrations')continue;
  // These reviewed V011 fields contain SHA-256 values, not plaintext identifiers.
  // Numeric owner checks above still apply, and future text columns are still audited.
  if(appleNotificationHashes.has(`${col.table_name}.${col.column_name}`)){
   const invalid=await client.query(`SELECT 1 FROM public.${quote(col.table_name)} WHERE ${quote(col.column_name)} IS NULL OR ${quote(col.column_name)}::text !~ '^[0-9a-f]{64}$' LIMIT 1`);
   if(invalid.rowCount)throw Error('Invalid restored Apple notification hash requires review');
   continue;
  }
  const hasId=columns.some(c=>c.table_name===col.table_name&&c.column_name==='id');
  const exception=hasId?' AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS e("table" text,"column" text,id bigint,"beforeMd5" text) WHERE e."table"=$3 AND e."column"=$4 AND e.id::text=t.id::text AND e."beforeMd5"=md5(coalesce(t.'+quote(col.column_name)+"::text,'')))":'';
  const values=hasId?[plan.identifiers,JSON.stringify(plan.exceptions),col.table_name,col.column_name]:[plan.identifiers];
  const r=await client.query(`SELECT 1 FROM public.${quote(col.table_name)} t WHERE EXISTS(SELECT 1 FROM unnest($1::text[]) AS p(value) WHERE strpos(lower(t.${quote(col.column_name)}::text),lower(p.value))>0)${exception}${opaquePhotoFilter(col.table_name,col.column_name,quote)} LIMIT 1`,values);
  if(r.rowCount)throw Error('Restored personal text requires review');
 }
 const legacy=plan.legacyDecisions.filter(r=>r.remove).map(r=>r.id);
 if(columns.some(c=>c.table_name==='content_reports') &&
   (await client.query("SELECT 1 FROM content_reports WHERE (target_type='USER' OR (target_type='CONTENT' AND content_type='USER_PROFILE_PHOTO')) AND target_id=$1 LIMIT 1",[plan.userId])).rowCount)
  throw Error('Restored reported account reference requires review');
 if(columns.some(c=>c.table_name==='moderated_photos') &&
   (await client.query("SELECT 1 FROM moderated_photos WHERE target_type='USER' AND target_id=$1 LIMIT 1",[plan.userId])).rowCount)
  throw Error('Restored photo account reference requires review');
 if((await client.query('SELECT 1 FROM tts_legacy_score WHERE id=ANY($1::bigint[]) LIMIT 1',[legacy])).rowCount||
    (await client.query("SELECT 1 FROM event_participants WHERE kind='TEACHER' AND person_id=$1 LIMIT 1",[plan.userId])).rowCount)
  throw Error('Restored personal snapshot requires review');
}

// Called ONLY on an isolated restored database, before allowing it to become usable.
async function replayLedger(client,folder,decrypt){
 if(!fs.existsSync(folder))return {checked:true,replayed:0};
 if(fs.lstatSync(folder).isSymbolicLink())throw Error('Unsafe deletion ledger directory');
 const files=fs.readdirSync(folder);
 if(files.some(f=>f.endsWith('.pending.dpapi')))throw Error('Unresolved deletion intent; restore is blocked');
 let replayed=0;
 for(const file of files.filter(f=>f.endsWith('.done.dpapi'))){
  const id=file.slice(0,-11);
  if(!UUID.test(id)||fs.lstatSync(path.join(folder,file)).isSymbolicLink())throw Error('Unsafe deletion ledger');
  const plan=JSON.parse(decrypt(fs.readFileSync(path.join(folder,file))).toString('utf8'));
  validate(plan);if(plan.requestId!==id)throw Error('Deletion ledger identity mismatch');
  const existing=await client.query('SELECT id FROM users WHERE id=$1',[plan.userId]);
  if(!existing.rowCount){await verifyErased(client,plan);continue;}
  // An old backup may have different text/schema. Fail closed and require a fresh review.
  await runDeletion(client,plan,{commit:true,beforeCommit:async()=>{}});replayed++;
 }
 return {checked:true,replayed};
}
module.exports={runDeletion,replayLedger,validate,verifyErased};
