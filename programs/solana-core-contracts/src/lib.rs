use anchor_lang::prelude::*;

declare_id!("8yavd91U7kY5bZQNYgYf1jj42GSYTLnDsRq8ZH2aaRY1");

#[program]
pub mod solana_core_contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
