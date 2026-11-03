package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_pdfs",uniqueConstraints=@UniqueConstraint(columnNames={"week_id","file_version"}))
public class PraisePdf {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="week_id") private PraiseWeek week;
 @Column(nullable=false) private int fileVersion;
 @Column(nullable=false) private int pageCount;
 @Column(nullable=false,columnDefinition="bytea") private byte[] content;
 @ManyToOne @JoinColumn(name="uploaded_by_id") private User uploadedBy;
 @Column(nullable=false) private LocalDateTime uploadedAt;
}
