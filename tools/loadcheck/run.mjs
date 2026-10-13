import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import http from 'node:http';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import os from 'node:os';

const repo = path.resolve(import.meta.dirname,'../..');
const heap = Number(process.argv[2] || 512);
if (![512,1024].includes(heap)) throw new Error('Allowed synthetic heap sizes: 512, 1024 MiB');
const run = path.join(repo,`backend/.verification/loadcheck/run-${heap}-${Date.now()}`);
mkdirSync(run,{recursive:true});
const java = path.join(process.env.JAVA_HOME,'bin/java.exe');
const cp = readFileSync(path.join(repo,'backend/.verification/loadcheck/classpath.txt'),'utf8');
const log = openSync(path.join(run,'server.log'),'a');
const password = randomBytes(24).toString('base64url');
// Explicit arguments in the harness override inherited DB settings; no live data is used.
const server = spawn(java,[`-Xms128m`,`-Xmx${heap}m`,'-XX:ActiveProcessorCount=2','-cp',cp,'loadcheck.LoadFixtureServer',run],{
  cwd:path.join(repo,'backend'),windowsHide:true,stdio:['ignore',log,log],
  env:{...process.env,LOADCHECK_PASSWORD:password,LOADCHECK_JWT:randomBytes(48).toString('base64url')}
});
writeFileSync(path.join(run,'pid.txt'),String(server.pid));
const agent = new http.Agent({keepAlive:true,maxSockets:200});
let measurements=[],checks=0,inflight=0,maxInflight=0;
async function request(label,method,url,token,body,expected=200) {
  assert(url.startsWith('/api/'));
  const payload=body===undefined?undefined:JSON.stringify(body);
  const start=performance.now(); inflight++; maxInflight=Math.max(maxInflight,inflight);
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:18083,path:url,method,agent,timeout:30000,
      headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{})}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{
        inflight--; const ms=performance.now()-start;
        measurements.push({label,method,ms,status:res.statusCode,ok:res.statusCode===expected});
        if(res.statusCode!==expected) return reject(new Error(`${label}: HTTP ${res.statusCode}, expected ${expected}`));
        const raw=Buffer.concat(chunks).toString();
        try{resolve(raw?JSON.parse(raw):null);}catch(e){reject(new Error(`${label}: invalid JSON`));}
      });
    });
    req.on('timeout',()=>req.destroy(new Error('timeout')));
    req.on('error',e=>{inflight--;measurements.push({label,method,ms:performance.now()-start,status:0,ok:false});reject(e);});
    req.end(payload);
  });
}
const percentile=(xs,p)=>xs[Math.max(0,Math.ceil(xs.length*p)-1)] || 0;
let outcome={passed:false};
try {
  for(let i=0;i<240&&!existsSync(path.join(run,'ready'));i++){
    if(server.exitCode!==null) throw new Error('Synthetic server exited during startup; inspect server.log');
    await sleep(1000);
  }
  if(!existsSync(path.join(run,'ready')))throw new Error('Fixture startup timeout');
  const fixture=JSON.parse(readFileSync(path.join(run,'fixture.json'),'utf8'));
  assert.equal(fixture.fixtureType,'synthetic-only'); assert.equal(fixture.accounts.length,100);
  const users=fixture.accounts;
  // Warm the route/JIT once; the measured burst still performs 100 BCrypt verifications.
  await request('warmup','POST','/api/auth/login',null,{email:users[0].email,password}); measurements=[];
  const began=performance.now();
  await Promise.all(users.map(async u=>{const r=await request('login100','POST','/api/auth/login',null,{email:u.email,password});assert(r.accessToken);u.token=r.accessToken;}));
  const burstSeconds=(performance.now()-began)/1000;
  console.log(`LOGIN_BURST_COMPLETE heap=${heap} users=100 seconds=${burstSeconds.toFixed(2)}`);
  let iterationFailures=[];
  const mixedStart=performance.now();
  await Promise.all(users.map(async u=>{
    for(let round=0;round<8;round++){
      try {
        await request('home-week','GET',`/api/tts/week?date=${fixture.today}`,u.token);
        await request('schedule','GET','/api/events',u.token);
        await request('tts-save','PUT','/api/tts/answer',u.token,{weekStart:fixture.sunday,questionId:fixture.questionIds[2],answerData:String(u.index%2===0)});
        await request('tts-daily-save','PUT','/api/tts/answer',u.token,{weekStart:fixture.sunday,questionId:fixture.questionIds[0],answerData:JSON.stringify({'월':u.index%2===1})});
        await request('attendance-save','POST','/api/attendance/batch',u.token,{classGroupId:u.classId,attendanceDate:fixture.sunday,
          records:u.studentIds.map((studentId,i)=>({studentId,status:i===9?'ABSENT':'PRESENT',absentReason:i===9?'가상 사유':null}))});
        await request('attendance-submit','POST',`/api/attendance/submit?classId=${u.classId}&date=${fixture.sunday}`,u.token);
        await request('event-save','POST',`/api/events/${fixture.eventId}/teacher-attendance`,u.token,{status:u.index%2===0?'PRESENT':'ABSENT',absenceReason:u.index%2?'가상 사유':null});
        if(round===0||round===4) await request('event-students-save','POST',`/api/events/${fixture.eventId}/student-attendance/batch`,u.token,
          {records:u.studentIds.map((studentId,i)=>({studentId,status:i===9?'ABSENT':'PRESENT',absenceReason:i===9?'가상 사유':null}))});
        await request('attendance-read','GET',`/api/attendance?classId=${u.classId}&date=${fixture.sunday}`,u.token);
        if(round===2||round===6) await request('stats-year','GET',`/api/tts/stats?year=${fixture.year}`,u.token);
        await sleep(350 + (u.index%10)*30);
      }catch(e){iterationFailures.push({user:u.index,round,error:e.message});}
    }
  }));
  const mixedSeconds=(performance.now()-mixedStart)/1000;
  console.log(`MIXED_COMPLETE heap=${heap} requests=${measurements.length} errors=${iterationFailures.length}`);
  // All 100 identities retain their own final response; paired teachers share one class.
  for(const u of users){
    const week=await request('verify-tts','GET',`/api/tts/week?date=${fixture.today}`,u.token);
    assert.equal(week.answers.find(a=>a.questionId===fixture.questionIds[2])?.answerData,String(u.index%2===0));checks++;
    const dailyAnswer=week.answers.find(a=>a.questionId===fixture.questionIds[0]);
    assert(dailyAnswer,'Saved daily answer must exist');
    // The API stores checked days only; an unchecked day is absent, not false.
    assert.equal(JSON.parse(dailyAnswer.answerData)['월']===true,u.index%2===1);checks++;
    const event=await request('verify-event','GET',`/api/events/${fixture.eventId}/teacher-attendance`,u.token);
    assert.equal(event.status,u.index%2===0?'PRESENT':'ABSENT');checks++;
    const attendance=await request('verify-attendance','GET',`/api/attendance?classId=${u.classId}&date=${fixture.sunday}`,u.token);
    assert.equal(attendance.length,10);assert.equal(attendance.filter(a=>a.status==='PRESENT').length,9);checks++;
    const eventStudents=await request('verify-event-students','GET',`/api/events/${fixture.eventId}/student-attendance`,u.token);
    assert.equal(eventStudents.length,10);assert.equal(eventStudents.filter(a=>a.status==='PRESENT').length,9);checks++;
  }
  // A teacher cannot write into another synthetic class, and unauthenticated access is denied.
  await request('isolation-foreign-write','POST','/api/attendance/batch',users[0].token,{classGroupId:users[2].classId,attendanceDate:fixture.sunday,
    records:[{studentId:users[2].studentIds[0],status:'ABSENT',absentReason:'must be rejected'}]},403); checks++;
  await request('isolation-no-login','GET','/api/tts/week',null,undefined,401);checks++;
  const groups=Object.groupBy(measurements,r=>r.label);
  const stats=Object.fromEntries(Object.entries(groups).map(([k,rows])=>{const times=rows.map(r=>r.ms).sort((a,b)=>a-b);return[k,{requests:rows.length,errors:rows.filter(r=>!r.ok).length,p50ms:percentile(times,.5),p95ms:percentile(times,.95),p99ms:percentile(times,.99),maxms:times.at(-1)}];}));
  const metrics=readFileSync(path.join(run,'metrics.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  outcome={passed:iterationFailures.length===0&&measurements.every(r=>r.ok),heapMiB:heap,cpuVisibleToJvm:2,users:100,
    totalRequests:measurements.length,maxInflight,checks,burstSeconds,mixedSeconds,iterationFailures,stats,
    maxHeapUsedMiB:Math.max(...metrics.map(r=>r.heapUsed))/1048576,maxPoolWaiting:Math.max(...metrics.map(r=>r.poolWaiting)),
    maxThreads:Math.max(...metrics.map(r=>r.threads)),host:{os:os.platform(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramGiB:os.totalmem()/1073741824},
    limitations:['Local loopback HTTP, not production network or device rendering','JVM heap cap, not a 1/2GB service memory limit','Synthetic DB schema generated by current entities; migration tests are separate']};
}catch(e){outcome.error=e.message;process.exitCode=1;}
finally {
  if(server.exitCode===null){
    const sample=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      `$p=Get-Process -Id ${server.pid}; [pscustomobject]@{peakWorkingSetMiB=$p.PeakWorkingSet64/1MB;privateMiB=$p.PrivateMemorySize64/1MB;cpuSeconds=$p.CPU} | ConvertTo-Json -Compress`],{windowsHide:true,encoding:'utf8'});
    if(sample.status===0){try{outcome.process=JSON.parse(sample.stdout);}catch{}}
  }
  writeFileSync(path.join(run,'results.json'),JSON.stringify(outcome,null,2));
  writeFileSync(path.join(run,'requests.json'),JSON.stringify(measurements));
  agent.destroy(); server.kill(); closeSync(log);
  console.log(JSON.stringify({run,passed:outcome.passed,error:outcome.error,totalRequests:outcome.totalRequests,checks:outcome.checks}));
  if(!outcome.passed)process.exitCode=1;
}
