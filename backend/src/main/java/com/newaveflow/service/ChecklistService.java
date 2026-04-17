package com.newaveflow.service;

import com.newaveflow.dto.checklist.ChecklistDto.BatchRequest;
import com.newaveflow.dto.checklist.ChecklistDto.ItemResponse;
import com.newaveflow.dto.checklist.ChecklistDto.RecordResponse;
import com.newaveflow.entity.ChecklistItem;
import com.newaveflow.entity.ChecklistRecord;
import com.newaveflow.entity.User;
import com.newaveflow.repository.ChecklistItemRepository;
import com.newaveflow.repository.ChecklistRecordRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChecklistService {

    private final ChecklistItemRepository checklistItemRepository;
    private final ChecklistRecordRepository checklistRecordRepository;
    private final UserRepository userRepository;

    public List<ItemResponse> getAllItems() {
        return checklistItemRepository.findAllByOrderByOrderIndexAsc()
                .stream()
                .map(ItemResponse::from)
                .toList();
    }

    public List<RecordResponse> getRecordsByTeacherAndDate(Long teacherId, LocalDate date) {
        return checklistRecordRepository.findByTeacherIdAndRecordDate(teacherId, date)
                .stream()
                .map(RecordResponse::from)
                .toList();
    }

    @Transactional
    public int saveBatch(BatchRequest request, Long teacherId) {
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<ChecklistRecord> existingRecords = checklistRecordRepository
                .findByTeacherIdAndRecordDate(teacherId, request.date());

        Map<Long, ChecklistRecord> existingMap = existingRecords.stream()
                .collect(Collectors.toMap(r -> r.getChecklistItem().getId(), r -> r));

        for (var input : request.records()) {
            if (existingMap.containsKey(input.checklistItemId())) {
                existingMap.get(input.checklistItemId()).update(input.isChecked(), input.note());
            } else {
                ChecklistItem item = checklistItemRepository.findById(input.checklistItemId())
                        .orElseThrow(() -> new IllegalArgumentException("Item not found"));
                
                ChecklistRecord newRecord = ChecklistRecord.builder()
                        .teacher(teacher)
                        .checklistItem(item)
                        .recordDate(request.date())
                        .isChecked(input.isChecked())
                        .note(input.note())
                        .build();
                checklistRecordRepository.save(newRecord);
            }
        }
        return request.records().size();
    }
}
