package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class TtsQuestionPolicy {
    private final TtsQuestionRepository questions;
    private final TtsQuestionRevisionRepository revisions;

    public record Timeline(List<TtsQuestion> current, List<TtsQuestionRevision> history) {
        public List<TtsQuestion> at(LocalDate day) { return allAt(day).stream().filter(TtsQuestion::isActive).toList(); }
        public List<TtsQuestion> allAt(LocalDate day) {
            var byQuestion = history.stream().collect(Collectors.groupingBy(TtsQuestionRevision::getQuestionId));
            return current.stream().map(q -> {
                var versions = byQuestion.get(q.getId());
                if (versions == null) return q; // Legacy baseline until first configuration change.
                return versions.stream().filter(v -> !v.getEffectiveFrom().isAfter(day))
                        .max(Comparator.comparing(TtsQuestionRevision::getEffectiveFrom)).map(TtsQuestionRevision::asQuestion).orElse(null);
            }).filter(Objects::nonNull)
                    .sorted(Comparator.comparing(q -> q.getDisplayOrder() == null ? 0 : q.getDisplayOrder())).toList();
        }
    }

    @Transactional(readOnly = true)
    public Timeline load() { return new Timeline(questions.findAllByOrderByDisplayOrderAsc(), revisions.findAll()); }

    @Transactional
    public List<TtsQuestion> update(List<TtsQuestion> requested) {
        if (requested == null) throw AppException.badRequest("TTS 항목 목록이 필요합니다.");
        var old = questions.lockAll();
        var history = new ArrayList<>(revisions.findAll());
        Set<Long> knownIds = old.stream().map(TtsQuestion::getId).collect(Collectors.toSet());
        Set<Long> requestedIds = new HashSet<>();
        for (var q : requested) {
            if (q.getTitle() == null || q.getTitle().isBlank() || q.getType() == null || (q.getPoints() != null && (q.getPoints() < 0 || q.getPoints() > 10000))) {
                throw AppException.badRequest("항목 이름·유형과 배점(0~10000)을 확인해주세요.");
            }
            if (q.getId() != null && (!knownIds.contains(q.getId()) || !requestedIds.add(q.getId()))) {
                throw AppException.badRequest("존재하지 않거나 중복된 항목입니다.");
            }
        }
        // Preserve the pre-change rules, including linked activity points.
        for (var q : old) {
            if (history.stream().noneMatch(v -> v.getQuestionId().equals(q.getId()))) {
                var baseline = TtsQuestionRevision.builder().questionId(q.getId()).effectiveFrom(LocalDate.of(1900,1,1)).build();
                baseline.capture(q); history.add(revisions.save(baseline));
            }
        }
        LocalDate effective = TtsService.weekSunday(LocalDate.now()).plusWeeks(1);
        var changes = new ArrayList<>(requested);
        old.stream().filter(q -> !requestedIds.contains(q.getId())).forEach(q -> { q.setActive(false); changes.add(q); });
        for (var q : changes) {
            var saved = questions.save(q);
            var revision = history.stream().filter(v -> v.getQuestionId().equals(saved.getId()) && v.getEffectiveFrom().equals(effective))
                    .findFirst().orElseGet(() -> TtsQuestionRevision.builder().questionId(saved.getId()).effectiveFrom(effective).build());
            revision.capture(saved); revisions.save(revision);
        }
        return questions.findAllByOrderByDisplayOrderAsc();
    }
}
