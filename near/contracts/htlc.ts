import { context, storage, u128, logging, ContractPromiseBatch, env } from 'near-sdk-as';

// HTLC structure
@nearBindgen
export class HTLC {
  sender: string;
  receiver: string;
  amount: u128;
  hashlock: string;
  timelock: u64;
  withdrawn: bool;
  refunded: bool;
  secret: string | null;

  constructor(
    sender: string,
    receiver: string,
    amount: u128,
    hashlock: string,
    timelock: u64
  ) {
    this.sender = sender;
    this.receiver = receiver;
    this.amount = amount;
    this.hashlock = hashlock;
    this.timelock = timelock;
    this.withdrawn = false;
    this.refunded = false;
    this.secret = null;
  }
}

// Contract state
const HTLC_KEY_PREFIX = "htlc:";

export function createHTLC(
  receiver: string,
  hashlock: string,
  timelock: u64
): string {
  // Validate inputs
  assert(context.attachedDeposit > u128.Zero, "Must attach NEAR tokens");
  assert(receiver.length > 0, "Invalid receiver");
  assert(hashlock.length == 64, "Invalid hashlock length"); // SHA256 hex = 64 chars
  assert(timelock > env.block_timestamp(), "Timelock must be in the future");

  // Create HTLC
  const htlcId = context.sender + ":" + env.block_timestamp().toString();
  const htlc = new HTLC(
    context.sender,
    receiver,
    context.attachedDeposit,
    hashlock,
    timelock
  );

  // Store HTLC
  storage.set(HTLC_KEY_PREFIX + htlcId, htlc);

  logging.log(`HTLC created: ${htlcId}`);
  return htlcId;
}

export function withdraw(htlcId: string, secret: string): void {
  // Get HTLC
  const key = HTLC_KEY_PREFIX + htlcId;
  assert(storage.hasKey(key), "HTLC not found");
  
  const htlc = storage.getSome<HTLC>(key);
  
  // Validate
  assert(!htlc.withdrawn, "Already withdrawn");
  assert(!htlc.refunded, "Already refunded");
  assert(context.sender == htlc.receiver, "Only receiver can withdraw");
  
  // Verify secret
  const secretHash = sha256(secret);
  assert(secretHash == htlc.hashlock, "Invalid secret");
  
  // Update state
  htlc.withdrawn = true;
  htlc.secret = secret;
  storage.set(key, htlc);
  
  // Transfer funds
  ContractPromiseBatch.create(htlc.receiver).transfer(htlc.amount);
  
  logging.log(`HTLC withdrawn: ${htlcId}`);
}

export function refund(htlcId: string): void {
  // Get HTLC
  const key = HTLC_KEY_PREFIX + htlcId;
  assert(storage.hasKey(key), "HTLC not found");
  
  const htlc = storage.getSome<HTLC>(key);
  
  // Validate
  assert(!htlc.withdrawn, "Already withdrawn");
  assert(!htlc.refunded, "Already refunded");
  assert(context.sender == htlc.sender, "Only sender can refund");
  assert(env.block_timestamp() >= htlc.timelock, "Timelock not expired");
  
  // Update state
  htlc.refunded = true;
  storage.set(key, htlc);
  
  // Transfer funds back
  ContractPromiseBatch.create(htlc.sender).transfer(htlc.amount);
  
  logging.log(`HTLC refunded: ${htlcId}`);
}

export function getHTLC(htlcId: string): HTLC | null {
  const key = HTLC_KEY_PREFIX + htlcId;
  if (!storage.hasKey(key)) {
    return null;
  }
  return storage.getSome<HTLC>(key);
}

// Helper function to compute SHA256 (would need to be implemented or imported)
function sha256(input: string): string {
  // This is a placeholder - in real implementation, you'd use a proper SHA256 function
  // NEAR contracts can call host functions for crypto operations
  return env.sha256(String.UTF8.encode(input));
}