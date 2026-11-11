package com.newaveflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.exception.AppException;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.awt.Color;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.function.Predicate;
import java.util.regex.*;
import java.util.zip.*;

/** One template and one layout drive the screen and PDF; HWPX retains the original XML styles. */
@Service
public class WeeklyReportDocumentService {
    private static final String HP="http://www.hancom.co.kr/hwpml/2011/paragraph";
    private static final Pattern TOKEN=Pattern.compile("\\{\\{([^}]+)}}");
    private static final String[] GRADES={"중1","중2","중3","고1","고2","고3"};
    private static final int[] START={26,34,44,55,65,74},CAPACITY={8,10,11,10,9,11};
    private final JsonNode template;
    private final byte[] hwpxTemplate,fontBytes;
    public WeeklyReportDocumentService(ObjectMapper json) throws IOException {
        template=json.readTree(new ClassPathResource("report-templates/church-250622-v1.json").getInputStream());
        hwpxTemplate=new ClassPathResource("report-templates/church-250622-v1.hwpx").getContentAsByteArray();
        fontBytes=new ClassPathResource("report-fonts/NanumGothic-Regular.ttf").getContentAsByteArray();
    }
    public static String grade(String input) {
        String s=Objects.toString(input,"").replaceAll("\\s|학년","").replace("중등","중").replace("고등","고");
        for(String g:GRADES)if(s.startsWith(g))return g;
        return s;
    }
    public void validateCapacity(Report report) {
        if(report.classes().size()>300||all(report).size()>10000)throw AppException.badRequest("보고서가 출력 가능한 최대 크기를 넘었습니다.");
        for(var c:report.classes())if(!Arrays.asList(GRADES).contains(grade(c.grade())))
            throw AppException.badRequest(c.className()+"의 학년을 중1~고3으로 지정해주세요.");
    }
    private List<StudentRow> all(Report r) {return r.classes().stream().filter(ClassSource::submitted).flatMap(c->c.students().stream()).filter(s->!WeeklyReportSourceService.awaitsNewFamilyTeam(s)).toList();}
    private boolean present(StudentRow s,Report r) {return s.status().equals("PRESENT")||(s.status().equals("LATE")&&!r.fields().getOrDefault("includeLate","true").equals("false"));}
    private List<StudentRow> filter(List<StudentRow> rows,Predicate<StudentRow> f){return rows.stream().filter(f).toList();}
    private long n(List<StudentRow> rows,String gender){return rows.stream().filter(s->gender.isEmpty()||s.gender().equals(gender)).count();}
    private List<ClassSource> gradeClasses(Report r,int i){return r.classes().stream().filter(c->c.classId()>=0&&grade(c.grade()).equals(GRADES[i])).sorted(Comparator.comparing(ClassSource::className).thenComparing(ClassSource::classId)).toList();}
    private Map<String,String> values(Report r) {
        Map<String,String> v=new HashMap<>(r.fields());
        v.put("title",r.fields().getOrDefault("department","청소년부")+" 주간 보고서");
        v.put("dateLabel",r.date().format(DateTimeFormatter.ofPattern("yyyy년 M월 d일"))+" ("+r.date().get(WeekFields.ISO.weekOfWeekBasedYear())+"주차)");
        v.put("monthLabel",r.date().format(DateTimeFormatter.ofPattern("yyyy.MM")));v.put("nextMonthLabel",r.date().plusMonths(1).format(DateTimeFormatter.ofPattern("yyyy.MM")));
        if(v.getOrDefault("offering","").matches("[0-9]{1,12}"))v.put("offering",String.format(Locale.US,"%,d",Long.parseLong(v.get("offering")))+"원");
        var all=all(r);var regular=filter(all,s->s.category().equals("REGULAR"));
        var family=filter(all,s->s.category().equals("FAMILY"));var first=filter(all,s->s.category().equals("FIRST"));var returns=filter(all,s->s.category().equals("RETURN"));
        var attendees=filter(all,s->present(s,r));
        for(int ri=8;ri<=10;ri++) {
            String sex=ri==8?"남":ri==9?"여":"";
            put(v,ri,5,n(regular,sex));put(v,ri,8,n(filter(regular,s->s.status().equals("ABSENT")||(s.status().equals("LATE")&&!present(s,r))),sex));put(v,ri,11,n(filter(regular,s->present(s,r)),sex));
            put(v,ri,14,n(filter(family,s->present(s,r)),sex));put(v,ri,19,n(filter(first,s->present(s,r)),sex));put(v,ri,23,n(filter(returns,s->present(s,r)),sex));put(v,ri,27,n(attendees,sex));put(v,ri,30,n(filter(attendees,StudentRow::graduated),sex));
            var teachers=r.teachers().stream().filter(t->sex.isEmpty()||t.gender().equals(sex)).toList();
            put(v,ri,34,teachers.size());put(v,ri,38,teachers.stream().filter(t->t.status().equals("PRESENT")).count());put(v,ri,41,teachers.stream().filter(t->t.status().equals("ABSENT")).count());
        }
        for(int i=0;i<Math.max(11,first.size());i++) {
            var s=i<first.size()?first.get(i):null;String prefix="visitor_"+i+"_";
            for(int col:new int[]{3,5,9,12,16,22,32,40})v.put(prefix+col,s==null?"":switch(col){case 3->String.valueOf(i+1);case 5->s.name();case 9->s.gender();case 12->s.grade();case 16->s.school();case 22->s.address();case 32->s.phone();default->s.introducer();});
        }
        for(int g=0;g<6;g++) {
            var rows=gradeClasses(r,g);
            for(int i=0;i<Math.max(CAPACITY[g],rows.size());i++) {
                String prefix=i<CAPACITY[g]?"class_"+(START[g]-26+i)+"_":"class_x_"+g+"_"+i+"_";
                ClassSource c=i<rows.size()?rows.get(i):null;
                if(c==null){for(int col:new int[]{4,7,13,17,20,22,25,28,31,33,35,37})v.put(prefix+col,"");continue;}
                v.put(prefix+4,c.className());v.put(prefix+7,c.teacherName());
                var reg=filter(c.students(),s->s.category().equals("REGULAR"));var pr=filter(reg,s->present(s,r));var gr=filter(pr,StudentRow::graduated);
                int[] cols={13,17,20,22,25,28,31,33,35};long[] nums={n(reg,"남"),n(reg,"여"),reg.size(),n(pr,"남"),n(pr,"여"),pr.size(),n(gr,"남"),n(gr,"여"),gr.size()};
                for(int j=0;j<cols.length;j++)v.put(prefix+cols[j],c.submitted()?String.valueOf(nums[j]):"미제출");
                v.put(prefix+37,gr.stream().map(StudentRow::name).collect(java.util.stream.Collectors.joining(", ")));
            }
        }
        for(int ri:new int[]{85,86,87}) {
            var rows=ri==85?regular:ri==86?returns:family;var pr=filter(rows,s->present(s,r));
            int[] cols={13,17,20,22,25,28};long[] nums={n(rows,"남"),n(rows,"여"),rows.size(),n(pr,"남"),n(pr,"여"),pr.size()};
            for(int j=0;j<cols.length;j++)put(v,ri,cols[j],nums[j]);
        }
        for(int ri:new int[]{88,89}){var rows=ri==88?filter(first,s->present(s,r)):attendees;put(v,ri,22,n(rows,"남"));put(v,ri,25,n(rows,"여"));put(v,ri,28,rows.size());}
        v.put("familyTeachers",r.classes().stream().filter(c->c.students().stream().anyMatch(s->s.category().equals("FAMILY"))).map(ClassSource::teacherName).filter(s->!s.isBlank()).distinct().collect(java.util.stream.Collectors.joining(", ")));
        String classNotes=r.classes().stream().filter(ClassSource::submitted).filter(c->!c.notes().isBlank()).map(c->"["+c.className()+"] "+c.notes()).collect(java.util.stream.Collectors.joining("\n"));
        long followup=all.stream().filter(s->s.category().equals("FOLLOWUP")&&present(s,r)).count();
        String followupNote=followup>0?"등록 미정 재방문 "+followup+"명 · 총 출석에 포함 (금주 새 인원·새가족에는 중복 포함하지 않음)":"";
        v.put("notes",java.util.stream.Stream.of(classNotes,followupNote,r.fields().getOrDefault("notes","")).filter(s->!s.isBlank()).collect(java.util.stream.Collectors.joining("\n")));
        return v;
    }
    private void put(Map<String,String> v,int row,int col,long n){v.put("count_"+row+"_"+col,String.valueOf(n));}
    private String fill(String text,Map<String,String> values){Matcher m=TOKEN.matcher(text);StringBuffer b=new StringBuffer();while(m.find())m.appendReplacement(b,Matcher.quoteReplacement(values.getOrDefault(m.group(1),"")));m.appendTail(b);return b.toString();}
    private Map<Integer,Integer> extras(Report r){Map<Integer,Integer> result=new TreeMap<>();int visitors=(int)all(r).stream().filter(s->s.category().equals("FIRST")).count();if(visitors>11)result.put(22,visitors-11);for(int g=0;g<6;g++){int extra=gradeClasses(r,g).size()-CAPACITY[g];if(extra>0)result.put(START[g]+CAPACITY[g]-1,extra);}return result;}
    private int shifted(int row,Map<Integer,Integer> extras){return row+extras.entrySet().stream().filter(e->e.getKey()<row).mapToInt(Map.Entry::getValue).sum();}
    private String extraToken(String token,int row,int index){if(row==22)return token.replace("visitor_10_","visitor_"+(11+index)+"_");for(int g=0;g<6;g++)if(row==START[g]+CAPACITY[g]-1)return token.replace("class_"+(row-26)+"_","class_x_"+g+"_"+(CAPACITY[g]+index)+"_");return token;}

    public byte[] hwpx(Report report) {
        validateCapacity(report);var values=values(report);var extra=extras(report);
        try {
            Map<String,byte[]> entries=new LinkedHashMap<>();try(var zip=new ZipInputStream(new ByteArrayInputStream(hwpxTemplate))){for(ZipEntry e;(e=zip.getNextEntry())!=null;)entries.put(e.getName(),zip.readAllBytes());}
            var factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
            Document doc=factory.newDocumentBuilder().parse(new ByteArrayInputStream(entries.get("Contents/section0.xml")));
            Element table=(Element)doc.getElementsByTagNameNS(HP,"tbl").item(0);List<Element> rows=children(table,"tr");
            for(int row=0;row<rows.size();row++) {
                Element tr=rows.get(row);List<Element> originalCells=children(tr,"tc");
                for(var cell:originalCells){var addr=child(cell,"cellAddr");var span=child(cell,"cellSpan");int count=Integer.parseInt(span.getAttribute("rowSpan"));addr.setAttribute("rowAddr",String.valueOf(shifted(row,extra)));if(count>1){final int start=row,end=row+count;int add=extra.entrySet().stream().filter(e->e.getKey()>=start&&e.getKey()<end).mapToInt(Map.Entry::getValue).sum();span.setAttribute("rowSpan",String.valueOf(count+add));}}
                Node before=tr.getNextSibling();
                for(int i=0;i<extra.getOrDefault(row,0);i++) {
                    Element clone=(Element)tr.cloneNode(true);
                    for(var cell:new ArrayList<>(children(clone,"tc"))){int col=Integer.parseInt(child(cell,"cellAddr").getAttribute("colAddr"));if(row!=22&&col<4){clone.removeChild(cell);continue;}child(cell,"cellAddr").setAttribute("rowAddr",String.valueOf(shifted(row,extra)+i+1));for(var t:descendants(cell,"t"))t.setTextContent(extraToken(t.getTextContent(),row,i));}
                    table.insertBefore(clone,before);
                }
            }
            table.setAttribute("rowCnt",String.valueOf(94+extra.values().stream().mapToInt(i->i).sum()));
            // Extend cached dimensions for merged grade labels when overflow rows are inserted.
            for(var cell:descendants(table,"tc")) {
                var addr=child(cell,"cellAddr");int start=Integer.parseInt(addr.getAttribute("rowAddr"));
                int span=Integer.parseInt(child(cell,"cellSpan").getAttribute("rowSpan"));
                if(span<=1)continue;
                int added=0;for(var e:extra.entrySet())if(shifted(e.getKey(),extra)>=start&&shifted(e.getKey(),extra)<start+span)
                    added+=e.getValue()*Integer.parseInt(child(children(rows.get(e.getKey()),"tc").get(0),"cellSz").getAttribute("height"));
                var size=child(cell,"cellSz");size.setAttribute("height",String.valueOf(Integer.parseInt(size.getAttribute("height"))+added));
            }
            int addedHeight=0;for(var e:extra.entrySet())addedHeight+=e.getValue()*Integer.parseInt(child(children(rows.get(e.getKey()),"tc").get(0),"cellSz").getAttribute("height"));
            var tableSize=child(table,"sz");tableSize.setAttribute("height",String.valueOf(Integer.parseInt(tableSize.getAttribute("height"))+addedHeight));
            for(var p:new ArrayList<>(descendants(table,"p"))) {
                var texts=descendants(p,"t");if(texts.isEmpty())continue;
                String original=texts.get(0).getTextContent();
                if(TOKEN.matcher(original).matches()) {
                    String content=fill(original,values);String[] lines=content.split("\\R",-1);
                    for(String line:lines){var clone=(Element)p.cloneNode(true);descendants(clone,"t").get(0).setTextContent(line);p.getParentNode().insertBefore(clone,p);}
                    p.getParentNode().removeChild(p);
                }
            }
            int id=1;for(var p:descendants(doc.getDocumentElement(),"p"))p.setAttribute("id",String.valueOf(id++));
            var tf=TransformerFactory.newInstance();tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET,"");var transformer=tf.newTransformer();transformer.setOutputProperty(OutputKeys.ENCODING,"UTF-8");
            var xml=new ByteArrayOutputStream();transformer.transform(new DOMSource(doc),new StreamResult(xml));entries.put("Contents/section0.xml",xml.toByteArray());
            entries.put("Preview/PrvText.txt",(values.get("title")+"\n"+values.get("dateLabel")+"\n"+String.join("\n",values.values())).getBytes(StandardCharsets.UTF_8));
            var out=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(out)){for(var entry:entries.entrySet()){var e=new ZipEntry(entry.getKey());if(entry.getKey().equals("mimetype")){var crc=new CRC32();crc.update(entry.getValue());e.setMethod(ZipEntry.STORED);e.setSize(entry.getValue().length);e.setCrc(crc.getValue());}zip.putNextEntry(e);zip.write(entry.getValue());zip.closeEntry();}}return out.toByteArray();
        }catch(Exception e){if(e instanceof AppException a)throw a;throw new IllegalStateException("HWPX generation failed",e);}
    }
    private List<Element> children(Element e,String tag){List<Element> result=new ArrayList<>();for(Node n=e.getFirstChild();n!=null;n=n.getNextSibling())if(n instanceof Element x&&HP.equals(x.getNamespaceURI())&&tag.equals(x.getLocalName()))result.add(x);return result;}
    private Element child(Element e,String tag){return children(e,tag).get(0);}
    private List<Element> descendants(Element e,String tag){List<Element> result=new ArrayList<>();var nodes=e.getElementsByTagNameNS(HP,tag);for(int i=0;i<nodes.getLength();i++)result.add((Element)nodes.item(i));return result;}

    private record Para(String text,float size,String align,boolean bold,boolean underline){}
    private record Cell(int row,int col,int rowSpan,int colSpan,float width,float height,String fill,List<Para> paras,JsonNode borders){}
    private record TextLine(String text,float x,float y,float size,float width,boolean bold,boolean underline){}
    private record Edge(float x1,float y1,float x2,float y2,float width){}
    private record Box(float x,float y,float width,float height,String fill,List<TextLine> text,JsonNode borders){}
    private record Page(float top,float bottom){}
    private record Layout(List<Box> boxes,List<Page> pages,float width,float height){}
    private List<Cell> cells(Report report) {
        Map<String,String> values=values(report);var extra=extras(report);List<Cell> result=new ArrayList<>();
        for(var c:template.get("cells")) {
            int row=c.get("row").asInt(),span=c.get("rowSpan").asInt();int add=span>1?extra.entrySet().stream().filter(e->e.getKey()>=row&&e.getKey()<row+span).mapToInt(Map.Entry::getValue).sum():0;
            List<Para> paras=new ArrayList<>();for(var p:c.get("paragraphs"))paras.add(new Para(fill(p.get("text").asText(),values),(float)p.get("fontSize").asDouble(),p.get("align").asText(),p.path("bold").asBoolean(),p.path("underline").asBoolean()));
            result.add(new Cell(shifted(row,extra),c.get("col").asInt(),span+add,c.get("colSpan").asInt(),(float)c.get("width").asDouble(),(float)c.get("height").asDouble(),c.get("fill").asText(),paras,c.path("borders")));
            if((row==22||c.get("col").asInt()>=4)&&extra.containsKey(row))for(int i=0;i<extra.get(row);i++){List<Para> ps=new ArrayList<>();for(var p:c.get("paragraphs"))ps.add(new Para(fill(extraToken(p.get("text").asText(),row,i),values),(float)p.get("fontSize").asDouble(),p.get("align").asText(),p.path("bold").asBoolean(),p.path("underline").asBoolean()));result.add(new Cell(shifted(row,extra)+i+1,c.get("col").asInt(),1,c.get("colSpan").asInt(),(float)c.get("width").asDouble(),(float)c.get("height").asDouble(),c.get("fill").asText(),ps,c.path("borders")));}
        }
        return result;
    }
    private List<String> wrap(String text,float width,float size,PDType0Font font)throws IOException {
        List<String> lines=new ArrayList<>();
        for(String paragraph:text.replace("\t"," ").split("\\R",-1)) {
            StringBuilder line=new StringBuilder();
            for(int code:paragraph.codePoints().toArray()) {String ch=new String(Character.toChars(code));try{font.encode(ch);}catch(IllegalArgumentException e){throw AppException.badRequest("PDF에 표시할 수 없는 문자가 있습니다. 이모지·특수문자를 정리해주세요.");}
                if(line.length()>0&&font.getStringWidth(line+ch)*size/1000>width){lines.add(line.toString());line.setLength(0);}line.append(ch);}
            lines.add(line.toString());
        }return lines;
    }
    private Layout layout(Report report,PDType0Font font)throws IOException {
        List<Cell> cells=cells(report);int rows=cells.stream().mapToInt(c->c.row+c.rowSpan).max().orElse(94);
        float[] x=new float[43];Arrays.fill(x,Float.NaN);x[0]=0;x[42]=(float)template.get("tableWidth").asDouble();
        for(int pass=0;pass<44;pass++)for(var c:cells){int end=c.col+c.colSpan;if(!Float.isNaN(x[c.col])&&Float.isNaN(x[end]))x[end]=x[c.col]+c.width;if(!Float.isNaN(x[end])&&Float.isNaN(x[c.col]))x[c.col]=x[end]-c.width;}
        for(int i=1;i<42;i++)if(Float.isNaN(x[i])){int right=i+1;while(Float.isNaN(x[right]))right++;x[i]=x[i-1]+(x[right]-x[i-1])/(right-i+1);}
        float[] heights=new float[rows];Arrays.fill(heights,0);
        for(var c:cells)if(c.rowSpan==1)heights[c.row]=Math.max(heights[c.row],c.height);
        for(int i=0;i<rows;i++)if(heights[i]==0)heights[i]=6;
        for(var c:cells) {
            float required=4;float width=Math.max(4,x[c.col+c.colSpan]-x[c.col]-4);
            for(var p:c.paras)required+=wrap(p.text,width,p.size,font).size()*p.size*1.18f;
            float available=0;for(int j=c.row;j<c.row+c.rowSpan;j++)available+=heights[j];
            if(required>available)heights[c.row+c.rowSpan-1]+=required-available;
        }
        float[] y=new float[rows+1];for(int i=0;i<rows;i++)y[i+1]=y[i]+heights[i];
        float pageWidth=template.path("page").path("width").asInt()/100f,pageHeight=template.path("page").path("height").asInt()/100f;
        float top=template.path("margins").path("top").asInt()/100f,bottom=template.path("margins").path("bottom").asInt()/100f;
        float available=pageHeight-top-bottom;List<Page> pages=new ArrayList<>();
        List<Box> boxes=new ArrayList<>();float left=template.path("margins").path("left").asInt()/100f;
        for(var c:cells) {
            float width=x[c.col+c.colSpan]-x[c.col],height=y[c.row+c.rowSpan]-y[c.row],needed=0;List<List<String>> wrapped=new ArrayList<>();
            for(var p:c.paras){var lines=wrap(p.text,Math.max(4,width-4),p.size,font);wrapped.add(lines);needed+=lines.size()*p.size*1.18f;}
            float cursor=y[c.row]+Math.max(2,(height-needed)/2);List<TextLine> text=new ArrayList<>();
            for(int pi=0;pi<c.paras.size();pi++){var p=c.paras.get(pi);for(String line:wrapped.get(pi)){cursor+=p.size;float tw=font.getStringWidth(line)*p.size/1000f;text.add(new TextLine(line,left+x[c.col]+(p.align.equals("left")?2:Math.max(2,(width-tw)/2)),cursor,p.size,tw,p.bold,p.underline));cursor+=p.size*.18f;}}
            boxes.add(new Box(left+x[c.col],y[c.row],width,height,c.fill,text,c.borders));
        }
        float start=0;
        while(start<y[rows]) {
            float limit=Math.min(y[rows],start+available),cut=limit;
            if(limit<y[rows]) {
                for(int i=rows;i>=1;i--)if(y[i]<=limit&&y[i]>start){cut=y[i];break;}
                // A merged label may cross a row boundary. Keep short blocks together.
                for(int pass=0;pass<20;pass++) {
                    float before=cut;
                    for(var box:boxes)if(!box.text.isEmpty()) {
                        var first=box.text.get(0);var last=box.text.get(box.text.size()-1);
                        float a=first.y-first.size-1,b=last.y+2;
                        if(a>start+2&&a<cut&&b>cut&&b-a<available)cut=Math.min(cut,a-1);
                        else if(b-a>=available)for(var line:box.text)if(line.y-line.size-1<cut&&line.y+2>cut&&line.y-line.size-2>start)cut=Math.min(cut,line.y-line.size-2);
                    }
                    if(cut==before)break;
                }
            }
            if(cut<=start)cut=limit;
            pages.add(new Page(start,cut));start=cut;
        }
        return new Layout(boxes,pages,pageWidth,pageHeight);
    }
    private void edge(List<Edge> edges,JsonNode style,float x1,float y1,float x2,float y2) {
        String type=style.path("type").asText("NONE");if(type.equals("NONE"))return;
        float width=(float)style.path("width").asDouble(.35);
        if(type.equals("DOUBLE_SLIM")) {
            float offset=width/3,dx=y1==y2?0:offset,dy=y1==y2?offset:0;
            edges.add(new Edge(x1-dx,y1-dy,x2-dx,y2-dy,width/3));
            edges.add(new Edge(x1+dx,y1+dy,x2+dx,y2+dy,width/3));
        } else edges.add(new Edge(x1,y1,x2,y2,width));
    }
    private List<Edge> edges(Box box,Page segment) {
        List<Edge> result=new ArrayList<>();float x=box.x,y=box.y,r=x+box.width,b=y+box.height;
        edge(result,box.borders.path("left"),x,y,x,b);edge(result,box.borders.path("right"),r,y,r,b);
        edge(result,box.borders.path("top"),x,y,r,y);edge(result,box.borders.path("bottom"),x,b,r,b);
        if(box.borders.path("backSlash").asBoolean())edge(result,box.borders.path("diagonal"),x,y,r,b);
        if(box.borders.path("slash").asBoolean())edge(result,box.borders.path("diagonal"),x,b,r,y);
        if(y<segment.top)result.add(new Edge(x,segment.top,r,segment.top,.35f));
        if(b>segment.bottom)result.add(new Edge(x,segment.bottom,r,segment.bottom,.35f));
        return result;
    }
    public byte[] pdf(Report report) {
        try(var doc=new PDDocument()) {
            var font=PDType0Font.load(doc,new ByteArrayInputStream(fontBytes));var layout=layout(report,font);float margin=template.path("margins").path("top").asInt()/100f;
            for(var segment:layout.pages){var page=new PDPage(new PDRectangle(layout.width,layout.height));doc.addPage(page);try(var stream=new PDPageContentStream(doc,page)){
                for(var box:layout.boxes){float a=Math.max(box.y,segment.top),b=Math.min(box.y+box.height,segment.bottom);if(b<=a)continue;
                    Color fill;try{fill=Color.decode(box.fill);}catch(Exception e){fill=Color.WHITE;}
                    stream.setNonStrokingColor(fill);stream.addRect(box.x,layout.height-margin-(b-segment.top),box.width,b-a);stream.fill();
                }
                // Paint borders after every fill so adjacent cells cannot erase thick/double lines.
                stream.saveGraphicsState();stream.addRect(0,layout.height-margin-(segment.bottom-segment.top)-2,layout.width,segment.bottom-segment.top+4);stream.clip();
                stream.setStrokingColor(Color.BLACK);
                for(var box:layout.boxes)if(box.y<segment.bottom&&box.y+box.height>segment.top)for(var edge:edges(box,segment)) {
                    stream.setLineWidth(edge.width);stream.moveTo(edge.x1,layout.height-margin-(edge.y1-segment.top));stream.lineTo(edge.x2,layout.height-margin-(edge.y2-segment.top));stream.stroke();
                }
                for(var box:layout.boxes)for(var line:box.text)if(line.y>segment.top&&line.y<=segment.bottom) {
                    stream.beginText();stream.setNonStrokingColor(Color.BLACK);stream.setLineWidth(line.size*.025f);
                    stream.setRenderingMode(line.bold?RenderingMode.FILL_STROKE:RenderingMode.FILL);
                    stream.setFont(font,line.size);stream.newLineAtOffset(line.x,layout.height-margin-(line.y-segment.top));stream.showText(line.text);stream.endText();
                    if(line.underline&&!line.text.isBlank()){float y=layout.height-margin-(line.y-segment.top)-1;stream.setLineWidth(.4f);stream.moveTo(line.x,y);stream.lineTo(line.x+line.width,y);stream.stroke();}
                }
                stream.restoreGraphicsState();
            }}var out=new ByteArrayOutputStream();doc.save(out);return out.toByteArray();
        }catch(IOException e){throw new IllegalStateException("PDF generation failed",e);}
    }
    public String html(Report report) {
        try(var doc=new PDDocument()) {
            var font=PDType0Font.load(doc,new ByteArrayInputStream(fontBytes));var layout=layout(report,font);float margin=template.path("margins").path("top").asInt()/100f;
            StringBuilder html=new StringBuilder("<!doctype html><html lang=\"ko\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>@font-face{font-family:Report;src:url(data:font/ttf;base64,");
            html.append(Base64.getEncoder().encodeToString(fontBytes)).append(")}*{box-sizing:border-box}body{margin:0;background:#e8ebef;font-family:Report,sans-serif}.sheet{background:white;margin:12px auto;max-width:100%;width:").append(layout.width).append("pt;box-shadow:0 1px 5px #b9bec7}svg{display:block;width:100%;height:auto}text{font-family:Report,sans-serif}@media print{body{background:white}.sheet{margin:0;box-shadow:none;page-break-after:always}}</style></head><body>");
            int pageIndex=0;
            for(var segment:layout.pages){html.append("<section class=\"sheet\" aria-label=\"주간 보고서 양식\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ").append(layout.width).append(' ').append(layout.height).append("\" role=\"img\"><title>청소년부 주간보고서</title>");
                for(var box:layout.boxes){float a=Math.max(box.y,segment.top),b=Math.min(box.y+box.height,segment.bottom);if(b<=a)continue;html.append("<rect x=\"").append(box.x).append("\" y=\"").append(margin+a-segment.top).append("\" width=\"").append(box.width).append("\" height=\"").append(b-a).append("\" fill=\"").append(xml(box.fill)).append("\"/>");}
                String clip="page-"+(pageIndex++);html.append("<defs><clipPath id=\"").append(clip).append("\"><rect x=\"0\" y=\"").append(margin-2).append("\" width=\"").append(layout.width).append("\" height=\"").append(segment.bottom-segment.top+4).append("\"/></clipPath></defs><g clip-path=\"url(#").append(clip).append(")\">");
                for(var box:layout.boxes)if(box.y<segment.bottom&&box.y+box.height>segment.top)for(var edge:edges(box,segment))html.append("<line x1=\"").append(edge.x1).append("\" y1=\"").append(margin+edge.y1-segment.top).append("\" x2=\"").append(edge.x2).append("\" y2=\"").append(margin+edge.y2-segment.top).append("\" stroke=\"black\" stroke-width=\"").append(edge.width).append("\"/>");
                for(var box:layout.boxes)for(var line:box.text)if(line.y>segment.top&&line.y<=segment.bottom) {
                    html.append("<text x=\"").append(line.x).append("\" y=\"").append(margin+line.y-segment.top).append("\" font-size=\"").append(line.size).append("\" stroke=\"black\" stroke-width=\"").append(line.bold?line.size*.025f:0).append("\">").append(xml(line.text)).append("</text>");
                    if(line.underline&&!line.text.isBlank())html.append("<line x1=\"").append(line.x).append("\" y1=\"").append(margin+line.y-segment.top+1).append("\" x2=\"").append(line.x+line.width).append("\" y2=\"").append(margin+line.y-segment.top+1).append("\" stroke=\"black\" stroke-width=\".4\"/>");
                }
                html.append("</g>");
                html.append("</svg></section>");
            }return html.append("</body></html>").toString();
        }catch(IOException e){throw new IllegalStateException("Report preview failed",e);}
    }
    private String xml(String text){return text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
}
