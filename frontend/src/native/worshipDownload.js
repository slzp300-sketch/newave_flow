import {encodeReportBlob} from './reportDownload.js'
import {isWorshipDate} from '../utils/worship.js'
export function createWorshipDownloader({platform,native,document,urls,schedule=setTimeout}) {
 return async (blob,date)=>{
  if(!isWorshipDate(date)||!blob?.size||blob.size>25*1024*1024)throw new Error('공지 이미지 형식을 확인해주세요.')
  const signature=new Uint8Array(await blob.slice(0,8).arrayBuffer())
  if(![137,80,78,71,13,10,26,10].every((b,i)=>b===signature[i]))throw new Error('PNG 이미지만 저장할 수 있습니다.')
  const filename='예배위원 공지 ('+date+').png'
  if(platform==='ios'){const result=await native.save({filename,base64:await encodeReportBlob(blob)});return {status:result.cancelled?'cancelled':'saved'}}
  const url=urls.createObjectURL(blob),link=document.createElement('a')
  try{link.href=url;link.download=filename;document.body.appendChild(link);link.click()}
  finally{link.remove();schedule(()=>urls.revokeObjectURL(url),60000)}
  return {status:'started'}
 }
}
