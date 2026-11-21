package io.hexlet.callbooking.core;

/** Ошибка запроса: код и HTTP-статус (400 — некорректные данные, 409 — время недоступно). */
public class ApiRequestException extends RuntimeException {

  private final String code;
  private final int status;

  public ApiRequestException(int status, String code, String message) {
    super(message);
    this.code = code;
    this.status = status;
  }

  public String code() {
    return code;
  }

  public int status() {
    return status;
  }
}
