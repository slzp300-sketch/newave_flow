import {committeeRows,worshipDateLabel} from '../../utils/worship.js'
// Keep all names, including long offering lists, by expanding the image height.
export function wrapNoticeText(text,measure,width) {
 const lines=[]
 for(const paragraph of text.split('\n')){
  let line=''
  for(const char of paragraph){if(line&&measure(line+char)>width){lines.push(line);line=char}else line+=char}
  lines.push(line)
 }
 return lines
}
export async function createNoticeImage(data) {
 await document.fonts?.ready
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')
 if(!ctx)throw new Error('이미지를 만들지 못했습니다.')
 const font=size=>'600 '+size+'px Pretendard, sans-serif'
 ctx.font=font(30)
 const rows=committeeRows(data).map(([label,value])=>({label,lines:wrapNoticeText(value,t=>ctx.measureText(t).width,720)}))
 const note=wrapNoticeText(data.noticeMessage||'이번 주 예배를 함께 준비해주세요.',t=>ctx.measureText(t).width,720)
 const height=290+rows.reduce((sum,r)=>sum+94+r.lines.length*44,0)+note.length*42+100
 canvas.width=900;canvas.height=height
 ctx.fillStyle='#f5f6fc';ctx.fillRect(0,0,900,height)
 ctx.fillStyle='#103681';ctx.fillRect(0,0,900,238)
 ctx.fillStyle='#c5d3ff';ctx.font=font(23);ctx.fillText('NEWAVE FLOW  ·  청소년부',60,64)
 ctx.fillStyle='#ffffff';ctx.font=font(46);ctx.fillText('이번 주 예배위원',60,133)
 ctx.font=font(28);ctx.fillText(worshipDateLabel(data.date)+' 주일',60,189)
 let y=268
 for(const row of rows){
  const h=94+row.lines.length*44
  ctx.fillStyle='#ffffff';ctx.fillRect(40,y,820,h-14)
  ctx.fillStyle='#6a58a5';ctx.font=font(24);ctx.fillText(row.label,74,y+43)
  ctx.fillStyle='#153367';ctx.font=font(30)
  row.lines.forEach((line,i)=>ctx.fillText(line,74,y+86+i*44))
  y+=h
 }
 ctx.fillStyle='#52617f';ctx.font=font(27)
 note.forEach((line,i)=>ctx.fillText(line,74,y+47+i*42))
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지를 만들지 못했습니다.')),'image/png'))
}
