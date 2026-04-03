export type InvalidSignupCase = {
  id: string;
  email: string;
  password: string;
  confirm: string;
  doubleSubmit: boolean;
};

export const invalidSignupCases: InvalidSignupCase[] = [
  { id: "empty", email: "", password: "", confirm: "", doubleSubmit: false },
  {
    id: "invalid-email",
    email: "broken",
    password: "valid-pass-123",
    confirm: "valid-pass-123",
    doubleSubmit: false
  },
  {
    id: "short-password",
    email: "user@example.test",
    password: "123",
    confirm: "123",
    doubleSubmit: false
  },
  {
    id: "unicode",
    email: " weird@example.test ",
    password: "pa\u200bssword\ud83d\ude80",
    confirm: "pa\u200bssword\ud83d\ude80",
    doubleSubmit: false
  },
  {
    id: "double-submit",
    email: "double@example.test",
    password: "12345678",
    confirm: "12345678",
    doubleSubmit: true
  }
];
