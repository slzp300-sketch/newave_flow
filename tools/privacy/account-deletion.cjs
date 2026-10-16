// Operator-only erasure CLI: HTTP accepts requests but never performs the reviewed deletion.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),tls=require('node:tls');
const {runDeletion}=require('./deletion.cjs');
const {collectContentReview}=require('./content-review.cjs');
const root=path.resolve(__dirname,'../..'),privateRoot=process.env.NEWAVE_BACKUP_DIRECTORY
 ? path.resolve(process.env.NEWAVE_BACKUP_DIRECTORY) : path.join(root,'.backups');
const config=JSON.parse(fs.readFileSync(path.join(privateRoot,'config.json'),'utf8'));
const folder=path.join(privateRoot,'privacy'),action=process.argv[2],arg=process.argv[3];
const opts={windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024,timeout:45000};
function crypt(mode,data){
 if(config.dpapiPython){
  if(!path.isAbsolute(config.dpapiPython))throw Error('DPAPI Python path must be absolute');
  return cp.execFileSync(config.dpapiPython,[path.join(root,'tools/backup/protect.py'),mode],{...opts,input:data});
 }
 return cp.execFileSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(root,'tools/backup/protect.ps1'),mode],{...opts,input:data});
}
function checkFolder(){
 fs.mkdirSync(folder,{recursive:true,mode:0o700});
 if(fs.lstatSync(folder).isSymbolicLink()||fs.realpathSync(folder)!==path.resolve(folder))throw Error('Unsafe privacy folder');
}
async function connect(){
 if(action==='rehearse'){
  const v=config.localVerification,database=process.env.PRIVACY_REHEARSAL_DATABASE;
  if(v.host!=='127.0.0.1'||v.port!==55440||!/^newave_privacy_[a-z0-9_]+$/.test(database||''))throw Error('Rehearsal requires an isolated local database');
  const {Client}=require(config.pgModule),client=new Client({host:v.host,port:v.port,user:v.user,password:fs.readFileSync(v.passwordFile,'utf8'),database});
  await client.connect();return client;
 }
 const raw=cp.execFileSync(config.railwayCli,['variables','--project',config.project,'--environment',config.environment,'--service',config.service,'--json'],{...opts,encoding:'utf8'});
 const url=new URL(JSON.parse(raw).DATABASE_PUBLIC_URL);url.search='';
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Unexpected database scheme');
 const cert=new crypto.X509Certificate(fs.readFileSync(path.join(privateRoot,'server.crt')));
 const {Client}=require(config.pgModule);
 const client=new Client({connectionString:url.href,connectionTimeoutMillis:15000,
  ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(privateRoot,'ca.crt'),'utf8'),servername:'localhost',
   checkServerIdentity:(_h,p)=>p.fingerprint256!==cert.fingerprint256?Error('Pinned certificate changed'):tls.checkServerIdentity('localhost',p)},
  options:['plan','requests'].includes(action)?'-c default_transaction_read_only=on':''});
 await client.connect();return client;
}
let client;
(async()=>{
 if(!['requests','plan','rehearse','execute'].includes(action))throw Error('Use requests, plan <userId>, rehearse <private-plan-file> or execute <private-plan-file> <requestId>');
 checkFolder();client=await connect();
 if(action==='requests'){
  const result=await client.query("SELECT id AS request_id,user_id,requested_at,target_at,handover_required FROM account_deletion_requests WHERE status='REQUESTED' ORDER BY requested_at");
  // Internal IDs and dates only; no names, addresses, password or receipt token hashes.
  console.log(JSON.stringify({requests:result.rows}));return;
 }
 if(action==='plan'){
  const id=Number(arg);if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid account ID');
  const result=await client.query('SELECT id,name,email,phone,kakao_id,created_at::text FROM users WHERE id=$1',[id]);
  if(result.rowCount!==1||!result.rows[0].created_at)throw Error('A uniquely identified account is required');
  const u=result.rows[0];let requestId=crypto.randomUUID();
  const receiptTable=await client.query("SELECT to_regclass('public.account_deletion_requests') AS name");
  if(receiptTable.rows[0].name){
   const receipt=await client.query("SELECT id,user_created_at::text FROM account_deletion_requests WHERE user_id=$1 AND status='REQUESTED'",[id]);
   if(receipt.rowCount){
    if(receipt.rows[0].user_created_at!==u.created_at)throw Error('App deletion request no longer matches the account');
    requestId=receipt.rows[0].id;
   }
  }
  const legacy=await client.query('SELECT id FROM tts_legacy_score WHERE name=$1 ORDER BY id',[u.name]);
  const plan={requestId,userId:id,expectedCreatedAt:u.created_at,identityVerified:false,handoverReviewed:false,externalCopiesReviewed:false,freeTextReviewed:false,
   identifiers:[u.name,u.email,u.phone,u.kakao_id].filter(v=>v&&v.trim().length>=2),legacyDecisions:legacy.rows.map(r=>({id:Number(r.id),remove:null})),redactions:[],exceptions:[]};
  const appleTable=await client.query("SELECT to_regclass('public.apple_accounts') AS name");
  if(appleTable.rows[0].name){
   const apple=await client.query('SELECT subject FROM apple_accounts WHERE user_id=$1',[id]);
   for(const row of apple.rows)if(row.subject)plan.identifiers.push(row.subject);
  }
  const quote=v=>'"'+v.replaceAll('"','""')+'"';
  const columns=await client.query("SELECT c.table_name,c.column_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.data_type IN ('text','character varying','character') AND EXISTS(SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=c.table_name AND k.column_name='id') ORDER BY c.table_name,c.column_name");
  plan.reviewCandidates=[];
  for(const col of columns.rows){
   const found=await client.query(`SELECT id,md5(coalesce(${quote(col.column_name)}::text,'')) AS digest FROM public.${quote(col.table_name)} WHERE EXISTS(SELECT 1 FROM unnest($1::text[]) p(value) WHERE strpos(lower(${quote(col.column_name)}::text),lower(p.value))>0)`,[plan.identifiers]);
   for(const row of found.rows)plan.reviewCandidates.push({table:col.table_name,column:col.column_name,id:Number(row.id),beforeMd5:row.digest});
  }
  Object.assign(plan,await collectContentReview(client,id));
  // ACL inherits the restricted .backups directory. This review file must be removed after processing.
  const file=path.join(folder,requestId+'.review.json');fs.writeFileSync(file,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({requestId,reviewFile:file,legacyRows:legacy.rowCount,sharedFields:plan.sharedContentReview.length,personalMemos:plan.ownedStudentMemos.length,reviewRequired:true}));return;
 }
 const file=path.resolve(arg||'');
 if(path.dirname(file)!==folder||!file.endsWith('.review.json')||fs.lstatSync(file).isSymbolicLink())throw Error('Review must be inside the protected privacy directory');
 const plan=JSON.parse(fs.readFileSync(file,'utf8'));
 if(plan.legacyDecisions.some(r=>typeof r.remove!=='boolean'))throw Error('Legacy ownership decisions are incomplete');
 if(action==='execute'&&process.argv[4]!==plan.requestId)throw Error('Exact reviewed request ID confirmation required');
 if(action==='execute'&&process.argv[5]!=='--maintenance-confirmed')throw Error('Stop the backend and in-flight jobs before execution');
 const pending=path.join(folder,plan.requestId+'.pending.dpapi'),done=path.join(folder,plan.requestId+'.done.dpapi');
 if(fs.existsSync(pending)||fs.existsSync(done))throw Error('Existing deletion intent must be reconciled first');
 const outcome=await runDeletion(client,plan,{commit:action==='execute',beforeCommit:async()=>{
  const encrypted=crypt('Protect',Buffer.from(JSON.stringify({...plan,deletedAt:new Date().toISOString()})));
  const fd=fs.openSync(pending,'wx',0o600);try{fs.writeFileSync(fd,encrypted);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 }});
 if(action==='execute'){fs.renameSync(pending,done);fs.unlinkSync(file);}
 console.log(JSON.stringify(outcome));
})().catch(e=>{
 // Fixed reason categories only; driver diagnostics may include private values.
 console.error(JSON.stringify({status:'not-complete',action,code:typeof e.code==='string'?e.code:'REVIEW_OR_EXECUTION_FAILED'}));process.exitCode=1;
}).finally(async()=>{if(client)await client.end();});
