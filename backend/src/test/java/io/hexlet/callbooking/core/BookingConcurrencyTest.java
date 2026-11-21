package io.hexlet.callbooking.core;

import static org.assertj.core.api.Assertions.assertThat;

import io.hexlet.callbooking.api.dto.MeetingTypeInputDto;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;

/**
 * Правило «одно и то же время нельзя занять дважды, даже двумя одновременными запросами»:
 * выигрывает ровно один запрос.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class BookingConcurrencyTest {

  @Autowired private TestRestTemplate rest;

  @Autowired private MeetingTypeService meetingTypeService;

  @Autowired private BookingService bookingService;

  private String createHalfHourType() {
    return meetingTypeService.create(new MeetingTypeInputDto("Знакомство", "30 минут", 30)).id();
  }

  @Test
  void onlyOneConcurrentHttpRequestWinsTheSlot() throws Exception {
    String typeId = createHalfHourType();
    List<Map<String, Object>> slots =
        rest.exchange(
                "/api/slots?meetingTypeId=" + typeId,
                org.springframework.http.HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {})
            .getBody();
    assertThat(slots).isNotNull().isNotEmpty();
    String start = (String) slots.get(0).get("start");

    ExecutorService pool = Executors.newFixedThreadPool(12);
    var tasks = new java.util.ArrayList<Callable<ResponseEntity<String>>>();
    for (int i = 0; i < 12; i++) {
      int guestNo = i;
      tasks.add(
          () -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            String body =
                """
                        {"meetingTypeId":"%s","start":"%s",
                         "guestName":"Гость %d","guestEmail":"guest%d@example.com"}
                        """
                    .formatted(typeId, start, guestNo, guestNo);
            return rest.postForEntity(
                "/api/bookings", new HttpEntity<>(body, headers), String.class);
          });
    }
    var results = pool.invokeAll(tasks);
    pool.shutdown();
    assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

    long created =
        results.stream()
            .filter(
                f -> {
                  try {
                    return f.get().getStatusCode().value() == 201;
                  } catch (Exception e) {
                    return false;
                  }
                })
            .count();
    long conflicts =
        results.stream()
            .filter(
                f -> {
                  try {
                    return f.get().getStatusCode().value() == 409;
                  } catch (Exception e) {
                    return false;
                  }
                })
            .count();

    assertThat(created).isEqualTo(1);
    assertThat(conflicts).isEqualTo(11);

    List<Map<String, Object>> bookings =
        rest.exchange(
                "/api/bookings",
                org.springframework.http.HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {})
            .getBody();
    assertThat(bookings).hasSize(1);
  }

  @Test
  void serviceLevelBookingIsAtomic() throws Exception {
    String typeId = createHalfHourType();
    // первый рабочий день окна записи, 12:00 по времени владельца
    java.time.LocalDate day = BookingRules.windowStart();
    while (!BookingRules.WORK_DAYS.contains(day.getDayOfWeek())) {
      day = day.plusDays(1);
    }
    OffsetDateTime startAt =
        day.atTime(LocalTime.of(12, 0)).atZone(BookingRules.ZONE).toOffsetDateTime();

    int threads = 32;
    ExecutorService pool = Executors.newFixedThreadPool(threads);
    AtomicInteger successes = new AtomicInteger();
    AtomicInteger conflicts = new AtomicInteger();
    var futures = new java.util.ArrayList<java.util.concurrent.Future<?>>();
    for (int i = 0; i < threads; i++) {
      int guestNo = i;
      futures.add(
          pool.submit(
              () -> {
                try {
                  bookingService.book(
                      new io.hexlet.callbooking.api.dto.BookingInputDto(
                          typeId, startAt, "Гость " + guestNo, "guest" + guestNo + "@example.com"));
                  successes.incrementAndGet();
                } catch (ApiRequestException e) {
                  assertThat(e.status()).isEqualTo(409);
                  conflicts.incrementAndGet();
                }
              }));
    }
    for (var future : futures) {
      future.get(30, TimeUnit.SECONDS);
    }
    pool.shutdown();

    assertThat(successes.get()).isEqualTo(1);
    assertThat(conflicts.get()).isEqualTo(threads - 1);
    assertThat(bookingService.upcoming()).hasSize(1);

    // бронь легла ровно на 12:00 по времени владельца
    assertThat(
            bookingService
                .upcoming()
                .get(0)
                .start()
                .atZoneSameInstant(BookingRules.ZONE)
                .toLocalTime())
        .isEqualTo(LocalTime.of(12, 0));
  }
}
