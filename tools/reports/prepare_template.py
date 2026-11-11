"""Create a data-free church HWPX template; the input is always read only."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
from lxml import etree as E

HP='http://www.hancom.co.kr/hwpml/2011/paragraph'
HH='http://www.hancom.co.kr/hwpml/2011/head'
NS={'hp':HP,'hh':HH}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    with ZipFile(args.input) as source:
        entries={n:source.read(n) for n in source.namelist()}
    section=E.fromstring(entries['Contents/section0.xml'])
    header=E.fromstring(entries['Contents/header.xml'])
    table=section.find('.//hp:tbl',NS);rows=table.findall('hp:tr',NS)
    assert len(rows)==94 and table.get('colCnt')=='42'
    chars={c.get('id'):c for c in header.findall('.//hh:charPr',NS)}
    paras={p.get('id'):p for p in header.findall('.//hh:paraPr',NS)}
    borders={b.get('id'):b for b in header.findall('.//hh:borderFill',NS)}
    dynamic={(0,0):'title',(2,26):'author',(2,32):'director',(2,39):'pastor',
             (3,5):'singer',(3,10):'prayer',(3,18):'scripture',(3,29):'sermon',(3,40):'preacher',
             (87,6):'familyTeachers',(88,35):'offering',(91,0):'notes',
             (92,0):'monthLabel',(92,21):'nextMonthLabel',(93,0):'monthPlan',(93,21):'nextPlan'}
    for r in range(8,11):
        for c in [5,8,11,14,19,23,27,30,34,38,41]:dynamic[r,c]=f'count_{r}_{c}'
    for r in range(12,23):
        for c in [3,5,9,12,16,22,32,40]:dynamic[r,c]=f'visitor_{r-12}_{c}'
    for r in range(26,85):
        for c in [4,7,13,17,20,22,25,28,31,33,35,37]:dynamic[r,c]=f'class_{r-26}_{c}'
    for r in [85,86,87]:
        for c in [13,17,20,22,25,28]:dynamic[r,c]=f'count_{r}_{c}'
    for r in [88,89]:
        for c in [22,25,28]:dynamic[r,c]=f'count_{r}_{c}'
    layout=[]
    for ri,row in enumerate(rows):
        for cell in row.findall('hp:tc',NS):
            col=int(cell.find('hp:cellAddr',NS).get('colAddr'))
            sub=cell.find('hp:subList',NS);p=sub.find('hp:p',NS);run=p.find('hp:run',NS)
            # Ignore nested comment/formula text; retain only direct visible text.
            originals=list(sub.findall('hp:p',NS))
            value='\n'.join(''.join(''.join(t.itertext()) for t in paragraph.findall('./hp:run/hp:t',NS)) for paragraph in originals).strip()
            token=dynamic.get((ri,col))
            if token:value='{{'+token+'}}'
            for child in list(sub):sub.remove(child)
            paragraphs=[]
            selected=originals if not token or (ri,col)==(0,0) else originals[:1]
            for pi,original in enumerate(selected):
                para=E.Element('{'+HP+'}p',dict(original.attrib))
                visible=[]
                for original_run in original.findall('hp:run',NS):
                    direct=''.join(''.join(t.itertext()) for t in original_run.findall('hp:t',NS))
                    if direct:visible.append((original_run,direct))
                if not visible:visible=[(original.find('hp:run',NS),'')]
                if token:visible=[(visible[0][0], '{{dateLabel}}' if (ri,col)==(0,0) and pi else value)]
                for original_run,direct in visible:
                    new_run=E.SubElement(para,'{'+HP+'}run',dict(original_run.attrib))
                    E.SubElement(new_run,'{'+HP+'}t').text=direct
                sub.append(para)
                cp0=chars[visible[0][0].get('charPrIDRef')];pp0=paras[original.get('paraPrIDRef')];a0=pp0.find('hh:align',NS)
                paragraphs.append({'text':''.join(v[1] for v in visible),'fontSize':int(cp0.get('height'))/100,
                                   'bold':cp0.find('hh:bold',NS) is not None,
                                   'underline':cp0.find('hh:underline',NS) is not None and cp0.find('hh:underline',NS).get('type')!='NONE',
                                   'align':'left' if a0 is not None and a0.get('horizontal') in ['LEFT','JUSTIFY'] else 'center'})
            span=cell.find('hp:cellSpan',NS);size=cell.find('hp:cellSz',NS)
            cp=chars[run.get('charPrIDRef')];pp=paras[p.get('paraPrIDRef')];align=pp.find('hh:align',NS)
            border=borders.get(cell.get('borderFillIDRef'));fill='#ffffff'
            if border is not None:
                for e in border.iter():
                    if E.QName(e).localname=='winBrush':fill=e.get('faceColor','#ffffff')
            if not fill.startswith('#'):fill='#ffffff'
            edges={}
            for side in ['left','right','top','bottom','diagonal']:
                e=border.find('hh:'+side+('Border' if side!='diagonal' else ''),NS) if border is not None else None
                edges[side]={'type':e.get('type','NONE') if e is not None else 'NONE',
                             'width':float(e.get('width','0 mm').split()[0])*72/25.4 if e is not None else 0}
            edges['backSlash']=border is not None and border.find('hh:backSlash',NS) is not None and border.find('hh:backSlash',NS).get('type')!='NONE'
            edges['slash']=border is not None and border.find('hh:slash',NS) is not None and border.find('hh:slash',NS).get('type')!='NONE'
            layout.append(dict(row=ri,col=col,rowSpan=int(span.get('rowSpan')),colSpan=int(span.get('colSpan')),
                               width=int(size.get('width'))/100,height=int(size.get('height'))/100,
                               text=value,fontSize=int(cp.get('height'))/100,bold=cp.find('hh:bold',NS) is not None,
                               align='left' if align is not None and align.get('horizontal') in ['LEFT','JUSTIFY'] else 'center',fill=fill,borders=edges,paragraphs=paragraphs))
    for t in section.findall('.//hp:t',NS):
        if not any(E.QName(parent).localname=='tc' for parent in t.iterancestors()):t.text=''
    for ctrl in list(section.findall('.//hp:ctrl',NS)):
        if ctrl.find('hp:colPr',NS) is None:ctrl.getparent().remove(ctrl)
    entries['Contents/section0.xml']=E.tostring(section,encoding='utf-8',xml_declaration=True)
    for name in ['Contents/content.hpf','META-INF/container.rdf','settings.xml']:
        doc=E.fromstring(entries[name])
        for e in doc.iter():
            if E.QName(e).localname in ['title','creator','subject','description','lastsaveby']:e.text=''
        entries[name]=E.tostring(doc,encoding='utf-8',xml_declaration=True)
    entries['Preview/PrvText.txt']='청소년부 주간보고서 빈 양식'.encode('utf-8')
    for name in entries:
        if name.startswith('Scripts/'):entries[name]=b'\n'
    with ZipFile(output/'church-250622-v1.hwpx','w') as target:
        target.writestr('mimetype',entries.pop('mimetype'),compress_type=ZIP_STORED)
        for name,value in entries.items():target.writestr(name,value,compress_type=ZIP_DEFLATED)
    page=section.find('.//hp:pagePr',NS)
    model={'sourceSha256':hashlib.sha256(Path(args.input).read_bytes()).hexdigest(),
           'page':dict(page.attrib),'margins':dict(page.find('hp:margin',NS).attrib),
           'tableWidth':int(table.find('hp:sz',NS).get('width'))/100,'cells':layout}
    (output/'church-250622-v1.json').write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Created data-free template: {len(layout)} cells, {len(dynamic)} dynamic cells')

if __name__=='__main__':main()
