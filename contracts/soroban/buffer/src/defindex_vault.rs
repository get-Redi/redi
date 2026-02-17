use soroban_sdk::{contractclient, contracttype, Address, Env, Vec};

#[contractclient(name = "DeFindexVaultClient")]
pub trait DeFindexVault {
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> (Vec<i128>, i128, i128);
    
    fn withdraw(
        env: Env,
        withdraw_shares: i128,
        amounts_min: Vec<i128>,
        from: Address,
    ) -> Vec<i128>;
    
    fn total_supply(env: Env) -> i128;
    
    fn fetch_total_managed_funds(env: Env) -> Vec<AssetInvestmentAllocation>;
}

#[contracttype]
#[derive(Clone)]
pub struct AssetInvestmentAllocation {
    pub asset: Address,
    pub total_amount: i128,
}
