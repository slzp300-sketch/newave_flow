package com.newaveflow.controller;

import com.newaveflow.entity.Tag;
import com.newaveflow.entity.User;
import com.newaveflow.entity.UserTag;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.TagRepository;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.repository.UserTagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagRepository tagRepository;
    private final UserTagRepository userTagRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<TagDto>> getAllTags() {
        return ResponseEntity.ok(
            tagRepository.findAllByOrderByNameAsc().stream()
                .map(t -> new TagDto(t.getId(), t.getName(), t.getCategory(), t.getColor()))
                .toList()
        );
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<TagDto> createTag(@RequestBody TagNameRequest req) {
        Tag tag = tagRepository.save(Tag.builder()
            .name(req.name().trim())
            .category(req.category())
            .color(req.color())
            .build());
        return ResponseEntity.ok(new TagDto(tag.getId(), tag.getName(), tag.getCategory(), tag.getColor()));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<Void> updateTag(@PathVariable Long id, @RequestBody TagNameRequest req) {
        Tag tag = tagRepository.findById(id)
            .orElseThrow(() -> AppException.notFound("태그를 찾을 수 없습니다."));
        tag.updateName(req.name().trim());
        if (req.category() != null) {
            tag.updateCategory(req.category());
        }
        if (req.color() != null) {
            tag.updateColor(req.color());
        }
        tagRepository.save(tag);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<Void> deleteTag(@PathVariable Long id) {
        userTagRepository.deleteByTag_Id(id);
        tagRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/all")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<Void> deleteAllTags() {
        userTagRepository.deleteAll();
        tagRepository.deleteAll();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{tagId}/users/{userId}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<Void> assignTag(@PathVariable Long tagId, @PathVariable Long userId) {
        if (!userTagRepository.existsByUser_IdAndTag_Id(userId, tagId)) {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
            Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> AppException.notFound("태그를 찾을 수 없습니다."));
            userTagRepository.save(UserTag.builder().user(user).tag(tag).build());
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{tagId}/users/{userId}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
    public ResponseEntity<Void> removeTag(@PathVariable Long tagId, @PathVariable Long userId) {
        userTagRepository.deleteByUser_IdAndTag_Id(userId, tagId);
        return ResponseEntity.ok().build();
    }

    public record TagDto(Long id, String name, String category, String color) {}
    public record TagNameRequest(String name, String category, String color) {}
}
