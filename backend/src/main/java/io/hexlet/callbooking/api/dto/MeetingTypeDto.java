package io.hexlet.callbooking.api.dto;

/** Тип встречи в каталоге владельца. */
public record MeetingTypeDto(String id, String name, String description, int durationMinutes) {}
