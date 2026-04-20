package com.newaveflow.service;

import com.newaveflow.dto.classes.DeactivationRequestDto;
import com.newaveflow.entity.DeactivationRequest;
import com.newaveflow.entity.Student;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.DeactivationRequestRepository;
import com.newaveflow.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeactivationRequestService {

    private final DeactivationRequestRepository deactivationRequestRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public DeactivationRequestDto.Response createRequest(Long studentId, String reason, User teacher) {
        if (deactivationRequestRepository.existsByStudentIdAndStatus(studentId, DeactivationRequest.Status.PENDING)) {
            throw AppException.badRequest("이미 승인 대기 중인 제적 신청이 있습니다.");
        }
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));

        DeactivationRequest request = DeactivationRequest.builder()
                .student(student)
                .teacher(teacher)
                .reason(reason)
                .build();

        return DeactivationRequestDto.Response.from(deactivationRequestRepository.save(request));
    }

    public List<DeactivationRequestDto.Response> getPendingRequests() {
        return deactivationRequestRepository
                .findByStatusOrderByRequestedAtDesc(DeactivationRequest.Status.PENDING)
                .stream()
                .map(DeactivationRequestDto.Response::from)
                .toList();
    }

    @Transactional
    public DeactivationRequestDto.Response approve(Long requestId) {
        DeactivationRequest request = deactivationRequestRepository.findById(requestId)
                .orElseThrow(() -> AppException.notFound("제적 신청을 찾을 수 없습니다."));
        request.approve();
        request.getStudent().deactivate();
        studentRepository.save(request.getStudent());
        return DeactivationRequestDto.Response.from(deactivationRequestRepository.save(request));
    }

    @Transactional
    public DeactivationRequestDto.Response reject(Long requestId) {
        DeactivationRequest request = deactivationRequestRepository.findById(requestId)
                .orElseThrow(() -> AppException.notFound("제적 신청을 찾을 수 없습니다."));
        request.reject();
        return DeactivationRequestDto.Response.from(deactivationRequestRepository.save(request));
    }
}
