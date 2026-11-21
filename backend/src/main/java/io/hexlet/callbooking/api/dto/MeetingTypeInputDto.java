package io.hexlet.callbooking.api.dto;

/** Данные для создания типа встречи. */
public record MeetingTypeInputDto(String name, String description, Integer durationMinutes) {}
