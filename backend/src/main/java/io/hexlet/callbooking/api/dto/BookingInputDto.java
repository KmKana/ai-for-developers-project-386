package io.hexlet.callbooking.api.dto;

import java.time.OffsetDateTime;

/** Данные для записи на слот. */
public record BookingInputDto(
    String meetingTypeId, OffsetDateTime start, String guestName, String guestEmail) {}
