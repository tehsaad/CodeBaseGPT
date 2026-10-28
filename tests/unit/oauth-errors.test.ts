import { describe, expect, it } from "vitest";
import { oauthErrorMessage } from "@/components/auth/forms";

describe("OAuth error messages", () => {
  it("explains blocked account linking without revealing more than the provider flow already did", () => {
    expect(oauthErrorMessage(null)).toBeNull();
    expect(oauthErrorMessage("account_not_linked")).toMatch(/Sign in with your password first/);
    expect(oauthErrorMessage("email_not_found")).toMatch(/didn't share an email/);
    expect(oauthErrorMessage("access_denied")).toBe("Sign-in was cancelled.");
    expect(oauthErrorMessage("<script>")).toMatch(/failed/);
  });
});
