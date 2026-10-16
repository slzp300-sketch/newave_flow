const fs=require('node:fs'),path=require('node:path');
const scopeSql=fs.readFileSync(path.resolve(__dirname,'../../backend/db/privacy/content-scope.sql'),'utf8').trim().replace(/;$/,'');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const digest=/^[0-9a-f]{32}$/;
function key(r){return `${r.table}.${r.column}.${r.id}`;}
async function collectContentReview(client,userId){
 const sharedContentReview=[];
 for(const col of (await client.query(scopeSql)).rows){
  const orphanOnly=col.table_name==='student_memos'?' AND teacher_id IS NULL':'';
  const rows=(await client.query(`SELECT id,md5(${quote(col.column_name)}::text) AS digest FROM public.${quote(col.table_name)} WHERE length(trim(${quote(col.column_name)}::text))>0${orphanOnly} ORDER BY id`)).rows;
  for(const row of rows)sharedContentReview.push({table:col.table_name,column:col.column_name,id:Number(row.id),beforeMd5:row.digest,decision:null,reason:null});
 }
 const ownedStudentMemos=(await client.query('SELECT id,md5(to_jsonb(m)::text) AS digest FROM student_memos m WHERE teacher_id=$1 ORDER BY id',[userId])).rows.map(r=>({id:Number(r.id),beforeMd5:r.digest}));
 return {contentReviewVersion:1,sharedContentReview,ownedStudentMemos};
}
function validateContentReview(plan){
 if(plan.contentReviewVersion!==1||!Array.isArray(plan.sharedContentReview)||!Array.isArray(plan.ownedStudentMemos))throw Error('Content ownership review is required; older plans must be reviewed again');
 const seen=new Set();
 for(const r of plan.sharedContentReview){
  if(!/^[a-z][a-z0-9_]*$/.test(r.table)||!/^[a-z][a-z0-9_]*$/.test(r.column)||!Number.isSafeInteger(r.id)||r.id<=0||!digest.test(r.beforeMd5)||seen.has(key(r)))throw Error('Invalid content review target');
  seen.add(key(r));
  if(!['erase','redact','retain_other'].includes(r.decision)||typeof r.reason!=='string'||r.reason.trim().length<10)throw Error('Content ownership decision is incomplete');
  const redactions=plan.redactions.filter(x=>key(x)===key(r));
  if(r.decision==='redact'){
   if(redactions.length!==1||redactions[0].beforeMd5!==r.beforeMd5||typeof redactions[0].replacement!=='string')throw Error('Reviewed content replacement is required');
  }else if(redactions.length)throw Error('Conflicting content review actions');
 }
 const memos=new Set();
 for(const r of plan.ownedStudentMemos){
  if(!Number.isSafeInteger(r.id)||r.id<=0||!digest.test(r.beforeMd5)||memos.has(r.id))throw Error('Invalid personal memo review');
  memos.add(r.id);
 }
}
async function verifyContentErased(client,plan){
 validateContentReview(plan);
 if(plan.ownedStudentMemos.length&&(await client.query('SELECT 1 FROM student_memos WHERE id=ANY($1::bigint[]) LIMIT 1',[plan.ownedStudentMemos.map(r=>r.id)])).rowCount)throw Error('Restored personal memo requires review');
 for(const r of plan.sharedContentReview){
  const retained=r.decision==='retain_other';
  const expected=retained?r.beforeMd5:r.decision==='erase'?'':plan.redactions.find(x=>key(x)===key(r)).replacement;
  const field=retained?`md5(coalesce(${quote(r.column)}::text,''))`:`coalesce(${quote(r.column)}::text,'')`;
  const result=await client.query(`SELECT 1 FROM public.${quote(r.table)} WHERE id=$1 AND ${field} IS DISTINCT FROM $2 LIMIT 1`,[r.id,expected]);
  if(result.rowCount)throw Error(retained?'Restored retained content ownership requires review':'Restored authored content requires review');
 }
}
module.exports={scopeSql,collectContentReview,validateContentReview,verifyContentErased};
