# Anchor Vault Program

This is a Solana Vault program built with the Anchor framework. It allows users to initialize a vault with a time lock, deposit SOL, withdraw SOL, and close the vault safely.

## Project Structure

- **programs/anchor-vault**: The Solana program logic.
- **tests/anchor-vault.ts**: Integration tests for the program.
- **assets/**: Screenshots and other assets.

## Instructions Implemented

The program supports the following instructions:

1.  **Initialize**: Sets up the vault account.
2.  **Deposit**: Allows a user to deposit SOL into the vault.
3.  **Withdraw**: Allows a user to withdraw a specified amount of SOL from the vault.
4.  **Close**: Safely closes the vault account, transferring any remaining balance and rent back to the user.

## Features

- **Partial Withdrawals**: Users can withdraw any amount up to their total balance.
- **Safe Close**: The `close` instruction automatically transfers all remaining funds to the signer before closing the account, preventing accidental loss of funds.

## Testing
## Testing

The program has been thoroughly tested using the Anchor test framework.

### Test Results

![Tests Passing](./assets/anchor-vault-tests.png)

To run the tests yourself:

```bash
anchor test
```

## Deployment

Program ID: `68BPmfA8aQEMcFFNU2x1VEXEg3xB46jpGevuwcT2dt2S`

