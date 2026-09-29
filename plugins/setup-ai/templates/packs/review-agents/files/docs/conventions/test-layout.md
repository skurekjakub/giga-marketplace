# Test layout

> **Adapt me.** Where tests live, so `rubber-duk-tests` puts new files where a
> teammate would look for them. Replace the defaults below with your layout.

- **Unit and integration tests:** `{{UNIT_TEST_GLOB}}`.
- **Placement rule:** a test mirrors the path of the module it covers (for
  `src/billing/invoice.ts`, the test sits at the mirrored path under the test
  root, or next to the module as `invoice.test.ts` — pick one and keep it).
- **Integration tests** (several real modules together, fakes only at the
  process boundary): {{DescribeWhereIntegrationTestsLive}}.
- **Fixtures** live beside the tests that use them, frozen; tests never read
  production data.
- **Run one file:** `{{TEST_CMD}}` with the file path appended.
