use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::UnorderedMap;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault};
use sha2::{Sha256, Digest};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct HTLC {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: NearToken,
    pub hashlock: String,
    pub timelock: u64,
    pub withdrawn: bool,
    pub refunded: bool,
    pub secret: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct HTLCContract {
    htlcs: UnorderedMap<String, HTLC>,
    next_id: u64,
}

#[near]
impl HTLCContract {
    #[init]
    pub fn new() -> Self {
        Self {
            htlcs: UnorderedMap::new(b"h"),
            next_id: 0,
        }
    }

    #[payable]
    pub fn create_htlc(
        &mut self,
        receiver: AccountId,
        hashlock: String,
        timelock: u64,
    ) -> String {
        let deposit = env::attached_deposit();
        assert!(!deposit.is_zero(), "Must attach NEAR tokens");
        assert!(hashlock.len() == 64, "Invalid hashlock length - must be 64 hex characters");
        assert!(
            timelock > env::block_timestamp_ms() / 1000,
            "Timelock must be in the future"
        );

        let htlc_id = format!("{}:{}", env::predecessor_account_id(), self.next_id);
        self.next_id += 1;

        let htlc = HTLC {
            sender: env::predecessor_account_id(),
            receiver: receiver.clone(),
            amount: deposit,
            hashlock: hashlock.clone(),
            timelock,
            withdrawn: false,
            refunded: false,
            secret: None,
        };

        self.htlcs.insert(htlc_id.clone(), htlc);

        env::log_str(&format!("HTLC created: {}", htlc_id));
        htlc_id
    }

    pub fn withdraw(&mut self, htlc_id: String, secret: String) {
        let mut htlc = self
            .htlcs
            .get(&htlc_id)
            .expect("HTLC not found")
            .clone();

        assert!(!htlc.withdrawn, "Already withdrawn");
        assert!(!htlc.refunded, "Already refunded");
        assert_eq!(
            env::predecessor_account_id(),
            htlc.receiver,
            "Only receiver can withdraw"
        );

        // Verify secret
        let secret_hash = self.sha256(&secret);
        assert_eq!(secret_hash, htlc.hashlock, "Invalid secret");

        // Update state
        htlc.withdrawn = true;
        htlc.secret = Some(secret.clone());
        self.htlcs.insert(htlc_id.clone(), htlc.clone());

        // Transfer funds
        env::promise_create(
            htlc.receiver.clone(),
            "".into(),
            &[],
            htlc.amount,
            env::prepaid_gas().saturating_div(2),
        );

        env::log_str(&format!("HTLC withdrawn: {} with secret: {}", htlc_id, secret));
    }

    pub fn refund(&mut self, htlc_id: String) {
        let mut htlc = self
            .htlcs
            .get(&htlc_id)
            .expect("HTLC not found")
            .clone();

        assert!(!htlc.withdrawn, "Already withdrawn");
        assert!(!htlc.refunded, "Already refunded");
        assert_eq!(
            env::predecessor_account_id(),
            htlc.sender,
            "Only sender can refund"
        );
        assert!(
            env::block_timestamp_ms() / 1000 >= htlc.timelock,
            "Timelock not expired"
        );

        // Update state
        htlc.refunded = true;
        self.htlcs.insert(htlc_id.clone(), htlc.clone());

        // Transfer funds back
        env::promise_create(
            htlc.sender.clone(),
            "".into(),
            &[],
            htlc.amount,
            env::prepaid_gas().saturating_div(2),
        );

        env::log_str(&format!("HTLC refunded: {}", htlc_id));
    }

    pub fn get_htlc(&self, htlc_id: String) -> Option<HTLC> {
        self.htlcs.get(&htlc_id).cloned()
    }

    pub fn get_all_htlcs(&self) -> Vec<(String, HTLC)> {
        self.htlcs.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    // Helper function to compute SHA256
    fn sha256(&self, input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        format!("{:x}", hasher.finalize())
    }
} 