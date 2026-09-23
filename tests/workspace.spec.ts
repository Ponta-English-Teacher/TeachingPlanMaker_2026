import { test, expect } from "@playwright/test";
test("teacher workflow, persistence, student privacy, timing, and print", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Issues in English Education in Japan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open plan →" }).click();
  await expect(page.getByLabel("Class Duration (minutes)")).toHaveValue("100");
  await page.getByRole("button", { name: "02Detailed Plan" }).click();
  await expect(page.locator(".item-card")).toHaveCount(14);
  await expect(page.locator(".timing")).toContainText("100");
  await page.getByRole("button", { name: "← All plans" }).click();
  await page.getByRole("button", { name: "+ New Teaching Plan" }).click();
  await expect(page.getByLabel("Class Duration (minutes)")).toHaveValue("");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser verified lesson");
  await page.getByLabel("Target Students").fill("University students");
  await page.getByLabel("Class Duration (minutes)").fill("37.5");
  await page.getByRole("button", { name: "Create Plan →" }).click();
  await page
    .getByLabel("Objectives", { exact: true })
    .fill("Discuss without revealing categories.");
  await page.getByLabel("Notes", { exact: true }).fill("PRIVATE GENERAL");
  await page.getByLabel("Show to Students", { exact: true }).check();
  await page.reload();
  await page
    .getByRole("article")
    .filter({ hasText: "Browser verified lesson" })
    .getByRole("button", { name: "Open plan →" })
    .click();
  await expect(page.getByLabel("Objectives", { exact: true })).toHaveValue(
    "Discuss without revealing categories.",
  );
  await expect(
    page.getByText("AI is not configured.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "02Detailed Plan" }).click();
  await page.getByRole("button", { name: "+ Add Stage" }).click();
  await page.getByLabel("Minutes", { exact: true }).fill("40");
  await page.getByLabel("Teacher Behaviors").fill("PRIVATE TEACHER");
  await page.getByLabel("Student Behaviors").fill("Discuss freely in pairs.");
  await page.getByLabel("Notes", { exact: true }).fill("PRIVATE TIMELINE");
  await page.getByLabel("Show to Students", { exact: true }).check();
  await expect(page.getByRole("alert")).toContainText("2.5 minutes");
  await page.getByLabel("Minutes", { exact: true }).fill("12.5");
  await expect(page.locator(".timing")).toContainText("25");
  await page.getByRole("button", { name: "+ Add Stage" }).click();
  await page.getByLabel("Student Behaviors").nth(1).fill("Second stage");
  await page
    .getByRole("button", { name: "Move Stage 2 up", exact: true })
    .click();
  await expect(page.getByLabel("Student Behaviors").first()).toHaveValue(
    "Second stage",
  );
  await page.getByRole("button", { name: "03Board / Slide Plan" }).click();
  await page.getByRole("button", { name: "+ Add Slide", exact: true }).click();
  await page.getByLabel("Slide Title").fill("An open question");
  await page.getByLabel("Main Content").fill("What issues have you noticed?");
  await page
    .getByLabel("Teacher Action", { exact: true })
    .fill("PRIVATE SLIDE");
  await page.getByLabel("Show to Students", { exact: true }).first().check();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Move Slide 2 up", exact: true })
    .click();
  await page.getByRole("button", { name: "Board Plan 0", exact: true }).click();
  await page.getByRole("button", { name: "+ Add Board Section" }).click();
  await page.getByLabel("Exact wording").fill("Ideas → questions → responses");
  await page.getByLabel("When to write it").fill("PRIVATE BOARD TIMING");
  await page.getByLabel("Show to Students", { exact: true }).first().check();
  await page
    .getByLabel("Final summary for students")
    .fill("Think before categorizing.");
  await page.getByLabel("Show to Students", { exact: true }).last().check();
  await page.getByRole("button", { name: "05Reflection" }).click();
  await page
    .getByLabel("What worked?", { exact: true })
    .fill("PRIVATE REFLECTION");
  await page.getByRole("button", { name: "04Student View" }).click();
  await expect(page.locator(".student-page")).toContainText(
    "Discuss freely in pairs.",
  );
  await expect(page.locator(".student-page")).toContainText(
    "Ideas → questions → responses",
  );
  await expect(page.locator(".student-page")).toContainText(
    "Think before categorizing.",
  );
  await expect(page.locator(".student-page")).not.toContainText("PRIVATE");
  await page.getByRole("button", { name: "Generate Final Plan" }).click();
  await expect(page.locator(".print-page")).toContainText(
    "POST-LESSON REFLECTION",
  );
  await expect(page.locator(".print-page")).toContainText("PRIVATE REFLECTION");
  await expect(page.locator(".print-page table")).toContainText("12.5 min");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-header")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.reload();
  await expect(
    page.getByRole("article").filter({ hasText: "Browser verified lesson" }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("TeachingPlanMaker_2026:v1")!),
  );
  expect(stored.version).toBe(1);
  expect(stored.plans[1].slides).toHaveLength(2);
  expect(stored.plans[1].boards).toHaveLength(1);
});
test("AI suggestions require explicit insertion and support selected text", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: { configured: true } });
    else await route.fulfill({ json: { text: "A useful suggestion." } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open plan →" }).click();
  const before = await page
    .getByLabel("Objectives", { exact: true })
    .inputValue();
  await page.getByLabel("Discuss your plan").fill("Improve these objectives");
  await page.getByRole("button", { name: "Send to AI ↗" }).click();
  await expect(
    page.getByText("A useful suggestion.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Objectives", { exact: true })).toHaveValue(
    before,
  );
  await page.getByRole("button", { name: "Use this response" }).click();
  await page
    .getByRole("button", { name: "Insert into Objectives", exact: true })
    .click();
  await expect(page.getByLabel("Objectives", { exact: true })).toHaveValue(
    before + "\nA useful suggestion.",
  );
  await page
    .getByLabel("Objectives", { exact: true })
    .evaluate((el: HTMLTextAreaElement) => {
      el.focus();
      el.setSelectionRange(0, 8);
      el.dispatchEvent(new Event("select", { bubbles: true }));
    });
  await page.getByLabel("Selected suggestion · editable").fill("Explore");
  await page
    .getByRole("button", { name: "Replace selected text", exact: true })
    .click();
  await expect(page.getByLabel("Objectives", { exact: true })).toHaveValue(
    "Explore" + before.slice(8) + "\nA useful suggestion.",
  );
});
test("missing API key is handled without calling OpenAI", async ({
  request,
}) => {
  const response = await request.post("/api/chat", { data: {} });
  expect(response.status()).toBe(503);
  expect((await response.json()).error).toContain("AI is not configured");
});
test("invalid local data is preserved", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("TeachingPlanMaker_2026:v1", "unreadable backup"),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "has not been overwritten",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("TeachingPlanMaker_2026:v1"),
    ),
  ).toBe("unreadable backup");
});
