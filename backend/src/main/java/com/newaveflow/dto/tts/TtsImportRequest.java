package com.newaveflow.dto.tts;

public record TtsImportRequest(Integer year, Integer fromWeek, Integer toWeek, String text, String previewToken) {}
