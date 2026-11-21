package io.hexlet.callbooking.core;

import io.hexlet.callbooking.api.dto.MeetingTypeDto;
import io.hexlet.callbooking.api.dto.MeetingTypeInputDto;
import io.hexlet.callbooking.store.InMemoryStore;
import io.hexlet.callbooking.store.MeetingType;
import java.util.List;
import org.springframework.stereotype.Service;

/** Каталог типов встреч владельца. */
@Service
public class MeetingTypeService {

  private final InMemoryStore store;

  public MeetingTypeService(InMemoryStore store) {
    this.store = store;
  }

  public MeetingTypeDto create(MeetingTypeInputDto input) {
    String name = input.name() == null ? "" : input.name().trim();
    if (name.isEmpty()) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Название типа встречи обязательно");
    }
    if (name.length() > 100) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Название не длиннее 100 символов");
    }
    if (input.durationMinutes() == null) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Длительность обязательна");
    }
    int duration = input.durationMinutes();
    if (duration < BookingRules.MIN_TYPE_DURATION || duration > BookingRules.MAX_TYPE_DURATION) {
      throw new ApiRequestException(
          400,
          "VALIDATION_ERROR",
          "Длительность должна быть от %d до %d минут"
              .formatted(BookingRules.MIN_TYPE_DURATION, BookingRules.MAX_TYPE_DURATION));
    }
    String description = input.description() == null ? null : input.description().trim();
    if (description != null && description.length() > 500) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Описание не длиннее 500 символов");
    }
    MeetingType created = store.addMeetingType(name, description, duration);
    return toDto(created);
  }

  public List<MeetingTypeDto> list() {
    return store.listMeetingTypes().stream().map(MeetingTypeService::toDto).toList();
  }

  private static MeetingTypeDto toDto(MeetingType type) {
    return new MeetingTypeDto(type.id(), type.name(), type.description(), type.durationMinutes());
  }
}
