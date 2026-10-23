import { passwordRules } from "../utils/passwordRules";

test("rejects a password with no number ", () => {
  const result = passwordRules.safeParse("abcdefgh");
  expect(result.success).toBe(false);
});

test("reject a password thast short", () => {
  const result = passwordRules.safeParse("abc");
  expect(result.success).toBe(false);
});

test("rejects a password with no letter", () => {
  const res = passwordRules.safeParse("1234556");

  expect(res.success).toBe(false);
});

test("accept a good password", () => {
  const res = passwordRules.safeParse("1234abcd");
  expect(res.success).toBe(true);
});
