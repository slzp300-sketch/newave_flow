package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.newaveflow.dto.tts.TtsImportRequest;
import com.newaveflow.entity.TtsLegacyScore;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class TtsLegacyImportService {
    private final TtsLegacyScoreRepository legacy;
    private final UserRepository users;
    private final TtsService tts;
    private final ObjectMapper json;
    private Clock clock = Clock.system(TtsPeriod.ZONE);
    private static final Pattern WEEK = Pattern.compile("^(\\d+)\\s*주차(?:\\s*\\(.*\\))?$");

    @Transactional(readOnly = true)
    public Map<String,Object> preview(TtsImportRequest request) { return review(request).summary(); }

    @Transactional
    public Map<String,Object> apply(TtsImportRequest request) {
        if (request.previewToken() == null || request.previewToken().isBlank())
            throw AppException.badRequest("미리보기부터 확인해 주세요.");
        // Same lock as answer saving; deterministic order also serializes overlapping imports.
        users.findAll().stream().map(User::getId).sorted().forEach(id -> users.lockById(id).orElseThrow());
        Review review = review(request);
        // The imported totals have no daily detail and retain their confirmed 2026 Q4 attribution.
        // Check after the user locks so a queued import cannot cross midnight with a stale date.
        if (TtsPeriod.closed(LocalDate.of(2026, 12, 31), LocalDate.now(clock.withZone(TtsPeriod.ZONE))))
            throw AppException.forbidden("마감된 분기의 시트 점수는 변경할 수 없습니다.");
        if (!request.previewToken().equals(review.summary().get("previewToken")))
            throw AppException.conflict("미리보기 이후 원본 내용이나 앱 기록이 바뀌었습니다. 다시 미리보기해 주세요.");
        legacy.deleteInRange(request.year(), request.fromWeek(), request.toWeek());
        legacy.flush();
        legacy.saveAll(review.rows().stream().map(r -> TtsLegacyScore.builder().name(r.name())
                .infoYear(request.year()).weekNum(r.week()).score(r.score()).build()).toList());
        legacy.flush();
        var result = new LinkedHashMap<>(review.summary());
        result.remove("previewToken"); result.put("applied", true);
        return result;
    }

    private record Row(String name, int week, int score) {}
    private record Review(List<Row> rows, Map<String,Object> summary) {}

    private Review review(TtsImportRequest request) {
        if (!Objects.equals(request.year(),2026) || request.fromWeek()==null || request.toWeek()==null
                || request.fromWeek()<40 || request.toWeek()>41 || request.fromWeek()>request.toWeek())
            throw AppException.badRequest("현재 시트 이관 범위는 2026년 4분기 40·41주차입니다.");
        if (request.text()==null || request.text().isBlank()) throw AppException.badRequest("붙여넣은 내용이 없습니다.");
        if (request.text().length()>500_000) throw AppException.badRequest("가져오기 표가 너무 큽니다.");
        var lines=request.text().strip().lines().filter(s -> !s.isBlank()).toList();
        char delimiter=lines.get(0).contains("\t")?'\t':',';
        var header=split(lines.get(0),delimiter);
        int nameColumn=-1, excludedColumns=0;
        Map<Integer,Integer> columns=new LinkedHashMap<>();
        Set<Integer> seenWeeks=new HashSet<>();
        for(int i=0;i<header.size();i++) {
            String cell=header.get(i).strip().replace("\uFEFF","");
            if(cell.equals("이름")) { if(nameColumn!=-1)throw AppException.badRequest("이름 열이 중복됐습니다."); nameColumn=i; }
            var matcher=WEEK.matcher(cell);
            if(matcher.matches()) {
                int week;
                try{week=Integer.parseInt(matcher.group(1));}catch(NumberFormatException e){throw AppException.badRequest("주차 제목이 올바르지 않습니다.");}
                TtsPeriod.sunday(request.year(),week);
                if(!seenWeeks.add(week))throw AppException.badRequest("같은 주차 열이 두 번 있습니다.");
                if(week>=request.fromWeek()&&week<=request.toWeek())columns.put(i,week);else excludedColumns++;
            }
        }
        if(nameColumn<0 || columns.size()!=request.toWeek()-request.fromWeek()+1)
            throw AppException.badRequest("이름과 선택한 모든 주차의 제목 열이 필요합니다.");
        List<Row> rows=new ArrayList<>();Set<String> sourceNames=new HashSet<>();int blankCells=0;
        for(int i=1;i<lines.size();i++) {
            var cells=split(lines.get(i),delimiter);
            if(nameColumn>=cells.size())throw AppException.badRequest((i+1)+"행에 이름이 없습니다.");
            String name=cells.get(nameColumn).strip();
            if(name.equals("합계")||name.equals("평균"))continue;
            if(name.isEmpty()||name.length()>50)throw AppException.badRequest((i+1)+"행의 이름을 확인해 주세요.");
            if(!sourceNames.add(name))throw AppException.badRequest("같은 이름의 행이 중복됐습니다. 원본을 확인해 주세요.");
            for(var col:columns.entrySet()) {
                String raw=col.getKey()<cells.size()?cells.get(col.getKey()).strip():"";
                if(raw.isEmpty()){blankCells++;continue;}
                int score;
                try { score=new BigDecimal(raw.replace(",","")).intValueExact(); }
                catch(ArithmeticException|NumberFormatException e){throw AppException.badRequest((i+1)+"행 "+col.getValue()+"주차 점수는 0 이상의 정수여야 합니다.");}
                if(score<0||score>100_000)throw AppException.badRequest((i+1)+"행의 점수가 허용 범위(0~100,000점)를 벗어났습니다.");
                rows.add(new Row(name,col.getValue(),score));
            }
        }
        // A saved row marks the entire selected week as the confirmed sheet period.
        for(int week=request.fromWeek();week<=request.toWeek();week++) {
            int target=week;
            if(rows.stream().noneMatch(r -> r.week()==target))throw AppException.badRequest(week+"주차가 모두 비어 있습니다. 빈 표로 기존 기록을 대체할 수 없습니다.");
        }
        rows.sort(Comparator.comparing(Row::name).thenComparingInt(Row::week));
        var accounts=users.findAll();
        var byName=accounts.stream().collect(Collectors.groupingBy(u -> u.getName().trim()));
        var names=rows.stream().map(Row::name).distinct().sorted().toList();
        var unmatched=names.stream().filter(n -> !byName.containsKey(n)).toList();
        var ambiguous=names.stream().filter(n -> byName.getOrDefault(n,List.of()).size()>1).toList();
        var app=tts.computeAppScores(request.year(),new HashMap<>());
        List<Map<String,Object>> conflicts=new ArrayList<>(),appOnly=new ArrayList<>(),appState=new ArrayList<>();
        for(var user:accounts.stream().sorted(Comparator.comparing(User::getId)).toList()) {
            for(int week=request.fromWeek();week<=request.toWeek();week++) {
                int target=week, score=app.getOrDefault(user.getId(),Map.of()).getOrDefault(week,0);
                appState.add(Map.of("id",user.getId(),"name",user.getName(),"active",user.isActive(),"week",week,"score",score));
                if(score<=0)continue;
                var row=rows.stream().filter(r -> r.week()==target&&r.name().equals(user.getName().trim())).findFirst();
                var item=new TreeMap<String,Object>();item.put("name",user.getName());item.put("weekNum",week);item.put("appScore",score);
                if(row.isEmpty())appOnly.add(item);
                else if(row.get().score()!=score){item.put("sheetScore",row.get().score());conflicts.add(item);}
            }
        }
        var existing=legacy.findAllByInfoYear(request.year()).stream()
                .filter(s -> s.getWeekNum()>=request.fromWeek()&&s.getWeekNum()<=request.toWeek())
                .sorted(Comparator.comparing(TtsLegacyScore::getName).thenComparingInt(TtsLegacyScore::getWeekNum))
                .map(s -> new Row(s.getName(),s.getWeekNum(),s.getScore())).toList();
        var summary=new LinkedHashMap<String,Object>();
        summary.put("year",request.year());summary.put("fromWeek",request.fromWeek());summary.put("toWeek",request.toWeek());
        summary.put("rows",rows.size());summary.put("names",names.size());summary.put("total",rows.stream().mapToLong(Row::score).sum());
        summary.put("zeroRows",rows.stream().filter(r -> r.score()==0).count());summary.put("blankCells",blankCells);
        summary.put("weeks",new TreeSet<>(columns.values()));summary.put("excludedColumns",excludedColumns);
        summary.put("unmatchedNames",unmatched);summary.put("ambiguousNames",ambiguous);
        summary.put("conflicts",conflicts);summary.put("appOnly",appOnly);summary.put("replacedRows",existing.size());
        try {
            var tokenData=Map.of("year",request.year(),"from",request.fromWeek(),"to",request.toWeek(),"rows",rows,"existing",existing,"app",appState);
            byte[] bytes=json.writer().with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsString(tokenData).getBytes(StandardCharsets.UTF_8);
            summary.put("previewToken",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        }catch(Exception e){throw new IllegalStateException("가져오기 미리보기를 계산하지 못했습니다.",e);}
        return new Review(rows,summary);
    }

    private List<String> split(String line,char delimiter) {
        List<String> cells=new ArrayList<>();StringBuilder value=new StringBuilder();boolean quoted=false;
        for(int i=0;i<line.length();i++) {
            char c=line.charAt(i);
            if(c=='"') { if(quoted&&i+1<line.length()&&line.charAt(i+1)=='"'){value.append(c);i++;}else quoted=!quoted; }
            else if(c==delimiter&&!quoted){cells.add(value.toString());value.setLength(0);}else value.append(c);
        }
        if(quoted)throw AppException.badRequest("닫히지 않은 따옴표가 있습니다.");
        cells.add(value.toString());return cells;
    }
}
