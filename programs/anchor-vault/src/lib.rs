use anchor_lang::prelude::*;

declare_id!("68BPmfA8aQEMcFFNU2x1VEXEg3xB46jpGevuwcT2dt2S");

#[program]
pub mod anchor_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
