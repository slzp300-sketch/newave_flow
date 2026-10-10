package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.CompletedOperation;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.function.Supplier;

/** Result and business changes commit together; the user row serializes simultaneous replays. */
@Service @RequiredArgsConstructor
public class OperationService {
    private final CompletedOperationRepository operations;
    private final UserRepository users;
    private final ObjectMapper mapper;

    @Transactional
    public <T> T execute(Long actorId, String key, String action, Object body, TypeReference<T> type, Supplier<T> work) {
        if (key == null || !key.matches("[A-Za-z0-9-]{16,64}")) throw AppException.badRequest("작업 번호가 필요합니다. 화면을 새로고침해주세요.");
        users.lockById(actorId).orElseThrow(() -> AppException.unauthorized("계정을 찾을 수 없습니다."));
        try {
            String serialized = mapper.writer().with(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsString(body);
            String fingerprint = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((action + ":" + serialized).getBytes(StandardCharsets.UTF_8)));
            var existing = operations.findByActorIdAndOperationKey(actorId, key);
            if (existing.isPresent()) {
                if (!fingerprint.equals(existing.get().getFingerprint())) throw AppException.conflict("이미 다른 내용으로 사용된 작업 번호입니다.");
                return mapper.readValue(existing.get().getResultJson(), type);
            }
            T result = work.get();
            operations.save(CompletedOperation.builder().actorId(actorId).operationKey(key).fingerprint(fingerprint)
                    .resultJson(mapper.writeValueAsString(result)).build());
            return result;
        } catch (AppException e) { throw e; }
        catch (com.fasterxml.jackson.core.JsonProcessingException | java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("Operation result serialization failed", e);
        }
    }
}
