/**
 * Test tái hiện lỗi: vòng polling trang /thanh-toan/[orderId] bắn request
 * vô hạn vào PostgREST (Supabase NANO) khi khách để tab mở.
 *
 * Chạy: node scripts/test-vietqr-poll.mjs
 */
import assert from "node:assert/strict";
import {
  nextPollDelay,
  POLL_MS,
  MAX_POLL_MS,
} from "../lib/vietqr-poll.ts";

let passed = 0;
let total = 0;
function test(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

const T0 = Date.UTC(2026, 7, 21, 10, 0, 0);
const in10m = new Date(T0 + 10 * 60 * 1000).toISOString();

console.log("\n[1] Quy tắc dừng của nextPollDelay");

test("đơn pending, QR còn hạn -> tiếp tục poll", () => {
  const d = nextPollDelay({
    now: T0,
    startedAt: T0,
    expiresAt: in10m,
    paymentStatus: "pending",
  });
  assert.equal(d, POLL_MS);
});

test("QR hết hạn -> dừng", () => {
  const d = nextPollDelay({
    now: T0 + 10 * 60 * 1000,
    startedAt: T0,
    expiresAt: in10m,
    paymentStatus: "pending",
  });
  assert.equal(d, null);
});

test("đơn đã paid -> dừng", () => {
  const d = nextPollDelay({
    now: T0,
    startedAt: T0,
    expiresAt: in10m,
    paymentStatus: "paid",
  });
  assert.equal(d, null);
});

test("đơn cancelled/failed -> dừng", () => {
  for (const s of ["cancelled", "failed"]) {
    assert.equal(
      nextPollDelay({ now: T0, startedAt: T0, expiresAt: in10m, paymentStatus: s }),
      null,
      `status=${s}`
    );
  }
});

test("API trả 404 -> dừng (không loop trên đơn không tồn tại)", () => {
  const d = nextPollDelay({ now: T0, startedAt: T0, notFound: true });
  assert.equal(d, null);
});

test("không có expiresAt -> vẫn bị chặn bởi giới hạn cứng 15 phút", () => {
  assert.equal(
    nextPollDelay({ now: T0 + MAX_POLL_MS - 1, startedAt: T0, paymentStatus: "pending" }),
    POLL_MS
  );
  assert.equal(
    nextPollDelay({ now: T0 + MAX_POLL_MS, startedAt: T0, paymentStatus: "pending" }),
    null
  );
});

test("lỗi mạng tạm thời (không có status) -> vẫn poll lại, không dừng oan", () => {
  const d = nextPollDelay({ now: T0 + 5000, startedAt: T0, expiresAt: in10m });
  assert.equal(d, POLL_MS);
});

console.log("\n[2] Mô phỏng vòng poll với đồng hồ giả — đếm số request PostgREST");

function simulate({ expiresAt, hours = 12, paymentStatus = "pending", notFound = false }) {
  const startedAt = T0;
  let now = T0;
  let requests = 0;
  const horizon = T0 + hours * 60 * 60 * 1000;

  // Vòng lặp giống hệt tick(): fetch -> tính delay -> chờ -> lặp.
  for (;;) {
    requests += 1; // mỗi tick = 1 request vào /api/.../status -> 1 query PostgREST
    const delay = nextPollDelay({ now, startedAt, expiresAt, paymentStatus, notFound });
    if (delay === null) break;
    now += delay;
    if (now > horizon) {
      throw new Error(
        `vòng poll KHÔNG dừng: đã bắn ${requests} request trong ${hours}h`
      );
    }
  }
  return requests;
}

test("tab mở 12h, QR hạn 10 phút -> poll dừng, tổng request có giới hạn", () => {
  const n = simulate({ expiresAt: in10m });
  const expected = Math.floor((10 * 60 * 1000) / POLL_MS) + 1; // 151
  assert.equal(n, expected);
  assert.ok(n < 200, `số request quá lớn: ${n}`);
  console.log(`        -> ${n} request rồi dừng (trước fix: ~${(12 * 60 * 60 * 1000) / POLL_MS} request/12h)`);
});

test("tab mở 12h, đơn 404 -> chỉ 1 request", () => {
  assert.equal(simulate({ expiresAt: null, notFound: true }), 1);
});

test("tab mở 12h, đơn không có expiresAt -> dừng ở mốc 15 phút", () => {
  const n = simulate({ expiresAt: null });
  assert.equal(n, MAX_POLL_MS / POLL_MS + 1); // 226
  console.log(`        -> ${n} request rồi dừng`);
});

console.log(
  `\n${process.exitCode ? "THẤT BẠI" : "THÀNH CÔNG"}: ${passed}/${total} test pass\n`
);
