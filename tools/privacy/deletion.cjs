const fs=require('node:fs'),path=require('node:path');
const sqlRoot=path.resolve(__dirname,'../../backend/db/privacy');
const inputs=fs.readFileSync(path.join(sqlRoot,'request-tables.sql'),'utf8');
const deletion=fs.readFileSync(path.join(sqlRoot,'delete-account.sql'),'utf8');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appleNotificationHashes=new Set([
 'apple_notification_subjects.subject_hash',
 'apple_notification_receipts.subject_hash',
 'apple_notification_receipts.jti_hash',
 'apple_notification_receipts.payload_hash',
]);
function validate(plan){
 if(!UUID.test(plan.requestId)||!Number.isSafeInteger(plan.userId)||plan.userId<=0||!plan.expectedCreatedAt)throw Error('Invalid reviewed request');
 for(const k of ['identityVerified','handoverReviewed','externalCopiesReviewed','freeTextReviewed'])if(plan[k]!==true)throw Error('Review incomplete');
 for(const k of ['legacyDecisions','redactions','identifiers','exceptions'])if(!Array.isArray(plan[k]))throw Error('Missing review inputs');
}
async function runDeletion(client,plan,{commit=false,beforeCommit}={}){
 validate(plan);
 if(commit&&typeof beforeCommit!=='function')throw Error('Durable deletion intent is required');
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s'");
  await client.query(inputs);
  await client.query('INSERT INTO privacy_request VALUES($1,$2,$3,$4,$5,$6,$7)',[plan.requestId,plan.userId,plan.expectedCreatedAt,true,true,true,true]);
  for(const r of plan.legacyDecisions)await client.query('INSERT INTO privacy_legacy_decisions VALUES($1,$2)',[r.id,r.remove]);
  for(const r of plan.redactions)await client.query('INSERT INTO privacy_redactions VALUES($1,$2,$3,$4,$5)',[r.table,r.column,r.id,r.beforeMd5,r.replacement]);
  for(const value of plan.identifiers)await client.query('INSERT INTO privacy_identifiers VALUES($1) ON CONFLICT DO NOTHING',[value]);
  for(const r of plan.exceptions)await client.query('INSERT INTO privacy_exceptions VALUES($1,$2,$3,$4,$5)',[r.table,r.column,r.id,r.beforeMd5,r.reason]);
  await client.query(deletion);
  if(commit){await beforeCommit();await client.query('COMMIT');}else await client.query('ROLLBACK');
  return {requestId:plan.requestId,mode:commit?'executed':'rehearsed-and-rolled-back'};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
}

// A backup made after deletion has no user row. Still reject re-imported legacy rows,
// orphaned numeric references and unreviewed text; absence of the account is not proof of erasure.
async function verifyErased(client,plan){
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 const columns=(await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'")).rows;
 for(const col of columns){
  if(['user_id','teacher_id','actor_id','reporter_id','moderator_id'].includes(col.column_name)&&['bigint','integer','smallint'].includes(col.data_type)){
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
  const r=await client.query(`SELECT 1 FROM public.${quote(col.table_name)} t WHERE EXISTS(SELECT 1 FROM unnest($1::text[]) AS p(value) WHERE strpos(lower(t.${quote(col.column_name)}::text),lower(p.value))>0)${exception} LIMIT 1`,values);
  if(r.rowCount)throw Error('Restored personal text requires review');
 }
 const legacy=plan.legacyDecisions.filter(r=>r.remove).map(r=>r.id);
 if(columns.some(c=>c.table_name==='content_reports') &&
   (await client.query("SELECT 1 FROM content_reports WHERE target_type='USER' AND target_id=$1 LIMIT 1",[plan.userId])).rowCount)
  throw Error('Restored reported account reference requires review');
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
