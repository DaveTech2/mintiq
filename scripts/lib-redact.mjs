export function redact(value) {
  return String(value ?? "")
    .replace(/ed25519:[A-Za-z0-9]+/g, "ed25519:[redacted]")
    .replace(/private_key"\s*:\s*"[^"]+"/g, 'private_key":"[redacted]"')
    .replace(/secret_key"\s*:\s*"[^"]+"/g, 'secret_key":"[redacted]"')
    .replace(/secretKey"\s*:\s*"[^"]+"/g, 'secretKey":"[redacted]"');
}

export function txHashFrom(resultOrErr) {
  const r = resultOrErr || {};
  return (
    r.transaction?.hash ||
    r.transaction_outcome?.id ||
    r.transactionHash ||
    r.hash ||
    r.context?.transactionHash ||
    r.context?.transaction_hash ||
    (typeof r.message === "string" && (r.message.match(/([A-Za-z0-9]{43,44})/) || [])[1]) ||
    null
  );
}
