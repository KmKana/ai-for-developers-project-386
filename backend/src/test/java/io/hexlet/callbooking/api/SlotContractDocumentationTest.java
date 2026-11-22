package io.hexlet.callbooking.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** Контракт должен явно описывать оба кода ошибки 400 для GET /api/slots. */
class SlotContractDocumentationTest {

  @Test
  void slotOperationDocumentsBothBadRequestCodes() throws IOException {
    Path spec = Path.of("..", "api", "openapi", "openapi.yaml");
    if (!Files.exists(spec)) {
      spec = Path.of("api", "openapi", "openapi.yaml");
    }
    String yaml = Files.readString(spec);

    int start = yaml.indexOf("  /api/slots:");
    assertThat(start).isPositive();
    int nextPath = yaml.indexOf("\n  /api/", start + 1);
    int components = yaml.indexOf("\ncomponents:", start + 1);
    int end = nextPath > 0 ? nextPath : components;
    assertThat(end).isPositive();
    String slotOperation = yaml.substring(start, end);

    assertThat(slotOperation).contains("VALIDATION_ERROR");
    assertThat(slotOperation).contains("MEETING_TYPE_NOT_FOUND");
  }
}
