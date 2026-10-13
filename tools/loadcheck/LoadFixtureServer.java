package loadcheck;

import com.newaveflow.NewaveFlowApplication;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.EventRosterService;
import com.newaveflow.service.TtsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.springframework.boot.SpringApplication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Standalone synthetic harness; not in the application source set or release JAR. */
public final class LoadFixtureServer {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Expected local result directory");
        Path out = Path.of(args[0]).toAbsolutePath();
        String password = Objects.requireNonNull(System.getenv("LOADCHECK_PASSWORD"));
        String jwt = Objects.requireNonNull(System.getenv("LOADCHECK_JWT"));
        // Fixed loopback address and dedicated database: no configurable production target.
        var app = new SpringApplication(NewaveFlowApplication.class);
        var ctx = app.run("--spring.profiles.active=test", "--server.address=127.0.0.1", "--server.port=18083",
            "--spring.datasource.url=jdbc:postgresql://127.0.0.1:55443/newave_loadcheck",
            "--spring.datasource.username=newaveload", "--spring.datasource.password=",
            "--spring.datasource.driver-class-name=org.postgresql.Driver",
            "--spring.jpa.hibernate.ddl-auto=create", "--spring.jpa.show-sql=false",
            "--spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
            "--spring.h2.console.enabled=false", "--app.seed.enabled=false", "--app.review.mode=false",
            "--kakao.enabled=false", "--jwt.secret=" + jwt, "--logging.level.root=WARN",
            "--spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration",
            "--logging.level.com.newaveflow=INFO", "--spring.datasource.hikari.maximum-pool-size=10");
        var users = ctx.getBean(UserRepository.class);
        var classes = ctx.getBean(ClassGroupRepository.class);
        var students = ctx.getBean(StudentRepository.class);
        var teachers = ctx.getBean(TeacherClassRepository.class);
        var questions = ctx.getBean(TtsQuestionRepository.class);
        var records = ctx.getBean(TtsRecordRepository.class);
        var events = ctx.getBean(EventRepository.class);
        var tx = new TransactionTemplate(ctx.getBean(PlatformTransactionManager.class));
        var mapper = ctx.getBean(ObjectMapper.class);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate sunday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        List<Map<String,Object>> accounts = new ArrayList<>();
        List<Long> questionIds = new ArrayList<>();
        String encoded = ctx.getBean(PasswordEncoder.class).encode(password);
        long eventId = tx.execute(status -> {
            if (users.count() != 0) throw new IllegalStateException("Synthetic database must be empty");
            List<TtsQuestion> qs = new ArrayList<>();
            for (int q = 0; q < 7; q++) {
                var question = questions.save(TtsQuestion.builder().title("가상 항목 " + q)
                    .type(q < 2 ? TtsQuestion.TtsQuestionType.DAYS : TtsQuestion.TtsQuestionType.ATTEND)
                    .points(q < 2 ? 5 : 10).linkType(TtsQuestion.TtsLinkType.NONE).displayOrder(q).build());
                qs.add(question); questionIds.add(question.getId());
            }
            for (int c = 0; c < 50; c++) {
                var group = classes.save(ClassGroup.builder().name("가상검수반 " + c).ageGroup("고1").gender("남").build());
                List<Long> ids = new ArrayList<>();
                for (int s = 0; s < 10; s++) ids.add(students.save(Student.builder()
                    .name("가상학생 " + c + "-" + s).grade("고1").classGroup(group).build()).getId());
                for (int t = 0; t < 2; t++) {
                    int index = c * 2 + t;
                    String email = "load" + index + "@synthetic.invalid";
                    var user = users.save(User.builder().email(email).name("가상교사 " + index)
                        .password(encoded).role(User.Role.TEACHER).isActive(true).build());
                    teachers.save(TeacherClass.builder().teacher(user).classGroup(group).isPrimary(t == 0).build());
                    accounts.add(Map.of("index",index,"email",email,"userId",user.getId(),"classId",group.getId(),"studentIds",ids));
                    for (int w = 1; w <= 13; w++) {
                        LocalDate past = sunday.minusWeeks(w);
                        var record = TtsRecord.builder().teacher(user).infoYear(TtsService.weekYear(past)).weekNum(TtsService.weekNum(past)).build();
                        for (var q : qs) record.addAnswer(TtsAnswer.builder().question(q)
                            .answerData(q.getType() == TtsQuestion.TtsQuestionType.DAYS ? "{\"월\":true,\"화\":true}" : "true").build());
                        records.save(record);
                    }
                }
            }
            var event = events.save(Event.builder().title("가상 동시접속 검수 행사").eventType(Event.EventType.SPECIAL)
                .eventDate(today.plusDays(2)).endDate(today.plusDays(3)).attendanceRequired(true)
                .attendanceTarget(Event.AttendanceTarget.BOTH).attendanceStartDate(today.minusDays(1))
                .attendanceDeadline(today.plusDays(7)).build());
            ctx.getBean(EventRosterService.class).capture(event);
            return event.getId();
        });
        mapper.writeValue(out.resolve("fixture.json").toFile(), Map.of("accounts",accounts,"questionIds",questionIds,
            "eventId",eventId,"today",today.toString(),"sunday",sunday.toString(),"year",TtsService.weekYear(sunday),
            "week",TtsService.weekNum(sunday),"fixtureType","synthetic-only"));
        Files.writeString(out.resolve("ready"), "ready");
        var pool = ctx.getBean(javax.sql.DataSource.class).unwrap(com.zaxxer.hikari.HikariDataSource.class);
        Thread metrics = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    var memory = java.lang.management.ManagementFactory.getMemoryMXBean();
                    var mx = pool.getHikariPoolMXBean();
                    String line = mapper.writeValueAsString(Map.of("at",Instant.now().toString(),
                        "heapUsed",memory.getHeapMemoryUsage().getUsed(),"heapMax",memory.getHeapMemoryUsage().getMax(),
                        "threads",java.lang.management.ManagementFactory.getThreadMXBean().getThreadCount(),
                        "poolActive",mx.getActiveConnections(),"poolWaiting",mx.getThreadsAwaitingConnection()));
                    Files.writeString(out.resolve("metrics.jsonl"),line + "\n",StandardOpenOption.CREATE,StandardOpenOption.APPEND);
                    Thread.sleep(500);
                } catch (Exception e) { return; }
            }
        }, "synthetic-load-metrics");
        metrics.setDaemon(true); metrics.start();
        System.out.println("SYNTHETIC_LOADCHECK_READY");
    }
}
