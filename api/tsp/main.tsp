import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";

using Http;
using Rest;
using TypeSpec.OpenAPI;

/**
 * API упрощённого сервиса записи на звонок по мотивам Cal.com.
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
 * - один и тот же Слот нельзя занять дважды, включая частичное
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

/** Свободный Слот, который можно занять. */
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

/** Все коды ошибок API: клиент выбирает сценарий по коду, а текст берёт из message. */
union ApiErrorCode {
  /** Некорректные данные запроса, 400. */
  VALIDATION_ERROR: "VALIDATION_ERROR",

  /** Неизвестный Тип встречи, 400. */
  MEETING_TYPE_NOT_FOUND: "MEETING_TYPE_NOT_FOUND",

  /** Любое пересечение с существующей Записью, 409. */
  SLOT_CONFLICT: "SLOT_CONFLICT",

  /** Старт вне 30-минутной сетки, 409. */
  OFF_GRID: "OFF_GRID",

  /** Встреча выходит за рабочие дни или 09:00–18:00, 409. */
  OUTSIDE_WORKING_HOURS: "OUTSIDE_WORKING_HOURS",

  /** Дата вне окна записи на 14 дней, 409. */
  OUT_OF_WINDOW: "OUT_OF_WINDOW",

  /** Непредвиденная ошибка сервера, 500. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
}

/**
 * Единый формат ошибки API: машинный код и понятное сообщение.
 *
 * `SLOT_CONFLICT` — единственный код для любого пересечения Слотов
 * [start, end), независимо от совпадения старта и от Типа встречи.
 * Сообщения календарных кодов 409 фиксированы:
 * - SLOT_CONFLICT: «Выбранное время уже занято. Выберите другой слот»;
 * - OFF_GRID: «Начало встречи должно быть на 30-минутной сетке. Выберите другое время.»;
 * - OUTSIDE_WORKING_HOURS: «Встреча должна проходить в рабочие дни с 09:00 до 18:00 по времени владельца.»;
 * - OUT_OF_WINDOW: «Запись доступна на ближайшие 14 дней. Выберите другую дату.».
 * Код `INTERNAL_ERROR` сопровождает 500 с сообщением «Внутренняя ошибка сервера».
 */
model ApiError {
  /** Машинный код ошибки из ApiErrorCode. */
  @example("VALIDATION_ERROR")
  code: ApiErrorCode;

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

  /**
   * Свободные слоты выбранного типа встречи в окне завтра + 13 дней по Asia/Almaty.
   *
   * Возможные ошибки 400 с общей моделью ApiError:
   * VALIDATION_ERROR — параметр meetingTypeId не передан или некорректен;
   * MEETING_TYPE_NOT_FOUND — тип встречи с таким идентификатором неизвестен.
   */
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
