import {
  VNPay,
  HashAlgorithm,
  IpnSuccess,
  IpnOrderNotFound,
  InpOrderAlreadyConfirmed,
  IpnInvalidAmount,
  IpnFailChecksum,
  IpnUnknownError,
  type ReturnQueryFromVNPay,
  type VerifyReturnUrl,
  type VerifyIpnCall,
  type IpnResponse,
} from "vnpay";

let cachedClient: VNPay | null = null;

export function getVnpayClient(): VNPay {
  if (cachedClient) return cachedClient;

  const tmnCode = process.env.VNPAY_TMN_CODE;
  const secureSecret = process.env.VNPAY_HASH_SECRET;
  const vnpayHost = process.env.VNPAY_HOST ?? "https://sandbox.vnpayment.vn";

  if (!tmnCode || !secureSecret) {
    throw new Error(
      "VNPAY not configured: set VNPAY_TMN_CODE and VNPAY_HASH_SECRET"
    );
  }

  cachedClient = new VNPay({
    tmnCode,
    secureSecret,
    vnpayHost,
    testMode: vnpayHost.includes("sandbox"),
    hashAlgorithm: HashAlgorithm.SHA512,
  });

  return cachedClient;
}

export function getVnpayReturnUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const path = process.env.VNPAY_RETURN_PATH ?? "/api/payments/vnpay/return";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function buildVnpayPaymentUrl(args: {
  txnRef: string;
  amount: number;
  ipAddr: string;
  orderInfo: string;
}): string {
  const client = getVnpayClient();
  return client.buildPaymentUrl({
    vnp_Amount: args.amount,
    vnp_IpAddr: args.ipAddr,
    vnp_TxnRef: args.txnRef,
    vnp_OrderInfo: args.orderInfo,
    vnp_ReturnUrl: getVnpayReturnUrl(),
  });
}

export function verifyVnpayReturn(query: ReturnQueryFromVNPay): VerifyReturnUrl {
  return getVnpayClient().verifyReturnUrl(query);
}

export function verifyVnpayIpn(query: ReturnQueryFromVNPay): VerifyIpnCall {
  return getVnpayClient().verifyIpnCall(query);
}

export {
  IpnSuccess,
  IpnOrderNotFound,
  InpOrderAlreadyConfirmed,
  IpnInvalidAmount,
  IpnFailChecksum,
  IpnUnknownError,
};
export type { IpnResponse, ReturnQueryFromVNPay };
