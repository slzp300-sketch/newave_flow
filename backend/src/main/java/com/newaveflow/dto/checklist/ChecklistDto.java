package com.newaveflow.dto.checklist;

import com.newaveflow.entity.ChecklistItem;
import com.newaveflow.entity.ChecklistRecord;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class ChecklistDto {

    public record ItemResponse(
            Long id,
            String title,
            String description,
            String category,
            boolean isRequired,
            Integer orderIndex
    ) {
        public static ItemResponse from(ChecklistItem item) {
            return new ItemResponse(
                    item.getId(),
                    item.getTitle(),
                    item.getDescription(),
                    item.getCategory(),
                    item.isRequired(),
                    item.getOrderIndex()
            );
        }
    }

    public record RecordResponse(
            Long id,
            Long teacherId,
            Long checklistItemId,
            LocalDate recordDate,
            boolean isChecked,
            String note
    ) {
        public static RecordResponse from(ChecklistRecord record) {
            return new RecordResponse(
                    record.getId(),
                    record.getTeacher().getId(),
                    record.getChecklistItem().getId(),
                    record.getRecordDate(),
                    record.isChecked(),
                    record.getNote()
            );
        }
    }

    public record BatchRequest(
            @NotNull LocalDate date,
            List<RecordInput> records
    ) {}

    public record RecordInput(
            Long checklistItemId,
            boolean isChecked,
            String note
    ) {}
}
