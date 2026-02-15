import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { AnchorVault } from '../target/types/anchor_vault';
import { expect } from 'chai';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

describe('anchor-vault', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Derive PDAs
  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('state'), wallet.publicKey.toBuffer()],
    program.programId,
  );

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), wallet.publicKey.toBuffer()],
    program.programId,
  );

  describe('Initialize', () => {
    it('Successfully initializes the vault state', async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          signer: wallet.publicKey,
        })
        .rpc();

      console.log('Initialize transaction signature:', tx);

      // Verify the vault state account was created
      const vaultStateAccount = await program.account.vaultState.fetch(
        vaultStatePda,
      );
      expect(vaultStateAccount.bump).to.be.a('number');
    });

    it('Fails to initialize twice', async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('already in use');
      }
    });
  });

  describe('Deposit', () => {
    it('Successfully deposits funds into the vault', async () => {
      const depositAmount = 1 * LAMPORTS_PER_SOL;

      // Get initial balances
      const initialSignerBalance = await connection.getBalance(
        wallet.publicKey,
      );
      const initialVaultBalance = await connection.getBalance(vaultPda);

      const tx = await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
          signer: wallet.publicKey,
        })
        .rpc();

      console.log('Deposit transaction signature:', tx);

      // Verify balances changed correctly
      const finalSignerBalance = await connection.getBalance(wallet.publicKey);
      const finalVaultBalance = await connection.getBalance(vaultPda);

      expect(finalVaultBalance).to.equal(initialVaultBalance + depositAmount);
      expect(finalSignerBalance).to.be.lessThan(
        initialSignerBalance - depositAmount,
      );
    });

    it('Fails to deposit when vault already has funds', async () => {
      const depositAmount = 0.5 * LAMPORTS_PER_SOL;

      try {
        await program.methods
          .deposit(new anchor.BN(depositAmount))
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('VaultAlreadyExists');
      }
    });

    it('Fails to deposit with insufficient amount', async () => {
      // First withdraw to clear the vault for this test
      const vaultBalance = await connection.getBalance(vaultPda);
      if (vaultBalance > 0) {
        await program.methods
          .withdraw(new anchor.BN(vaultBalance))
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
      }

      const tinyAmount = 100; // Very small amount below rent-exempt minimum

      try {
        await program.methods
          .deposit(new anchor.BN(tinyAmount))
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('InvalidAmount');
      }
    });
  });

  describe('Withdraw', () => {
    before(async () => {
      // Ensure there are funds in the vault
      const vaultBalance = await connection.getBalance(vaultPda);
      if (vaultBalance === 0) {
        await program.methods
          .deposit(new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
      }
    });

    it('Successfully withdraws all funds from the vault', async () => {
      // Get initial balances
      const initialSignerBalance = await connection.getBalance(
        wallet.publicKey,
      );
      const initialVaultBalance = await connection.getBalance(vaultPda);

      expect(initialVaultBalance).to.be.greaterThan(0);

      const tx = await program.methods
        .withdraw(new anchor.BN(initialVaultBalance))
        .accounts({
          signer: wallet.publicKey,
        })
        .rpc();

      console.log('Withdraw transaction signature:', tx);

      // Verify balances changed correctly
      const finalSignerBalance = await connection.getBalance(wallet.publicKey);
      const finalVaultBalance = await connection.getBalance(vaultPda);

      expect(finalVaultBalance).to.equal(0);
      expect(finalSignerBalance).to.be.greaterThan(initialSignerBalance);
    });

    it('Successfully withdraws partial funds (0.5 SOL)', async () => {
       // Deposit 1 SOL first to ensure enough funds
       await program.methods
         .deposit(new anchor.BN(1 * LAMPORTS_PER_SOL))
         .accounts({
           signer: wallet.publicKey,
         })
         .rpc();

       const initialVaultBalance = await connection.getBalance(vaultPda);
       const withdrawAmount = 0.5 * LAMPORTS_PER_SOL;

       await program.methods
         .withdraw(new anchor.BN(withdrawAmount))
         .accounts({
           signer: wallet.publicKey,
         })
         .rpc();

       const finalVaultBalance = await connection.getBalance(vaultPda);
       expect(finalVaultBalance).to.equal(initialVaultBalance - withdrawAmount);
    });

    it('Fails to withdraw from empty vault', async () => {
      try {
        await program.methods
          .withdraw(new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accounts({
            signer: wallet.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('InsufficientAmount');
      }
    });
  });


  describe('Close', () => {
    let testUser: anchor.web3.Keypair;
    let testVaultStatePda: PublicKey;
    let testVaultPda: PublicKey;

    beforeEach(async () => {
      testUser = anchor.web3.Keypair.generate();

      const signature = await connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(signature);

      [testVaultStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('state'), testUser.publicKey.toBuffer()],
        program.programId,
      );

      [testVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), testUser.publicKey.toBuffer()],
        program.programId,
      );

      await program.methods
        .initialize()
        .accounts({
          signer: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();
    });


    
    it('Successfully closes the vault even when not empty', async () => {
      // Re-initialize for this test since previous test closed it
      // Wait, we generate a fresh user in beforeEach, so we just run logic
      // Deposit funds
      const depositAmount = 1 * LAMPORTS_PER_SOL;
      await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
           signer: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();

      const initialVaultBalance = await connection.getBalance(testVaultPda);
      expect(initialVaultBalance).to.equal(depositAmount);

      const initialSignerBalance = await connection.getBalance(testUser.publicKey);

      // Close without withdrawing
      const tx = await program.methods
        .close()
        .accounts({
          signer: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();
        
      console.log('Close non-empty vault transaction signature:', tx);

      // Verify the vault state account was closed
      try {
        await program.account.vaultState.fetch(testVaultStatePda);
        expect.fail('Account should be closed');
      } catch (error) {
        expect(error.message).to.include('Account does not exist');
      }

      // Verify signer received funds back (deposit + rent)
      const finalSignerBalance = await connection.getBalance(testUser.publicKey);
      expect(finalSignerBalance).to.be.greaterThan(initialSignerBalance);
    });

    it('Successfully closes the vault when empty', async () => {
      // Vault is already empty from initialization
      const initialSignerBalance = await connection.getBalance(testUser.publicKey);

      const tx = await program.methods
        .close()
        .accounts({
          signer: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();

      console.log('Close transaction signature:', tx);

      // Verify the vault state account was closed
      try {
        await program.account.vaultState.fetch(testVaultStatePda);
        expect.fail('Account should be closed');
      } catch (error) {
        expect(error.message).to.include('Account does not exist');
      }

      // Verify signer received rent back
      const finalSignerBalance = await connection.getBalance(testUser.publicKey);
      expect(finalSignerBalance).to.be.greaterThan(initialSignerBalance);
    });
  });

  describe('Full Lifecycle', () => {
    let newKeypair: anchor.web3.Keypair;
    let newVaultStatePda: PublicKey;
    let newVaultPda: PublicKey;

    before(async () => {
      // Create a new keypair for this test
      newKeypair = anchor.web3.Keypair.generate();

      // Airdrop some SOL to the new keypair
      const signature = await connection.requestAirdrop(
        newKeypair.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(signature);

      // Derive PDAs for new keypair
      [newVaultStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('state'), newKeypair.publicKey.toBuffer()],
        program.programId,
      );

      [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), newKeypair.publicKey.toBuffer()],
        program.programId,
      );
    });

    it('Completes full lifecycle: initialize -> deposit -> withdraw -> close', async () => {
      // 1. Initialize
      await program.methods
        .initialize()
        .accounts({
          signer: newKeypair.publicKey,
        })
        .signers([newKeypair])
        .rpc();

      console.log('✓ Initialized vault');

      // 2. Deposit
      const depositAmount = 1 * LAMPORTS_PER_SOL;
      await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
          signer: newKeypair.publicKey,
        })
        .signers([newKeypair])
        .rpc();

      const vaultBalance = await connection.getBalance(newVaultPda);
      expect(vaultBalance).to.equal(depositAmount);
      console.log('✓ Deposited funds');

      // 3. Withdraw
      await program.methods
        .withdraw(new anchor.BN(depositAmount))
        .accounts({
          signer: newKeypair.publicKey,
        })
        .signers([newKeypair])
        .rpc();

      const vaultBalanceAfterWithdraw = await connection.getBalance(
        newVaultPda,
      );
      expect(vaultBalanceAfterWithdraw).to.equal(0);
      console.log('✓ Withdrew funds');

      // 4. Close
      await program.methods
        .close()
        .accounts({
          signer: newKeypair.publicKey,
        })
        .signers([newKeypair])
        .rpc();

      console.log('✓ Closed vault');

      // Verify closure
      try {
        await program.account.vaultState.fetch(newVaultStatePda);
        expect.fail('Account should be closed');
      } catch (error) {
        expect(error.message).to.include('Account does not exist');
      }
    });
  });
});
