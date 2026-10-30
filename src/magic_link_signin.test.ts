import assert from "node:assert/strict";
import test from "node:test";
import { chooseSignInResult } from "./magic_link_signin.ts";

test("a reset reference and message id become the observable sign-in decision", () => {
  const result = chooseSignInResult(
    { email: "dev@example.com", returnTo: "https://console.example.com" },
    { request_id: "req-42" },
    { message_id: "msg-42" }
  );
  assert.deepEqual(result, {
    email: "dev@example.com",
    returnTo: "https://console.example.com",
    messageId: "msg-42",
    status: "link_sent"
  });
});
