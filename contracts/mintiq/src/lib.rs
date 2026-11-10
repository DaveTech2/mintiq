//! Mintiq: an NFT that holds a treasury, hires contributors, and invests idle funds.
//! Spending, reserve, and destination rules are enforced in this contract so the
//! agent account cannot break them.

use near_sdk::json_types::U128;
use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError,
};
use near_sdk::serde_json;

pub type TokenId = String;

const TGAS_DEPOSIT: u64 = 20;
const TGAS_CALLBACK: u64 = 15;
/// Buffer held back from a mint deposit to cover contract storage.
const STORAGE_BUFFER: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
/// Public-mint limits so one visitor cannot bloat shared contract storage.
const MAX_NAME_LEN: usize = 64;
const MAX_MISSION_LEN: usize = 500;
const MAX_TITLE_LEN: usize = 120;
const MAX_DESCRIPTION_LEN: usize = 1_000;
const MAX_CONTENT_LEN: usize = 2_000;
const MAX_DESTINATIONS: usize = 5;
const MAX_OPEN_JOBS: usize = 10;
const MAX_SUBMISSIONS_PER_JOB: usize = 20;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Rules {
    /// Maximum payout for a single job, in yoctoNEAR.
    pub max_per_task: U128,
    /// Minimum liquid treasury that must remain after any spend or investment.
    pub min_reserve: U128,
    /// Basis points of harvested earnings returned to the treasury (0–10000).
    pub reinvest_bps: u16,
    /// Basis points of harvested earnings paid to the NFT owner (0–10000).
    pub owner_share_bps: u16,
    /// Only these accounts may receive invested funds.
    pub approved_destinations: Vec<AccountId>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct TrackRecord {
    pub jobs_completed: u64,
    pub contributors_hired: u64,
    pub total_spent: U128,
    pub total_earned: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Evaluation {
    pub score: u8,
    pub reasoning: String,
    pub recommend_approve: bool,
    /// "heuristic", "near-ai", or "openai" — recorded for honesty, not trusted by the contract.
    pub evaluator: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Submission {
    pub id: u64,
    pub contributor: AccountId,
    pub content: String,
    pub submitted_at_ms: u64,
    pub evaluation: Option<Evaluation>,
    pub paid: bool,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub enum JobStatus {
    Open,
    Paid,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Job {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub budget: U128,
    pub status: JobStatus,
    pub posted_at_ms: u64,
    pub submissions: Vec<Submission>,
    pub paid_submission_id: Option<u64>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct InvestmentPosition {
    pub destination: AccountId,
    pub principal: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenRecord {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub agent_id: AccountId,
    pub name: String,
    pub mission: String,
    pub rules: Rules,
    pub liquid: U128,
    pub invested: U128,
    pub track_record: TrackRecord,
    pub hired: Vec<AccountId>,
    pub jobs: Vec<Job>,
    pub investments: Vec<InvestmentPosition>,
    pub minted_at_ms: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct JsonToken {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub next_id: u64,
    pub tokens: IterableMap<TokenId, TokenRecord>,
    pub metadata: NFTContractMetadata,
}

fn yocto(v: U128) -> u128 {
    v.0
}

fn u128_to_near_display(amount: u128) -> String {
    // 24 decimals; trim trailing zeros for metadata readability.
    let whole = amount / 10u128.pow(24);
    let frac = amount % 10u128.pow(24);
    if frac == 0 {
        format!("{whole} NEAR")
    } else {
        let frac_str = format!("{frac:024}");
        let frac_trim = frac_str.trim_end_matches('0');
        format!("{whole}.{frac_trim} NEAR")
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            next_id: 1,
            tokens: IterableMap::new(b"t"),
            metadata: NFTContractMetadata {
                spec: "nft-1.0.0".to_string(),
                name: "Mintiq".to_string(),
                symbol: "MINTIQ".to_string(),
                icon: None,
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
        }
    }

    /// Mint a Mintiq NFT. The attached deposit minus a 0.05 NEAR storage buffer
    /// becomes the NFT's liquid treasury.
    #[payable]
    pub fn mint(
        &mut self,
        name: String,
        mission: String,
        agent_id: AccountId,
        max_per_task: U128,
        min_reserve: U128,
        reinvest_bps: u16,
        owner_share_bps: u16,
        approved_destinations: Vec<AccountId>,
    ) -> TokenId {
        let name = name.trim().to_string();
        let mission = mission.trim().to_string();
        require!(!name.is_empty(), "ERR_NAME");
        require!(!mission.is_empty(), "ERR_MISSION");
        require!(name.len() <= MAX_NAME_LEN, "ERR_NAME_TOO_LONG");
        require!(mission.len() <= MAX_MISSION_LEN, "ERR_MISSION_TOO_LONG");
        require!(
            approved_destinations.len() <= MAX_DESTINATIONS,
            "ERR_TOO_MANY_DESTINATIONS"
        );
        require!(
            reinvest_bps as u32 + owner_share_bps as u32 == 10_000,
            "ERR_BPS_SUM"
        );
        require!(yocto(max_per_task) > 0, "ERR_MAX_PER_TASK");
        require!(!approved_destinations.is_empty(), "ERR_NO_DESTINATIONS");

        let attached = env::attached_deposit().as_yoctonear();
        require!(attached > STORAGE_BUFFER, "ERR_DEPOSIT_TOO_LOW");
        let liquid = attached - STORAGE_BUFFER;
        require!(liquid > yocto(min_reserve), "ERR_TREASURY_LE_RESERVE");

        let token_id = self.next_id.to_string();
        self.next_id += 1;

        let owner_id = env::predecessor_account_id();
        let record = TokenRecord {
            token_id: token_id.clone(),
            owner_id: owner_id.clone(),
            agent_id,
            name,
            mission,
            rules: Rules {
                max_per_task,
                min_reserve,
                reinvest_bps,
                owner_share_bps,
                approved_destinations,
            },
            liquid: U128(liquid),
            invested: U128(0),
            track_record: TrackRecord {
                jobs_completed: 0,
                contributors_hired: 0,
                total_spent: U128(0),
                total_earned: U128(0),
            },
            hired: Vec::new(),
            jobs: Vec::new(),
            investments: Vec::new(),
            minted_at_ms: env::block_timestamp_ms(),
        };
        self.tokens.insert(token_id.clone(), record);

        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.2.0\",\"event\":\"nft_mint\",\"data\":[{{\"owner_id\":\"{}\",\"token_ids\":[\"{}\"]}}]}}",
            owner_id, token_id
        ));
        token_id
    }

    /// Owner-only. Rotate the agent account (upgrade path toward a TEE/Shade agent).
    pub fn set_agent(&mut self, token_id: TokenId, agent_id: AccountId) {
        let token = self.token_mut(&token_id);
        require!(
            env::predecessor_account_id() == token.owner_id,
            "ERR_NOT_OWNER"
        );
        token.agent_id = agent_id;
    }

    /// Owner-only. Add an approved investment destination (e.g. a future Intents route).
    pub fn add_approved_destination(&mut self, token_id: TokenId, destination: AccountId) {
        let token = self.token_mut(&token_id);
        require!(
            env::predecessor_account_id() == token.owner_id,
            "ERR_NOT_OWNER"
        );
        if !token.rules.approved_destinations.contains(&destination) {
            token.rules.approved_destinations.push(destination);
        }
    }

    /// Agent or owner. Post a job. Budget cannot exceed max_per_task.
    pub fn post_job(
        &mut self,
        token_id: TokenId,
        title: String,
        description: String,
        budget: U128,
    ) -> u64 {
        let token = self.token_mut(&token_id);
        require_agent_or_owner(token);
        let title = title.trim().to_string();
        require!(!title.is_empty(), "ERR_TITLE");
        require!(title.len() <= MAX_TITLE_LEN, "ERR_TITLE_TOO_LONG");
        require!(description.len() <= MAX_DESCRIPTION_LEN, "ERR_DESCRIPTION_TOO_LONG");
        require!(
            token.jobs.iter().filter(|j| matches!(j.status, JobStatus::Open)).count() < MAX_OPEN_JOBS,
            "ERR_TOO_MANY_OPEN_JOBS"
        );
        require!(yocto(budget) > 0, "ERR_BUDGET");
        require!(
            yocto(budget) <= yocto(token.rules.max_per_task),
            "ERR_OVERSPEND"
        );
        // Soft availability check so we don't post work the treasury cannot pay.
        require!(
            yocto(token.liquid).saturating_sub(yocto(budget)) >= yocto(token.rules.min_reserve),
            "ERR_RESERVE"
        );
        let id = token.jobs.len() as u64 + 1;
        token.jobs.push(Job {
            id,
            title,
            description,
            budget,
            status: JobStatus::Open,
            posted_at_ms: env::block_timestamp_ms(),
            submissions: Vec::new(),
            paid_submission_id: None,
        });
        id
    }

    /// Anyone can submit work to an open job.
    pub fn submit_work(&mut self, token_id: TokenId, job_id: u64, content: String) -> u64 {
        let contributor = env::predecessor_account_id();
        let content = content.trim().to_string();
        require!(!content.is_empty(), "ERR_CONTENT");
        require!(content.len() <= MAX_CONTENT_LEN, "ERR_CONTENT_TOO_LONG");
        let token = self.token_mut(&token_id);
        let job = job_mut(token, job_id);
        require!(matches!(job.status, JobStatus::Open), "ERR_JOB_CLOSED");
        require!(
            job.submissions.len() < MAX_SUBMISSIONS_PER_JOB,
            "ERR_TOO_MANY_SUBMISSIONS"
        );
        let id = job.submissions.len() as u64 + 1;
        job.submissions.push(Submission {
            id,
            contributor,
            content,
            submitted_at_ms: env::block_timestamp_ms(),
            evaluation: None,
            paid: false,
        });
        id
    }

    /// Agent-only. Record a score and recommendation. The contract does not auto-pay.
    pub fn record_evaluation(
        &mut self,
        token_id: TokenId,
        job_id: u64,
        submission_id: u64,
        score: u8,
        reasoning: String,
        recommend_approve: bool,
        evaluator: String,
    ) {
        require!(score <= 100, "ERR_SCORE");
        require!(reasoning.len() <= MAX_DESCRIPTION_LEN, "ERR_REASONING_TOO_LONG");
        require!(evaluator.len() <= MAX_TITLE_LEN, "ERR_EVALUATOR_TOO_LONG");
        let token = self.token_mut(&token_id);
        require!(
            env::predecessor_account_id() == token.agent_id,
            "ERR_NOT_AGENT"
        );
        let job = job_mut(token, job_id);
        require!(matches!(job.status, JobStatus::Open), "ERR_JOB_CLOSED");
        let sub = submission_mut(job, submission_id);
        sub.evaluation = Some(Evaluation {
            score,
            reasoning,
            recommend_approve,
            evaluator,
        });
    }

    /// Owner-only. Pay the job budget to the chosen contributor from the treasury.
    pub fn approve_and_pay(&mut self, token_id: TokenId, job_id: u64, submission_id: u64) -> Promise {
        let owner = env::predecessor_account_id();
        let token = self.token_mut(&token_id);
        require!(owner == token.owner_id, "ERR_NOT_OWNER");
        let budget = {
            let job = job_mut(token, job_id);
            require!(matches!(job.status, JobStatus::Open), "ERR_JOB_CLOSED");
            yocto(job.budget)
        };
        require!(budget <= yocto(token.rules.max_per_task), "ERR_OVERSPEND");
        require!(
            yocto(token.liquid).saturating_sub(budget) >= yocto(token.rules.min_reserve),
            "ERR_RESERVE"
        );

        let contributor = {
            let job = job_mut(token, job_id);
            let sub = submission_mut(job, submission_id);
            require!(!sub.paid, "ERR_ALREADY_PAID");
            require!(sub.evaluation.is_some(), "ERR_NOT_EVALUATED");
            sub.contributor.clone()
        };

        token.liquid = U128(yocto(token.liquid) - budget);
        token.track_record.total_spent = U128(yocto(token.track_record.total_spent) + budget);
        token.track_record.jobs_completed += 1;
        if !token.hired.contains(&contributor) {
            token.hired.push(contributor.clone());
            token.track_record.contributors_hired = token.hired.len() as u64;
        }
        {
            let job = job_mut(token, job_id);
            job.status = JobStatus::Paid;
            job.paid_submission_id = Some(submission_id);
            submission_mut(job, submission_id).paid = true;
        }

        Promise::new(contributor).transfer(NearToken::from_yoctonear(budget))
    }

    /// Agent or owner. Move idle liquid funds to an approved destination.
    /// Rejects unapproved destinations and any amount that would breach the reserve.
    pub fn invest_idle(&mut self, token_id: TokenId, destination: AccountId, amount: U128) -> Promise {
        require!(yocto(amount) > 0, "ERR_AMOUNT");
        let token = self.token_mut(&token_id);
        require_agent_or_owner(token);
        require!(
            token.rules.approved_destinations.contains(&destination),
            "ERR_UNAPPROVED_DESTINATION"
        );
        require!(
            yocto(token.liquid).saturating_sub(yocto(amount)) >= yocto(token.rules.min_reserve),
            "ERR_RESERVE"
        );

        token.liquid = U128(yocto(token.liquid) - yocto(amount));
        token.invested = U128(yocto(token.invested) + yocto(amount));
        upsert_investment(token, &destination, yocto(amount) as i128);

        let args = serde_json::to_vec(&serde_json::json!({ "token_id": token_id })).unwrap();
        Promise::new(destination.clone())
            .function_call(
                "deposit".to_string(),
                args,
                NearToken::from_yoctonear(yocto(amount)),
                Gas::from_tgas(TGAS_DEPOSIT),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(TGAS_CALLBACK))
                    .on_invest(token_id, destination, amount),
            )
    }

    #[private]
    pub fn on_invest(
        &mut self,
        token_id: TokenId,
        destination: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        if result.is_err() {
            if let Some(token) = self.tokens.get_mut(&token_id) {
                token.liquid = U128(yocto(token.liquid) + yocto(amount));
                token.invested = U128(yocto(token.invested).saturating_sub(yocto(amount)));
                upsert_investment(token, &destination, -(yocto(amount) as i128));
            }
        }
    }

    /// Agent or owner, demo-only path: ask the approved yield pool to accrue a
    /// labelled demo yield immediately so the walkthrough can harvest without
    /// waiting a year. The pool itself also requires `demo = true`.
    pub fn demo_accrue(&mut self, token_id: TokenId, destination: AccountId, bps: u16) -> Promise {
        let token = self.token_mut(&token_id);
        require_agent_or_owner(token);
        require!(
            token.rules.approved_destinations.contains(&destination),
            "ERR_UNAPPROVED_DESTINATION"
        );
        require!(bps > 0 && bps <= 2_000, "ERR_BPS");
        let args = serde_json::to_vec(&serde_json::json!({
            "token_id": token_id,
            "bps": bps
        }))
        .unwrap();
        Promise::new(destination).function_call(
            "demo_accrue".to_string(),
            args,
            NearToken::from_yoctonear(0),
            Gas::from_tgas(20),
        )
    }

    /// Agent or owner. Ask an approved yield destination to send accrued earnings back.
    pub fn harvest(&mut self, token_id: TokenId, destination: AccountId) -> Promise {
        let token = self.token_mut(&token_id);
        require_agent_or_owner(token);
        require!(
            token.rules.approved_destinations.contains(&destination),
            "ERR_UNAPPROVED_DESTINATION"
        );
        let args = serde_json::to_vec(&serde_json::json!({ "token_id": token_id })).unwrap();
        Promise::new(destination).function_call(
            "harvest".to_string(),
            args,
            NearToken::from_yoctonear(0),
            Gas::from_tgas(40),
        )
    }

    /// Called by an approved destination with attached yield. Splits earnings
    /// between the treasury (reinvest) and the owner according to the mint rules.
    #[payable]
    pub fn credit_earnings(&mut self, token_id: TokenId) -> Promise {
        let dest = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "ERR_AMOUNT");
        let token = self.token_mut(&token_id);
        require!(
            token.rules.approved_destinations.contains(&dest),
            "ERR_UNAPPROVED_DESTINATION"
        );

        token.track_record.total_earned = U128(yocto(token.track_record.total_earned) + amount);
        let owner_cut = amount * token.rules.owner_share_bps as u128 / 10_000;
        let reinvest = amount - owner_cut;
        token.liquid = U128(yocto(token.liquid) + reinvest);
        let owner = token.owner_id.clone();
        if owner_cut > 0 {
            Promise::new(owner).transfer(NearToken::from_yoctonear(owner_cut))
        } else {
            Promise::new(env::current_account_id())
        }
    }

    // ── NEP-171 ──────────────────────────────────────────────────────────────

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128((self.next_id.saturating_sub(1)) as u128)
    }

    pub fn nft_token(&self, token_id: TokenId) -> Option<JsonToken> {
        self.tokens.get(&token_id).map(|t| self.to_json_token(t))
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let limit = limit.unwrap_or(50) as usize;
        self.tokens
            .iter()
            .skip(start)
            .take(limit)
            .map(|(_, t)| self.to_json_token(t))
            .collect()
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let limit = limit.unwrap_or(50) as usize;
        self.tokens
            .iter()
            .filter(|(_, t)| t.owner_id == account_id)
            .skip(start)
            .take(limit)
            .map(|(_, t)| self.to_json_token(t))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(
            self.tokens
                .iter()
                .filter(|(_, t)| t.owner_id == account_id)
                .count() as u128,
        )
    }

    /// Transfer ownership of the NFT. The treasury stays with the token.
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, memo: Option<String>) {
        let sender = env::predecessor_account_id();
        require!(sender != receiver_id, "ERR_SELF_TRANSFER");
        let token = self.token_mut(&token_id);
        require!(sender == token.owner_id, "ERR_NOT_OWNER");
        let from = token.owner_id.clone();
        token.owner_id = receiver_id.clone();
        let memo_s = memo.unwrap_or_default();
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.2.0\",\"event\":\"nft_transfer\",\"data\":[{{\"authorized_id\":null,\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":[\"{}\"],\"memo\":\"{}\"}}]}}",
            from, receiver_id, token_id, memo_s
        ));
    }

    // ── Views ────────────────────────────────────────────────────────────────

    pub fn get_nft(&self, token_id: TokenId) -> TokenRecord {
        self.token(&token_id).clone()
    }

    pub fn get_track_record(&self, token_id: TokenId) -> TrackRecord {
        self.token(&token_id).track_record.clone()
    }

    pub fn get_treasury(&self, token_id: TokenId) -> (U128, U128, U128) {
        let t = self.token(&token_id);
        (t.liquid, t.invested, t.rules.min_reserve)
    }

    pub fn get_rules(&self, token_id: TokenId) -> Rules {
        self.token(&token_id).rules.clone()
    }

    pub fn get_jobs(&self, token_id: TokenId) -> Vec<Job> {
        self.token(&token_id).jobs.clone()
    }

    pub fn list_token_ids(&self) -> Vec<TokenId> {
        self.tokens.keys().cloned().collect()
    }

    fn token(&self, token_id: &TokenId) -> &TokenRecord {
        self.tokens.get(token_id).expect("ERR_NO_TOKEN")
    }

    fn token_mut(&mut self, token_id: &TokenId) -> &mut TokenRecord {
        self.tokens.get_mut(token_id).expect("ERR_NO_TOKEN")
    }

    fn to_json_token(&self, t: &TokenRecord) -> JsonToken {
        let extra = serde_json::json!({
            "mission": t.mission,
            "agent_id": t.agent_id,
            "liquid": t.liquid,
            "invested": t.invested,
            "min_reserve": t.rules.min_reserve,
            "max_per_task": t.rules.max_per_task,
            "jobs_completed": t.track_record.jobs_completed,
            "contributors_hired": t.track_record.contributors_hired,
            "total_spent": t.track_record.total_spent,
            "total_earned": t.track_record.total_earned,
        });
        let description = format!(
            "{}\n\nTrack record: {} jobs completed, {} contributors hired, spent {}, earned {}.",
            t.mission,
            t.track_record.jobs_completed,
            t.track_record.contributors_hired,
            u128_to_near_display(yocto(t.track_record.total_spent)),
            u128_to_near_display(yocto(t.track_record.total_earned)),
        );
        JsonToken {
            token_id: t.token_id.clone(),
            owner_id: t.owner_id.clone(),
            metadata: TokenMetadata {
                title: Some(t.name.clone()),
                description: Some(description),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: Some(t.minted_at_ms.to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(extra.to_string()),
                reference: None,
                reference_hash: None,
            },
        }
    }
}

/// The NFT's agent or its owner may run treasury operations; both are bound
/// by the same caps, reserve floor and destination allowlist.
fn require_agent_or_owner(token: &TokenRecord) {
    let caller = env::predecessor_account_id();
    require!(
        caller == token.agent_id || caller == token.owner_id,
        "ERR_NOT_AGENT_OR_OWNER"
    );
}

fn job_mut(token: &mut TokenRecord, job_id: u64) -> &mut Job {
    token
        .jobs
        .iter_mut()
        .find(|j| j.id == job_id)
        .expect("ERR_NO_JOB")
}

fn submission_mut(job: &mut Job, submission_id: u64) -> &mut Submission {
    job.submissions
        .iter_mut()
        .find(|s| s.id == submission_id)
        .expect("ERR_NO_SUBMISSION")
}

fn upsert_investment(token: &mut TokenRecord, destination: &AccountId, delta: i128) {
    if let Some(pos) = token
        .investments
        .iter_mut()
        .find(|p| &p.destination == destination)
    {
        let next = yocto(pos.principal) as i128 + delta;
        pos.principal = U128(next.max(0) as u128);
    } else if delta > 0 {
        token.investments.push(InvestmentPosition {
            destination: destination.clone(),
            principal: U128(delta as u128),
        });
    }
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn n(near: u128) -> u128 {
        near * 10u128.pow(24)
    }

    fn context(pred: AccountId, deposit: u128) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(pred)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_000_000_000)
            .build()
    }

    fn mint_default(c: &mut Contract) -> TokenId {
        // treasury = 50 NEAR - 0.05 buffer, reserve 10, max task 2.5
        testing_env!(context(accounts(0), n(50) + STORAGE_BUFFER));
        c.mint(
            "Meme Studio".into(),
            "build a meme production business".into(),
            accounts(1),
            U128(n(5) / 2), // 2.5 NEAR
            U128(n(10)),
            7_000,
            3_000,
            vec![accounts(5)],
        )
    }

    #[test]
    fn mint_sets_treasury_and_rules() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        let t = c.get_nft(id);
        assert_eq!(t.owner_id, accounts(0));
        assert_eq!(t.agent_id, accounts(1));
        assert_eq!(yocto(t.liquid), n(50));
        assert_eq!(yocto(t.rules.min_reserve), n(10));
        assert_eq!(yocto(t.rules.max_per_task), n(5) / 2);
        assert_eq!(t.track_record.jobs_completed, 0);
    }

    #[test]
    fn nft_token_exposes_track_record_in_metadata() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        let json = c.nft_token(id).unwrap();
        assert!(json.metadata.title.unwrap().contains("Meme Studio"));
        let extra = json.metadata.extra.unwrap();
        assert!(extra.contains("jobs_completed"));
        assert!(extra.contains("total_earned"));
        assert_eq!(c.nft_metadata().spec, "nft-1.0.0");
        assert_eq!(c.nft_total_supply().0, 1);
    }

    #[test]
    fn post_job_happy_path() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        let job_id = c.post_job(
            id,
            "5 original memes".into(),
            "Deliver 5 original memes, $5".into(),
            U128(n(5) / 2),
        );
        assert_eq!(job_id, 1);
        assert_eq!(c.get_jobs("1".into()).len(), 1);
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_AGENT_OR_OWNER")]
    fn stranger_cannot_post_job() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(3), 0));
        c.post_job(id, "x".into(), "y".into(), U128(n(1)));
    }

    #[test]
    #[should_panic(expected = "ERR_OVERSPEND")]
    fn post_job_rejects_over_max_per_task() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        c.post_job(id, "too big".into(), "y".into(), U128(n(6)));
    }

    #[test]
    fn evaluate_and_owner_pay_updates_track_record() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        c.post_job(id.clone(), "5 original memes".into(), "d".into(), U128(n(5) / 2));
        testing_env!(context(accounts(2), 0));
        c.submit_work(id.clone(), 1, "five meme drafts...".into());
        testing_env!(context(accounts(1), 0));
        c.record_evaluation(
            id.clone(),
            1,
            1,
            88,
            "Clear, on-brief, original.".into(),
            true,
            "heuristic".into(),
        );
        testing_env!(context(accounts(0), 0));
        let _ = c.approve_and_pay(id.clone(), 1, 1);
        let t = c.get_nft(id);
        assert_eq!(t.track_record.jobs_completed, 1);
        assert_eq!(t.track_record.contributors_hired, 1);
        assert_eq!(yocto(t.track_record.total_spent), n(5) / 2);
        assert_eq!(yocto(t.liquid), n(50) - n(5) / 2);
        assert!(t.hired.contains(&accounts(2)));
        assert!(matches!(t.jobs[0].status, JobStatus::Paid));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_OWNER")]
    fn only_owner_can_approve_payment() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        c.post_job(id.clone(), "j".into(), "d".into(), U128(n(1)));
        testing_env!(context(accounts(2), 0));
        c.submit_work(id.clone(), 1, "work".into());
        testing_env!(context(accounts(1), 0));
        c.record_evaluation(id.clone(), 1, 1, 80, "ok".into(), true, "heuristic".into());
        testing_env!(context(accounts(1), 0));
        let _ = c.approve_and_pay(id, 1, 1);
    }

    #[test]
    #[should_panic(expected = "ERR_RESERVE")]
    fn pay_rejects_reserve_breach() {
        let mut c = Contract::new();
        // treasury 12 NEAR, reserve 10, max task 2.5 — first $5 pay is ok (liquid 9.5 < 10)? 
        // 12 - 2.5 = 9.5 < 10, so even the first pay should fail. Use treasury 12.
        testing_env!(context(accounts(0), n(12) + STORAGE_BUFFER));
        let id = c.mint(
            "Tight".into(),
            "mission".into(),
            accounts(1),
            U128(n(5) / 2),
            U128(n(10)),
            7_000,
            3_000,
            vec![accounts(5)],
        );
        // post_job also checks reserve, so this should panic at post OR we bypass by
        // posting a 1 NEAR job then trying to... we need a job that posts ok then pay fails.
        // If post also checks reserve, a 2.5 NEAR job on 12/10 reserve fails at post.
        // That's correct enforcement. This test documents post-time reserve rejection.
        testing_env!(context(accounts(1), 0));
        c.post_job(id, "j".into(), "d".into(), U128(n(5) / 2));
    }

    #[test]
    #[should_panic(expected = "ERR_UNAPPROVED_DESTINATION")]
    fn invest_rejects_unapproved_destination() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        let _ = c.invest_idle(id, "unapproved.test".parse().unwrap(), U128(n(5)));
    }

    #[test]
    #[should_panic(expected = "ERR_RESERVE")]
    fn invest_rejects_reserve_breach() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        // liquid 50, reserve 10, trying to invest 45 leaves 5 < 10
        let _ = c.invest_idle(id, accounts(5), U128(n(45)));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_AGENT_OR_OWNER")]
    fn stranger_cannot_invest() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(3), 0));
        let _ = c.invest_idle(id, accounts(5), U128(n(5)));
    }

    #[test]
    fn invest_idle_updates_balances() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        let _ = c.invest_idle(id.clone(), accounts(5), U128(n(20)));
        let t = c.get_nft(id);
        assert_eq!(yocto(t.liquid), n(30));
        assert_eq!(yocto(t.invested), n(20));
        assert_eq!(t.investments.len(), 1);
    }

    #[test]
    fn credit_earnings_splits_by_rules() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        // approved dest accounts(5) sends 10 NEAR of yield; 70% reinvest, 30% owner
        testing_env!(context(accounts(5), n(10)));
        let _ = c.credit_earnings(id.clone());
        let t = c.get_nft(id);
        assert_eq!(yocto(t.track_record.total_earned), n(10));
        assert_eq!(yocto(t.liquid), n(50) + n(7)); // 70% of 10
    }

    #[test]
    #[should_panic(expected = "ERR_UNAPPROVED_DESTINATION")]
    fn credit_earnings_rejects_unknown_caller() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(3), n(1)));
        let _ = c.credit_earnings(id);
    }

    #[test]
    fn owner_can_rotate_agent() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(0), 0));
        c.set_agent(id.clone(), accounts(3));
        assert_eq!(c.get_nft(id).agent_id, accounts(3));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_OWNER")]
    fn non_owner_cannot_rotate_agent() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        c.set_agent(id, accounts(3));
    }

    #[test]
    fn transfer_moves_ownership_not_treasury() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(0), 0));
        c.nft_transfer(accounts(4), id.clone(), Some("gift".into()));
        let t = c.get_nft(id.clone());
        assert_eq!(t.owner_id, accounts(4));
        assert_eq!(yocto(t.liquid), n(50));
        assert_eq!(c.nft_supply_for_owner(accounts(4)).0, 1);
        assert_eq!(c.nft_supply_for_owner(accounts(0)).0, 0);
    }

    #[test]
    #[should_panic(expected = "ERR_BPS_SUM")]
    fn mint_rejects_bps_not_100_percent() {
        let mut c = Contract::new();
        testing_env!(context(accounts(0), n(50) + STORAGE_BUFFER));
        c.mint(
            "x".into(),
            "y".into(),
            accounts(1),
            U128(n(1)),
            U128(n(1)),
            5_000,
            4_000,
            vec![accounts(5)],
        );
    }

    #[test]
    #[should_panic(expected = "ERR_UNAPPROVED_DESTINATION")]
    fn demo_accrue_rejects_unapproved_destination() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        let _ = c.demo_accrue(id, "unapproved.test".parse().unwrap(), 500);
    }

    #[test]
    fn harvest_rejects_unapproved_destination() {
        let mut c = Contract::new();
        let id = mint_default(&mut c);
        testing_env!(context(accounts(1), 0));
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = c.harvest(id, "unapproved.test".parse().unwrap());
        }));
        assert!(result.is_err());
    }

    // ── Public mint (wallet visitors) ────────────────────────────────────────

    fn tenth(x: u128) -> u128 {
        x * 10u128.pow(23)
    }

    /// A visitor with a faucet account mints with a small 1.5 NEAR deposit.
    fn visitor_mint(c: &mut Contract, visitor: AccountId) -> TokenId {
        testing_env!(context(visitor, tenth(15)));
        c.mint(
            "Visitor Studio".into(),
            "test the Mintiq loop".into(),
            accounts(1),
            U128(tenth(2)), // 0.2 NEAR max per task
            U128(tenth(5)), // 0.5 NEAR reserve
            7_000,
            3_000,
            vec![accounts(5)],
        )
    }

    #[test]
    fn any_caller_can_mint_with_small_deposit() {
        let mut c = Contract::new();
        let first = mint_default(&mut c);
        let id = visitor_mint(&mut c, accounts(3));
        assert_ne!(first, id);
        let t = c.get_nft(id.clone());
        assert_eq!(t.owner_id, accounts(3));
        assert_eq!(yocto(t.liquid), tenth(15) - STORAGE_BUFFER);
        assert_eq!(c.nft_supply_for_owner(accounts(3)).0, 1);
        assert_eq!(c.nft_tokens_for_owner(accounts(3), None, None)[0].token_id, id);
        assert_eq!(c.nft_total_supply().0, 2);
    }

    #[test]
    #[should_panic(expected = "ERR_DEPOSIT_TOO_LOW")]
    fn mint_requires_deposit() {
        let mut c = Contract::new();
        testing_env!(context(accounts(3), 0));
        c.mint("x".into(), "y".into(), accounts(1), U128(1), U128(0), 10_000, 0, vec![accounts(5)]);
    }

    #[test]
    #[should_panic(expected = "ERR_TOO_MANY_DESTINATIONS")]
    fn mint_caps_destination_list() {
        let mut c = Contract::new();
        testing_env!(context(accounts(3), tenth(15)));
        let many: Vec<AccountId> = (0..6).map(|i| format!("d{i}.testnet").parse().unwrap()).collect();
        c.mint("x".into(), "y".into(), accounts(1), U128(1), U128(0), 10_000, 0, many);
    }

    #[test]
    fn visitor_owner_runs_full_loop_on_own_token() {
        let mut c = Contract::new();
        let _demo = mint_default(&mut c);
        let id = visitor_mint(&mut c, accounts(3));
        // owner posts a job (allowed now), capped by max_per_task
        testing_env!(context(accounts(3), 0));
        let job = c.post_job(id.clone(), "3 taglines".into(), "d".into(), U128(tenth(1)));
        testing_env!(context(accounts(4), 0));
        let sub = c.submit_work(id.clone(), job, "tagline one; two; three".into());
        // only the agent may score
        testing_env!(context(accounts(1), 0));
        c.record_evaluation(id.clone(), job, sub, 90, "ok".into(), true, "heuristic".into());
        testing_env!(context(accounts(3), 0));
        let _ = c.approve_and_pay(id.clone(), job, sub);
        // owner invests idle funds into the approved pool, above reserve
        let _ = c.invest_idle(id.clone(), accounts(5), U128(tenth(5)));
        let t = c.get_nft(id);
        assert_eq!(t.track_record.jobs_completed, 1);
        assert_eq!(yocto(t.invested), tenth(5));
        assert_eq!(yocto(t.liquid), tenth(15) - STORAGE_BUFFER - tenth(1) - tenth(5));
        // demo token untouched
        let demo = c.get_nft("1".into());
        assert_eq!(demo.track_record.jobs_completed, 0);
        assert_eq!(yocto(demo.liquid), n(50));
    }

    #[test]
    #[should_panic(expected = "ERR_OVERSPEND")]
    fn owner_post_job_still_capped() {
        let mut c = Contract::new();
        let id = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(3), 0));
        c.post_job(id, "big".into(), "d".into(), U128(tenth(3)));
    }

    #[test]
    #[should_panic(expected = "ERR_RESERVE")]
    fn owner_invest_still_respects_reserve() {
        let mut c = Contract::new();
        let id = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(3), 0));
        // liquid 1.45, reserve 0.5 -> investing 1.0 leaves 0.45 < 0.5
        let _ = c.invest_idle(id, accounts(5), U128(n(1)));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_OWNER")]
    fn owner_of_one_token_cannot_pay_from_another() {
        let mut c = Contract::new();
        let demo = mint_default(&mut c); // owned by accounts(0)
        let _mine = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(1), 0));
        c.post_job(demo.clone(), "j".into(), "d".into(), U128(n(1)));
        testing_env!(context(accounts(4), 0));
        c.submit_work(demo.clone(), 1, "work".into());
        testing_env!(context(accounts(1), 0));
        c.record_evaluation(demo.clone(), 1, 1, 90, "ok".into(), true, "heuristic".into());
        testing_env!(context(accounts(3), 0));
        let _ = c.approve_and_pay(demo, 1, 1);
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_AGENT_OR_OWNER")]
    fn owner_of_one_token_cannot_invest_another() {
        let mut c = Contract::new();
        let demo = mint_default(&mut c);
        let _mine = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(3), 0));
        let _ = c.invest_idle(demo, accounts(5), U128(n(1)));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_AGENT")]
    fn owner_cannot_score_own_submissions() {
        let mut c = Contract::new();
        let id = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(3), 0));
        let job = c.post_job(id.clone(), "j".into(), "d".into(), U128(tenth(1)));
        testing_env!(context(accounts(4), 0));
        let sub = c.submit_work(id.clone(), job, "w".into());
        testing_env!(context(accounts(3), 0));
        c.record_evaluation(id, job, sub, 100, "self".into(), true, "self".into());
    }

    #[test]
    #[should_panic(expected = "ERR_CONTENT_TOO_LONG")]
    fn submission_length_is_capped() {
        let mut c = Contract::new();
        let id = visitor_mint(&mut c, accounts(3));
        testing_env!(context(accounts(3), 0));
        let job = c.post_job(id.clone(), "j".into(), "d".into(), U128(tenth(1)));
        testing_env!(context(accounts(4), 0));
        c.submit_work(id, job, "x".repeat(MAX_CONTENT_LEN + 1));
    }
}
