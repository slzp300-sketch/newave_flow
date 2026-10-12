// Windows PC backup. No production writes; credentials and plaintext dumps are never logged.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),dns=require('node:dns').promises,tls=require('node:tls');
const {pruneExpired,assertRestorable}=require('./retention.cjs');
const {replayLedger}=require('../privacy/deletion.cjs');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'.backups');
const configFile=path.join(folder,'config.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const options={windowsHide:true,stdio:['pipe','pipe','pipe'],timeout:180000,maxBuffer:256*1024*1024};
const action=process.argv[2]||'backup';
let stage='configuration',lockOwned=false,production,localAdmin,localDb,startedLocal=false,config;
const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
function crypt(mode,buffer){return cp.execFileSync(powershell,['-NoProfile','-NonInteractive','-File',path.join(__dirname,'protect.ps1'),mode],{...options,input:buffer});}
function withDumpFile(buffer,run){
  // pg_restore --list can close stdin early on Windows. Use an ACL-protected, short-lived file.
  const file=path.join(folder,'.work-'+crypto.randomUUID()+'.dump');
  fs.writeFileSync(file,buffer,{flag:'wx',mode:0o600});
  try{return run(file);}finally{fs.unlinkSync(file);}
}
function jsonWrite(file,value){const temp=file+'.pending';fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,file);}
function log(value){fs.appendFileSync(path.join(folder,'history.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n',{mode:0o600});}
function kstDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());}
function acquireLock(){
  const file=path.join(folder,'running.lock');
  if(fs.existsSync(file)){
    const prior=JSON.parse(fs.readFileSync(file,'utf8'));
    try{process.kill(prior.pid,0);throw Error('Backup already running');}catch(e){if(e.code!=='ESRCH')throw e;}
    fs.unlinkSync(file);
  }
  fs.writeFileSync(file,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx',mode:0o600});lockOwned=true;
}
function certificateOptions(){
  const cert=new crypto.X509Certificate(fs.readFileSync(path.join(folder,'server.crt')));
  return {rejectUnauthorized:true,ca:fs.readFileSync(path.join(folder,'ca.crt'),'utf8'),servername:'localhost',
    checkServerIdentity:(_host,peer)=>peer.fingerprint256!==cert.fingerprint256?Error('Pinned database certificate changed'):tls.checkServerIdentity('localhost',peer)};
}
async function connectProduction(){
  const raw=cp.execFileSync(config.railwayCli,['variables','--project',config.project,'--environment',config.environment,'--service',config.service,'--json'],{...options,encoding:'utf8',timeout:45000});
  const variables=JSON.parse(raw),url=new URL(variables.DATABASE_PUBLIC_URL);url.search='';
  if(url.protocol!=='postgresql:'&&url.protocol!=='postgres:')throw Error('Unexpected database scheme');
  const {Client}=require(config.pgModule);
  const client=new Client({connectionString:url.href,ssl:certificateOptions(),connectionTimeoutMillis:15000,
    statement_timeout:120000,options:'-c default_transaction_read_only=on'});
  await client.connect();production=client;
  const address=(await dns.lookup(url.hostname,{family:4})).address;
  // pg_dump verifies the trusted certificate's localhost name while connecting to the actual proxy IP.
  const env={...process.env,PGHOST:'localhost',PGHOSTADDR:address,PGPORT:url.port||'5432',
    PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
    PGSSLMODE:'verify-full',PGSSLROOTCERT:path.join(folder,'ca.crt'),PGCONNECT_TIMEOUT:'15',
    PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000'};
  return {client,env};
}
async function fingerprints(client){
  const tables=(await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
  const result={};
  if(!tables.length)return result;
  const sql=tables.map(table=>{
    const quoted='"'+table.replaceAll('"','""')+'"';
    return `select '${table.replaceAll("'","''")}' as name, count(*)::int as rows, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from ${quoted} t`;
  }).join(' UNION ALL ');
  const rows=(await client.query(sql)).rows.sort((a,b)=>a.name.localeCompare(b.name));
  for(const {name,...value} of rows)result[name]=value;
  return result;
}
async function createBackup(){
  const lastFile=path.join(folder,'last-success.json');
  if(!process.argv.includes('--force')&&fs.existsSync(lastFile)){
    const last=JSON.parse(fs.readFileSync(lastFile,'utf8'));
    if(last.day===kstDay()&&fs.existsSync(path.join(folder,last.file))){console.log(JSON.stringify({skipped:'Already backed up today',at:last.at}));return;}
  }
  stage='release-info';
  const releaseQuery=`query { serviceInstance(environmentId:"${config.environment}",serviceId:"${config.backendService}") { activeDeployments { id status meta } } }`;
  const releases=JSON.parse(cp.execFileSync(config.railwayCli,['api',releaseQuery,'--compact'],{...options,encoding:'utf8',timeout:45000}));
  if(releases.errors)throw Error('Deployment metadata unavailable');
  const appReleases=releases.data.serviceInstance.activeDeployments.map(d=>({id:d.id,status:d.status,commit:d.meta?.commitHash||null}));
  stage='connect';const {client,env}=await connectProduction();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot=(await client.query('select pg_export_snapshot() as snapshot')).rows[0].snapshot;
  stage='snapshot';const tables=await fingerprints(client);
  stage='dump';const dump=cp.execFileSync(path.join(config.pgBin,'pg_dump.exe'),['--format=custom','--no-owner','--no-acl','--lock-wait-timeout=10000','--snapshot='+snapshot],{...options,env});
  await client.query('COMMIT');await client.end();production=null;
  if(dump.subarray(0,5).toString()!=='PGDMP')throw Error('Invalid dump');
  stage='encrypt';const encrypted=crypt('Protect',dump),roundtrip=crypt('Unprotect',encrypted);
  if(hash(roundtrip)!==hash(dump))throw Error('Encryption verification failed');
  stage='catalog';withDumpFile(roundtrip,file=>cp.execFileSync(path.join(config.pgBin,'pg_restore.exe'),['--list',file],options));
  const at=new Date().toISOString(),id=at.replace(/[:.]/g,'-'),file='newave-'+id+'.dump.dpapi';
  const receipt={at,day:kstDay(),file,sha256:hash(dump),bytes:dump.length,encryptedBytes:encrypted.length,
    project:config.project,environment:config.environment,service:config.service,tables,appReleases,
    encryption:'Windows DPAPI CurrentUser',tls:'Pinned server certificate + trusted CA; pg_dump verify-full',snapshotConsistent:true};
  fs.writeFileSync(path.join(folder,file+'.pending'),encrypted,{mode:0o600});fs.renameSync(path.join(folder,file+'.pending'),path.join(folder,file));
  jsonWrite(path.join(folder,file+'.json'),receipt);jsonWrite(lastFile,receipt);
  log({event:'backup-success',file,bytes:dump.length,tables:Object.keys(tables).length});
  console.log(JSON.stringify({backup:'complete',file,at,bytes:dump.length,tables:Object.keys(tables).length,encrypted:true}));
}
async function verifyRestore(){
  const receipt=JSON.parse(fs.readFileSync(path.join(folder,'last-success.json'),'utf8'));
  assertRestorable(receipt);
  if(!/^newave-[\dTZ.-]+\.dump\.dpapi$/.test(receipt.file))throw Error('Invalid backup path');
  stage='decrypt';const dump=crypt('Unprotect',fs.readFileSync(path.join(folder,receipt.file)));
  if(hash(dump)!==receipt.sha256)throw Error('Backup hash mismatch');
  const {Client}=require(config.pgModule),verify=config.localVerification;
  if(verify.host!=='127.0.0.1'||verify.port!==55440)throw Error('Restore must remain local');
  const local={host:verify.host,port:verify.port,user:verify.user,password:fs.readFileSync(verify.passwordFile,'utf8'),database:'postgres',connectionTimeoutMillis:15000};
  stage='local-start';
  if(cp.spawnSync(path.join(config.pgBin,'pg_ctl.exe'),['-D',verify.dataDirectory,'status'],{windowsHide:true,stdio:'ignore'}).status!==0){
    cp.execFileSync(path.join(config.pgBin,'pg_ctl.exe'),['-D',verify.dataDirectory,'-l',path.join(folder,'restore-server.log'),'-o','-h 127.0.0.1 -p 55440','-w','start'],{...options,stdio:'ignore'});startedLocal=true;
  }
  localAdmin=new Client(local);await localAdmin.connect();
  const candidate='newave_backup_verify_'+Date.now();
  await localAdmin.query('CREATE DATABASE '+candidate);
  localDb=candidate; // Cleanup may only drop the database this run actually created.
  stage='restore';withDumpFile(dump,file=>cp.execFileSync(path.join(config.pgBin,'pg_restore.exe'),['--host=127.0.0.1','--port=55440','--username='+verify.user,'--dbname='+localDb,'--no-owner','--no-privileges','--exit-on-error','--single-transaction',file],
    {...options,env:{...process.env,PGPASSWORD:local.password,PGSSLMODE:'disable',PGHOSTADDR:'127.0.0.1',PGOPTIONS:'',PGSSLROOTCERT:''}}));
  const restored=new Client({...local,database:localDb});await restored.connect();
  let actual,privacy;
  try{
    actual=await fingerprints(restored);
    stage='compare';if(!require('node:util').isDeepStrictEqual(actual,receipt.tables))throw Error('Restored tables differ from source snapshot');
    stage='privacy-replay';privacy=await replayLedger(restored,path.join(folder,'privacy'),buffer=>crypt('Unprotect',buffer));
  }finally{await restored.end();}
  const result={at:new Date().toISOString(),file:receipt.file,sha256:receipt.sha256,tables:Object.keys(actual).length,
    rows:Object.values(actual).reduce((n,t)=>n+t.rows,0),allTableHashesMatch:true,privacy};
  jsonWrite(path.join(folder,'last-restore-verification.json'),result);log({event:'restore-verified',...result});
  console.log(JSON.stringify({restore:'verified',...result}));
}
(async()=>{
  config=JSON.parse(fs.readFileSync(configFile,'utf8'));acquireLock();
  stage='retention';
  const retention=pruneExpired(folder,{dryRun:process.argv.includes('--dry-run')});
  log({event:'retention',...retention});
  if(action==='prune'){console.log(JSON.stringify(retention));return;}
  if(process.argv.includes('--dry-run'))throw Error('Dry run is only supported for prune');
  if(action==='backup') {
    await createBackup();
    const lastVerifyFile=path.join(folder,'last-restore-verification.json');
    const prior=fs.existsSync(lastVerifyFile)?JSON.parse(fs.readFileSync(lastVerifyFile,'utf8')):null;
    if(!prior||Date.now()-new Date(prior.at).getTime()>=7*86400000)await verifyRestore();
  } else if(action==='verify')await verifyRestore();else throw Error('Unknown action');
})().catch(e=>{
  // Do not leak CLI output, connection strings, SQL rows or passwords into task history.
  const failure={event:'failure',stage,code:typeof e.code==='string'?e.code:'FAILED',action};
  if(e.stderr){
    const message=Buffer.from(e.stderr).toString('utf8');
    failure.diagnosticFlags={snapshot:/snapshot/i.test(message),timeout:/timeout|timed out/i.test(message),
      ssl:/ssl|certificate/i.test(message),connection:/connection|connect/i.test(message),permission:/permission|denied/i.test(message),
      idle:/idle/i.test(message),version:/version mismatch/i.test(message)};
    failure.exitStatus=e.status;failure.signal=e.signal;
    fs.writeFileSync(path.join(folder,'last-diagnostics-private.txt'),message,{mode:0o600});
  }
  try{log(failure);jsonWrite(path.join(folder,'last-failure.json'),{at:new Date().toISOString(),...failure});}catch{}
  console.error(JSON.stringify(failure));process.exitCode=1;
}).finally(async()=>{
  if(production)await production.end().catch(()=>{});
  if(localAdmin){
    if(localDb&&/^newave_backup_verify_\d+$/.test(localDb))await localAdmin.query('DROP DATABASE '+localDb).catch(()=>{process.exitCode=1;});
    await localAdmin.end().catch(()=>{});
  }
  if(startedLocal)cp.spawnSync(path.join(config.pgBin,'pg_ctl.exe'),['-D',config.localVerification.dataDirectory,'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore'});
  if(lockOwned)fs.unlinkSync(path.join(folder,'running.lock'));
});
