/** Turn contract panics and wallet errors into plain-language messages. */
const CONTRACT = {
  ERR_OVERSPEND: "That budget is above this NFT's max spend per task, so the contract rejected it.",
  ERR_RESERVE: "That would take the treasury below its reserve floor, so the contract rejected it.",
  ERR_NOT_OWNER: "Only this NFT's owner can do that.",
  ERR_NOT_AGENT_OR_OWNER: "Only this NFT's owner or its agent can do that.",
  ERR_NOT_AGENT: "Only the NFT's agent can score work.",
  ERR_UNAPPROVED_DESTINATION: "That destination is not on this NFT's approved investment list.",
  ERR_NOT_EVALUATED: "The agent has to score this submission before it can be paid.",
  ERR_ALREADY_PAID: "This submission was already paid.",
  ERR_JOB_CLOSED: "This job is already closed.",
  ERR_DEPOSIT_TOO_LOW: "The deposit is too small. Attach more than 0.05 NEAR.",
  ERR_TREASURY_LE_RESERVE: "The treasury must be larger than the reserve floor.",
  ERR_BPS_SUM: "Reinvest and owner shares must add up to 100%.",
  ERR_NO_DESTINATIONS: "Pick at least one approved investment.",
  ERR_NAME: "Give your NFT a name.",
  ERR_MISSION: "Write a mission for your NFT.",
  ERR_NAME_TOO_LONG: "The name is too long (64 characters max).",
  ERR_MISSION_TOO_LONG: "The mission is too long (500 characters max).",
  ERR_TITLE_TOO_LONG: "The job title is too long (120 characters max).",
  ERR_DESCRIPTION_TOO_LONG: "The brief is too long (1,000 characters max).",
  ERR_CONTENT_TOO_LONG: "The submission is too long (2,000 characters max).",
  ERR_TOO_MANY_OPEN_JOBS: "This NFT already has 10 open jobs. Pay or close one first.",
  ERR_TOO_MANY_SUBMISSIONS: "This job already has the maximum 20 submissions.",
  ERR_NO_YIELD: "There is no yield to harvest yet.",
  ERR_NO_POSITION: "Nothing is invested yet, so there is nothing to harvest.",
  ERR_BUDGET: "Enter a budget above zero.",
  ERR_AMOUNT: "Enter an amount above zero.",
  ERR_REQUIRES_ONE_YOCTO: "NFT transfers must attach exactly 1 yoctoNEAR (your wallet adds it).",
  ERR_SELF_TRANSFER: "You already own this NFT. Enter a different account.",
  ERR_NO_TOKEN: "That NFT doesn't exist.",
};

export function friendlyError(err) {
  const raw = String(err?.message || err || "Something went wrong");
  const code = raw.match(/ERR_[A-Z_]+/)?.[0];
  if (code && CONTRACT[code]) return { title: "Rejected by the contract", body: CONTRACT[code], code };
  if (/reject|cancel|denied|closed the window|user closed/i.test(raw))
    return { title: "Cancelled in your wallet", body: "Nothing was sent. You can try again whenever you're ready." };
  if (/NotEnoughBalance|insufficient|LackBalanceForState|not enough/i.test(raw))
    return { title: "Not enough testnet NEAR", body: "Your wallet doesn't have enough test NEAR for this. Top up from a testnet faucet and try again." };
  if (/Connect a testnet wallet/i.test(raw)) return { title: "Connect a wallet first", body: "Connect a NEAR testnet wallet to continue." };
  if (/fetch|network|Failed to load|timeout/i.test(raw))
    return { title: "Network problem", body: "We couldn't reach NEAR testnet. Check your connection and try again." };
  return { title: "Something went wrong", body: raw.slice(0, 220) };
}
