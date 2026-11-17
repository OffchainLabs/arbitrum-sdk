#!/usr/bin/env bash
# Prints the integration test files for shard N (1-4), one per line.
# Shard 1 also takes every tests/integration/*.test.ts file not listed below.
set -euo pipefail

cd "$(dirname "$0")/../tests/integration"

shard2="customerc20.test.ts l1l3Bridger.test.ts"
shard3="transactionTracing.test.ts sendChildmsg.test.ts parentToChildMessageCreator.test.ts childTransactionReceipt.test.ts"
shard4="eth.test.ts weth.test.ts"

listed=" $shard2 $shard3 $shard4 "
for f in $listed; do
  [ -f "$f" ] || { echo "shard file not found: $f" >&2; exit 1; }
done

case "${1:-}" in
  1)
    for f in *.test.ts; do
      [[ "$listed" == *" $f "* ]] || echo "tests/integration/$f"
    done
    ;;
  2) printf 'tests/integration/%s\n' $shard2 ;;
  3) printf 'tests/integration/%s\n' $shard3 ;;
  4) printf 'tests/integration/%s\n' $shard4 ;;
  *) echo "usage: $0 <1-4>" >&2; exit 1 ;;
esac
