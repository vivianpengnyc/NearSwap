use near_sdk::{near, AccountId, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MinimalContract {
    pub owner: AccountId,
    pub counter: u64,
}

#[near]
impl MinimalContract {
    #[init]
    pub fn new() -> Self {
        Self {
            owner: near_sdk::env::predecessor_account_id(),
            counter: 0,
        }
    }

    pub fn get_counter(&self) -> u64 {
        self.counter
    }

    pub fn increment(&mut self) {
        self.counter += 1;
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }
} 