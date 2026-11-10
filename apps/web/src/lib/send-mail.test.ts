import { beforeEach, describe, expect, it, vi } from "vitest";

// The one sender every e-mail of the customer app goes through, with Resend replaced.

const sent: Record<string, unknown>[] = [];
let outcome: "ok" | "error" | "throw" = "ok";

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (args: Record<string, unknown>) => {
        sent.push(args);
        if (outcome === "throw") throw new Error("network down");
        return outcome === "error" ? { error: { message: "domain not verified" } } : { data: { id: "1" }, error: null };
      },
    };
  },
}));

const mail = { subject: "Hello", text: "plain", html: "<p>html</p>" };

beforeEach(() => {
  sent.length = 0;
  outcome = "ok";
  vi.resetModules();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.REPLY_TO_EMAIL;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendMail", () => {
  it("sends nothing, and says so, when e-mail is not set up", async () => {
    const { sendMail } = await import("./send-mail");
    expect(await sendMail("a@example.com", mail)).toBe("suppressed");
    expect(sent).toHaveLength(0);
  });

  it("sends from the configured address and sets Reply-To to the team's mailbox", async () => {
    process.env.RESEND_API_KEY = "k";
    process.env.RESEND_FROM_EMAIL = "WayTara Energy <hello@waytaraenergy.com>";
    const { sendMail } = await import("./send-mail");
    expect(await sendMail("a@example.com", mail)).toBe("sent");
    expect(sent[0]).toMatchObject({ from: "WayTara Energy <hello@waytaraenergy.com>", to: "a@example.com", replyTo: "hello@waytaraenergy.com", subject: "Hello", text: "plain", html: "<p>html</p>" });
  });

  it("lets REPLY_TO_EMAIL override the Reply-To, and takes several recipients", async () => {
    process.env.RESEND_API_KEY = "k";
    process.env.REPLY_TO_EMAIL = "support@waytaraenergy.com";
    const { sendMail } = await import("./send-mail");
    await sendMail(["a@example.com", "b@example.com"], mail);
    expect(sent[0]).toMatchObject({ to: ["a@example.com", "b@example.com"], replyTo: "support@waytaraenergy.com" });
  });

  it("attaches files only when there are some", async () => {
    process.env.RESEND_API_KEY = "k";
    const { sendMail } = await import("./send-mail");
    await sendMail("a@example.com", mail);
    await sendMail("a@example.com", mail, [{ filename: "x.pdf", content: Buffer.from("x") }]);
    expect(sent[0]).not.toHaveProperty("attachments");
    expect(sent[1]).toHaveProperty("attachments");
  });

  it("returns failed, and never throws, when the provider refuses or the network is down", async () => {
    process.env.RESEND_API_KEY = "k";
    const { sendMail } = await import("./send-mail");
    outcome = "error";
    expect(await sendMail("a@example.com", mail)).toBe("failed");
    outcome = "throw";
    expect(await sendMail("a@example.com", mail)).toBe("failed");
  });

  it("warns once, in production, that it is sending from the test address", async () => {
    process.env.RESEND_API_KEY = "k";
    vi.stubEnv("NODE_ENV", "production");
    const { sendMail } = await import("./send-mail");
    await sendMail("a@example.com", mail);
    await sendMail("a@example.com", mail);
    const warnings = vi.mocked(console.error).mock.calls.filter((c) => String(c[0]).includes("RESEND_FROM_EMAIL is not set"));
    expect(warnings).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});
