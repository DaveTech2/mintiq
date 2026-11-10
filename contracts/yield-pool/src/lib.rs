//! Demo yield pool for Mintiq.
//!
//! This is a clearly labelled DEMO destination, not a real NEAR validator staking
//! pool. It holds principal and accrues a fixed 10% annual yield based on time.
//! A `demo_accrue` method lets the end-to-end demo show a harvest without waiting
//! a year.

use near_sdk::json_types::U128;
use near_sdk::store::IterableMap;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

const DEMO_APY_BPS: u16 = 1_000; // 10% annual, demo rate
const MS_PER_YEAR: u128 = 365 * 24 * 60 * 60 * 1_000;
const TGAS_CREDIT: u64 = 30;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Position {
    pub principal: U128,
    pub pending_yield: U128,
    pub last_update_ms: u64,
    /// Contract that deposited (the Mintiq contract).
    pub depositor: AccountId,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Keyed by "depositor:token_id"
    pub positions: IterableMap<String, Position>,
    pub demo: bool,
}

fn key(depositor: &AccountId, token_id: &str) -> String {
    format!("{depositor}:{token_id}")
}

fn accrue(pos: &mut Position, now: u64) {
    if now <= pos.last_update_ms || pos.principal.0 == 0 {
        pos.last_update_ms = now.max(pos.last_update_ms);
        return;
    }
    let elapsed = (now - pos.last_update_ms) as u128;
    let interest = pos.principal.0 * DEMO_APY_BPS as u128 * elapsed / 10_000 / MS_PER_YEAR;
    pos.pending_yield = U128(pos.pending_yield.0 + interest);
    pos.last_update_ms = now;
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            positions: IterableMap::new(b"p"),
            demo: true,
        }
    }

    pub fn is_demo(&self) -> bool {
        self.demo
    }

    pub fn apy_bps(&self) -> u16 {
        DEMO_APY_BPS
    }

    /// Called by the Mintiq contract with attached principal.
    #[payable]
    pub fn deposit(&mut self, token_id: String) {
        let depositor = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "ERR_AMOUNT");
        let now = env::block_timestamp_ms();
        let k = key(&depositor, &token_id);
        if let Some(pos) = self.positions.get_mut(&k) {
            accrue(pos, now);
            pos.principal = U128(pos.principal.0 + amount);
        } else {
            self.positions.insert(
                k,
                Position {
                    principal: U128(amount),
                    pending_yield: U128(0),
                    last_update_ms: now,
                    depositor,
                },
            );
        }
    }

    /// Accrue a demo yield of `bps` basis points of principal immediately.
    /// Labelled demo-only so the walkthrough can harvest without waiting a year.
    pub fn demo_accrue(&mut self, token_id: String, bps: u16) {
        require!(self.demo, "ERR_NOT_DEMO");
        require!(bps > 0 && bps <= 2_000, "ERR_BPS"); // cap at 20%
        let depositor = env::predecessor_account_id();
        let k = key(&depositor, &token_id);
        let pos = self.positions.get_mut(&k).expect("ERR_NO_POSITION");
        let add = pos.principal.0 * bps as u128 / 10_000;
        require!(add > 0, "ERR_AMOUNT");
        pos.pending_yield = U128(pos.pending_yield.0 + add);
        env::log_str(&format!(
            "DEMO yield pool accrued {bps} bps on token {token_id} (not real staking)"
        ));
    }

    /// Send pending yield back to the depositor via `credit_earnings`.
    /// The yield is paid from this contract's balance. For the demo, the pool
    /// account is funded with extra NEAR so it can pay simulated yield.
    pub fn harvest(&mut self, token_id: String) -> Promise {
        let depositor = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let k = key(&depositor, &token_id);
        let pos = self.positions.get_mut(&k).expect("ERR_NO_POSITION");
        accrue(pos, now);
        let yield_amount = pos.pending_yield.0;
        require!(yield_amount > 0, "ERR_NO_YIELD");
        pos.pending_yield = U128(0);
        require!(
            env::account_balance().as_yoctonear() >= yield_amount + pos.principal.0,
            "ERR_POOL_UNDERFUNDED"
        );
        let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "token_id": token_id
        }))
        .unwrap();
        Promise::new(depositor).function_call(
            "credit_earnings".to_string(),
            args,
            NearToken::from_yoctonear(yield_amount),
            Gas::from_tgas(TGAS_CREDIT),
        )
    }

    pub fn get_position(&self, depositor: AccountId, token_id: String) -> Option<Position> {
        let mut pos = self.positions.get(&key(&depositor, &token_id)).cloned()?;
        accrue(&mut pos, env::block_timestamp_ms());
        Some(pos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn n(near: u128) -> u128 {
        near * 10u128.pow(24)
    }

    fn ctx(pred: AccountId, deposit: u128, balance: u128, ts_ms: u64) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(pred)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .account_balance(NearToken::from_yoctonear(balance))
            .block_timestamp(ts_ms * 1_000_000) // ns
            .build());
    }

    #[test]
    fn deposit_and_demo_accrue() {
        let mut c = Contract::new();
        assert!(c.is_demo());
        assert_eq!(c.apy_bps(), 1_000);
        ctx(accounts(0), n(20), n(100), 1_000);
        c.deposit("1".into());
        c.demo_accrue("1".into(), 500); // 5%
        let p = c.get_position(accounts(0), "1".into()).unwrap();
        assert_eq!(p.principal.0, n(20));
        assert_eq!(p.pending_yield.0, n(1));
    }
}
