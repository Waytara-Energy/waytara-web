import { describe, expect, it } from "vitest";
import { trackerFor } from "./partner-tracker";

const states = (status: string) => trackerFor(status).steps.map((s) => s.state);

describe("trackerFor", () => {
  it("shows a new application as received, with the review under way", () => {
    for (const status of ["new", "in_review"]) {
      const v = trackerFor(status);
      expect(v.stage).toBe("review");
      expect(states(status)).toEqual(["done", "current", "todo", "todo"]);
      expect(v.position).toBe(2);
      expect(v.headline).toMatch(/reviewing/);
    }
  });

  it("moves to onboarding when shortlisted or onboarding, and to verification after it", () => {
    for (const status of ["shortlisted", "onboarding"]) expect(states(status)).toEqual(["done", "done", "current", "todo"]);
    expect(trackerFor("onboarding").stage).toBe("onboarding");
    expect(states("verification")).toEqual(["done", "done", "done", "current"]);
    expect(trackerFor("verification").position).toBe(4);
  });

  it("ticks everything when approved, and welcomes the partner without promising projects", () => {
    const v = trackerFor("approved");
    expect(states("approved")).toEqual(["done", "done", "done", "done"]);
    expect(v.stage).toBe("approved");
    expect(`${v.headline} ${v.body}`).not.toMatch(/project|income|guarantee/i);
  });

  it("closes gently when not taken forward, with no step current", () => {
    const v = trackerFor("rejected");
    expect(v.stage).toBe("closed");
    expect(v.steps.some((s) => s.state === "current")).toBe(false);
    expect(v.headline).toBe("Your application was not taken forward");
  });

  it("treats a status it does not know as under review", () => {
    expect(trackerFor("something_new").stage).toBe("review");
  });

  it("says the forms are coming while shortlisted, and asks for them once onboarding is open", () => {
    expect(trackerFor("shortlisted").body).toContain("We will e-mail you when that opens");
    expect(trackerFor("onboarding").headline).toBe("Tell us about your business");
    expect(trackerFor("onboarding").body).not.toContain("when that opens");
  });

  it("always has the same four steps, in order", () => {
    expect(trackerFor("new").steps.map((s) => s.id)).toEqual(["received", "review", "onboarding", "verification"]);
  });
});
