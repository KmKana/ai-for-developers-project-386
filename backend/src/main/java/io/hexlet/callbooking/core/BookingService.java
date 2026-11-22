package io.hexlet.callbooking.core;

import io.hexlet.callbooking.api.dto.BookingDto;
import io.hexlet.callbooking.api.dto.BookingInputDto;
import io.hexlet.callbooking.store.Booking;
import io.hexlet.callbooking.store.BookingOverlap;
import io.hexlet.callbooking.store.InMemoryStore;
import io.hexlet.callbooking.store.MeetingType;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Запись гостя на свободный слот. */
@Service
public class BookingService {

  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private static final String SLOT_CONFLICT_CODE = "SLOT_CONFLICT";
  private static final String SLOT_CONFLICT_MESSAGE =
      "Выбранное время уже занято. Выберите другой слот";
  private static final String OFF_GRID_MESSAGE =
      "Начало встречи должно быть на 30-минутной сетке. Выберите другое время.";
  private static final String OUTSIDE_WORKING_HOURS_MESSAGE =
      "Встреча должна проходить в рабочие дни с 09:00 до 18:00 по времени владельца.";
  private static final String OUT_OF_WINDOW_MESSAGE =
      "Запись доступна на ближайшие 14 дней. Выберите другую дату.";

  private final InMemoryStore store;
  private final BookingRules rules;

  public BookingService(InMemoryStore store, BookingRules rules) {
    this.store = store;
    this.rules = rules;
  }

  public BookingDto book(BookingInputDto input) {
    String meetingTypeId = input.meetingTypeId() == null ? "" : input.meetingTypeId().trim();
    if (meetingTypeId.isEmpty()) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "meetingTypeId обязателен");
    }
    MeetingType type = store.findMeetingType(meetingTypeId);
    if (type == null) {
      throw new ApiRequestException(
          400, "MEETING_TYPE_NOT_FOUND", "Тип встречи не найден: " + input.meetingTypeId());
    }
    if (input.start() == null) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Время начала обязательно");
    }
    String guestName = input.guestName() == null ? "" : input.guestName().trim();
    if (guestName.isEmpty()) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Имя гостя обязательно");
    }
    String guestEmail = input.guestEmail() == null ? "" : input.guestEmail().trim();
    if (guestEmail.isEmpty() || !EMAIL.matcher(guestEmail).matches()) {
      throw new ApiRequestException(400, "VALIDATION_ERROR", "Некорректный email гостя");
    }

    Instant startInstant = input.start().toInstant();
    long durationMinutes = type.durationMinutes();
    Instant endInstant = startInstant.plus(Duration.ofMinutes(durationMinutes));

    ZonedDateTime localStart = startInstant.atZone(BookingRules.ZONE);
    LocalDate date = localStart.toLocalDate();
    LocalTime time = localStart.toLocalTime();
    int startMinutes = time.getHour() * 60 + time.getMinute();

    if (date.isBefore(rules.currentWindowStart())
        || date.isAfter(rules.currentWindowEndInclusive())) {
      throw new ApiRequestException(409, "OUT_OF_WINDOW", OUT_OF_WINDOW_MESSAGE);
    }
    if (!BookingRules.WORK_DAYS.contains(date.getDayOfWeek())) {
      throw new ApiRequestException(409, "OUTSIDE_WORKING_HOURS", OUTSIDE_WORKING_HOURS_MESSAGE);
    }
    if (startMinutes < BookingRules.WORK_START_MINUTES
        || startMinutes + durationMinutes > BookingRules.WORK_END_MINUTES) {
      throw new ApiRequestException(409, "OUTSIDE_WORKING_HOURS", OUTSIDE_WORKING_HOURS_MESSAGE);
    }
    boolean onGrid =
        (startMinutes - BookingRules.WORK_START_MINUTES) % BookingRules.STEP_MINUTES == 0
            && time.getSecond() == 0
            && time.getNano() == 0;
    if (!onGrid) {
      throw new ApiRequestException(409, "OFF_GRID", OFF_GRID_MESSAGE);
    }

    // Предварительная проверка тем же правилом [start, end); финальная — под монитором store.
    if (BookingOverlap.conflict(store.upcomingBookings(), startInstant, endInstant).isPresent()) {
      throw slotConflict();
    }

    var result =
        store.tryAddBooking(
            type.id(), type.name(), startInstant, endInstant, guestName, guestEmail);
    if (result.conflict() != null) {
      throw slotConflict();
    }
    return toDto(result.created());
  }

  private static ApiRequestException slotConflict() {
    return new ApiRequestException(409, SLOT_CONFLICT_CODE, SLOT_CONFLICT_MESSAGE);
  }

  public java.util.List<BookingDto> upcoming() {
    return store.upcomingBookings().stream().map(this::toDto).toList();
  }

  private BookingDto toDto(Booking booking) {
    return new BookingDto(
        booking.id(),
        booking.meetingTypeId(),
        booking.meetingTypeName(),
        OffsetDateTime.ofInstant(booking.start(), BookingRules.ZONE),
        OffsetDateTime.ofInstant(booking.end(), BookingRules.ZONE),
        booking.guestName(),
        booking.guestEmail(),
        booking.createdAt());
  }
}
