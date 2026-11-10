package com.newaveflow.controller;
import com.newaveflow.entity.User;
import com.newaveflow.service.WidgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/widgets") @RequiredArgsConstructor
public class WidgetController {
    private final WidgetService widgets;
    private <T> ResponseEntity<T> response(T data) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(data); }
    @PostMapping("/session") public ResponseEntity<WidgetService.Session> connect(@AuthenticationPrincipal User user) { return response(widgets.connect(user)); }
    @GetMapping("/preview") public ResponseEntity<WidgetService.Snapshot> preview(@AuthenticationPrincipal User user) { return response(widgets.preview(user)); }
    @GetMapping("/snapshot") public ResponseEntity<WidgetService.Snapshot> read(@RequestHeader(value="X-Newave-Widget", required=false) String token) { return response(widgets.read(token)); }
    @PutMapping("/check") public ResponseEntity<WidgetService.Snapshot> check(@RequestHeader(value="X-Newave-Widget", required=false) String token,
            @RequestBody WidgetService.CheckInput input) { return response(widgets.check(token, input)); }
}
