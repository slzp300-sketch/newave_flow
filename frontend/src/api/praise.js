import client from './client'
import {Capacitor,registerPlugin} from '@capacitor/core'
import {encodeReportBlob} from '../native/reportDownload'
const unwrap=p=>p.then(r=>r.data)
export const praiseApi={
 get:term=>unwrap(client.get('/praise',{params:{term}})),
 create:body=>unwrap(client.post('/praise/terms',body)),
 save:(term,path,body)=>unwrap(client.put(`/praise/terms/${term}/${path}`,body)),
 generate:(term,body)=>unwrap(client.post(`/praise/terms/${term}/weeks`,body)),
 upload:(term,week,revision,file)=>{const body=new FormData();body.append('file',file);body.append('revision',revision);return unwrap(client.post(`/praise/terms/${term}/weeks/${week}/pdf`,body,{headers:{'Content-Type':'multipart/form-data'}}))},
 pdf:id=>unwrap(client.get(`/praise/pdf/${id}`,{responseType:'blob'})),
 page:(id,page)=>unwrap(client.get(`/praise/pdf/${id}/pages/${page}`,{responseType:'blob'})),
}
export async function savePraisePdf(blob,week,version){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||!Number.isInteger(version)||version<1||!blob?.size||blob.size>5*1024*1024)throw new Error('콘티 파일을 확인해주세요.')
 const filename=`찬양팀 콘티 (${week}) v${version}.pdf`
 if(Capacitor.getPlatform()==='ios'){const result=await registerPlugin('NewaveReportExport').save({filename,base64:await encodeReportBlob(blob)});return !result.cancelled}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true
}
