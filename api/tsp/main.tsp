import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";

using Http;
using Rest;
using TypeSpec.OpenAPI;

/**
 * API упрощённого сервиса бронирования звонков по мотивам Cal.com.
 *
 * Владелец (один, задан заранее) публикует типы встреч; гость выбирает
 * свободный слот и записывается. Авторизация, внешние календари
 * и уведомления не входят в проект.
 *
 * Правила записи:
 * - часовой пояс владельца: Asia/Almaty, рабочие часы: пн–пт 09:00–18:00;
 * - окно записи: 14 календарных дней, начиная с завтрашнего дня;
 * - шаг доступных стартов: 30 минут, длительность слота равна
 *   длительности выбранного типа встречи;
 * - один и тот же интервал нельзя занять дважды, включая частичное
 *   наложение разных типов; следующая встреча может начинаться
 *   в момент окончания предыдущей.
 */
@service(#{ title: "Call Booking API" })
@info(#{ version: "1.0.0" })
@server("http://localhost:8080", "Локальный сервер разработки")
namespace CallBooking;

/** Тип встречи, который владелец публикует в каталоге. */
model MeetingType {
  /** Идентификатор типа встречи. */
  @key id: string;

  /** Название, например «Знакомство». */
  @minLength(1)
  @maxLength(100)
  name: string;

  /** Описание для гостя, например «Короткий созвон о вашем проекте». */
  @maxLength(500)
  description?: string;

  /** Длительность встречи в минутах, от 5 до 480. */
  @minValue(5)
  @maxValue(480)
  durationMinutes: int32;
}

/** Данные для создания типа встречи. */
model MeetingTypeInput {
  /** Название, например «Знакомство». */
  @minLength(1)
  @maxLength(100)
  name: string;

  /** Описание для гостя. */
  @maxLength(500)
  description?: string;

  /** Длительность встречи в минутах, от 5 до 480. */
  @minValue(5)
  @maxValue(480)
  durationMinutes: int32;
}

/** Свободный интервал, который можно занять. */
model Slot {
  /** Начало слота (RFC 3339 с часовым поясом Asia/Almaty). */
  start: offsetDateTime;

  /** Конец слота: начало плюс длительность типа встречи. */
  end: offsetDateTime;
}

/** Запись гостя на встречу. */
model Booking {
  /** Идентификатор записи. */
  @key id: string;

  /** Идентификатор типа встречи. */
  meetingTypeId: string;

  /** Название типа встречи на момент записи. */
  meetingTypeName: string;

  /** Начало встречи (RFC 3339 с часовым поясом Asia/Almaty). */
  start: offsetDateTime;

  /** Конец встречи: начало плюс длительность типа встречи. */
  end: offsetDateTime;

  /** Имя гостя. */
  @minLength(1)
  guestName: string;

  /** Email гостя. */
  @pattern("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
  guestEmail: string;

  /** Момент создания записи. */
  createdAt: offsetDateTime;
}

/** Данные для записи на слот. */
model BookingInput {
  /** Идентификатор типа встречи из каталога. */
  meetingTypeId: string;

  /** Начало встречи: свободный старт из списка слотов (RFC 3339). */
  start: offsetDateTime;

  /** Имя гостя. */
  @minLength(1)
  guestName: string;

  /** Email гостя. */
  @pattern("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
  guestEmail: string;
}

/**
 * Единый формат ошибки API: машинный код и понятное сообщение.
 *
 * Код — строка, чтобы контракт можно было расширять новыми ошибками,
 * не меняя форму ответа. Для некорректных данных используется VALIDATION_ERROR
 * со статусом 400; остальные коды документируются в следующих операциях.
 */
model ApiError {
  /** Машинный код ошибки: VALIDATION_ERROR (400) и другие коды операций. */
  @example("VALIDATION_ERROR")
  code: string;

  /** Понятное описание ошибки, которое показывает интерфейс. */
  message: string;
}

/** Ответ об ошибке 400 VALIDATION_ERROR: данные запроса не прошли проверку. */
@error
model ValidationError {
  /** Всегда 400. */
  @statusCode
  statusCode: 400;

  ...ApiError;
}

/** Ответ при конфликте: время недоступно или уже занято. */
@error
model ConflictError {
  /** Всегда 409. */
  @statusCode
  statusCode: 409;

  ...ApiError;
}

/** Успешный ответ создания типа встречи (201). */
model CreatedMeetingType {
  @statusCode
  statusCode: 201;

  ...MeetingType;
}

/** Успешный ответ записи на слот (201). */
model CreatedBooking {
  @statusCode
  statusCode: 201;

  ...Booking;
}

@route("/api")
interface Api {
  /** Каталог типов встреч владельца. */
  @get
  @route("/meeting-types")
  listMeetingTypes(): MeetingType[];

  /** Создать тип встречи. */
  @post
  @route("/meeting-types")
  createMeetingType(@body input: MeetingTypeInput): CreatedMeetingType | ValidationError;

  /** Свободные слоты выбранного типа встречи на ближайшие 14 дней. */
  @get
  @route("/slots")
  listAvailableSlots(@query meetingTypeId: string): Slot[] | ValidationError;

  /** Записаться на свободный слот. */
  @post
  @route("/bookings")
  createBooking(@body input: BookingInput): CreatedBooking | ValidationError | ConflictError;

  /** Предстоящие встречи владельца по всем типам, отсортированные по времени. */
  @get
  @route("/bookings")
  listBookings(): Booking[];
}
