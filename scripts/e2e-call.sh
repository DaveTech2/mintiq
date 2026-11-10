#!/usr/bin/env bash
# Usage: e2e-call.sh "<label>" <signer> <method> '<json-args>' <gas Tgas> <deposit NEAR> [expect-fail]
# Sends the same function call + deposit the dashboard's wallet path sends, via near-cli-rs.
set -uo pipefail
export PATH=/workspace/near-cli/near-cli-rs-x86_64-unknown-linux-gnu:$PATH
LABEL=$1 SIGNER=$2 METHOD=$3 ARGS=$4 GAS=$5 DEP=$6 EXPECT=${7:-ok}
OUT=$(near contract call-function as-transaction mintiq7f109e53.testnet "$METHOD" json-args "$ARGS" \
  prepaid-gas "$GAS Tgas" attached-deposit "$DEP NEAR" sign-as "$SIGNER" network-config testnet-fastnear \
  sign-with-legacy-keychain send 2>&1 | sed -E 's/ed25519:[A-Za-z0-9]+/ed25519:[redacted]/g')
HASH=$(echo "$OUT" | grep -oE "Transaction ID: [1-9A-HJ-NP-Za-km-z]{43,44}" | head -1 | awk '{print $3}')
[ -z "$HASH" ] && HASH=$(echo "$OUT" | grep -oE "transactions/[1-9A-HJ-NP-Za-km-z]{43,44}" | head -1 | cut -d/ -f2)
ERR=$(echo "$OUT" | grep -oE "ERR_[A-Z_]+" | head -1)
RET=$(echo "$OUT" | grep -A2 -i "Function execution return value" | tail -1 | tr -d ' "')
if [ -n "$ERR" ] || echo "$OUT" | grep -qi "error"; then STATUS=fail; else STATUS=ok; fi
if [ "$EXPECT" = "expect-fail" ]; then [ "$STATUS" = fail ] && PASS=true || PASS=false; else [ "$STATUS" = ok ] && PASS=true || PASS=false; fi
python3 - "$LABEL" "$HASH" "$PASS" "$ERR" "$SIGNER" "$METHOD" <<'PY'
import json,sys,os,datetime
f="/workspace/mintiq/.mintiq/testnet-v2.json"
l=json.load(open(f)) if os.path.exists(f) else []
label,h,p,err,signer,method=sys.argv[1:]
l.append({"label":label,"hash":h or None,"ok":p=="true","error":err or None,"signer":signer,"method":method,"via":"near-cli-rs (same call + deposit as the wallet path)","at":datetime.datetime.utcnow().isoformat()+"Z"})
json.dump(l,open(f,"w"),indent=2)
PY
echo "$([ $PASS = true ] && echo PASS || echo FAIL) $LABEL ${HASH:+https://testnet.nearblocks.io/txns/$HASH} ${ERR} ${RET:+return=$RET}"
[ "$PASS" = true ] || { echo "$OUT" | tail -15; }
