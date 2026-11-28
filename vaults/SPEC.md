# NetNet Liquidity Vaults: SPEC (draft v0.1, 17 Oct 2026)

> Prototype design for the NetNet community & devs. **Nothing is deployed and nothing is live onchain.** Every number in this repo and on the dashboard is **SIMULATED**.
> Inspired by the category MaxFi (maxfi.tech) works in. This is not a partnership, and no MaxFi code, branding or text is used.

## 1. What it is
These are automated concentrated-liquidity vaults on Robinhood Chain (chain 4663). A user deposits tokens into one vault per pool. A keeper keeps the position in range. The vault takes a performance fee **only on LP fees earned** and pays it out in this order: **treasury, NET liquidity layer, builders & ops fund (vested)**.

Launch pools:
1. **NET/USDG** first. It feeds the NET liquidity layer and gives NET holders a native yield product.
2. **RWA stock/USDG** pools (for example NVDA/USDG, QQQ/USDG, GLD/USDG). These fit the RWA thesis and work like an "arcade cabinet" for the tokenized-stock flywheel.

## 2. Architecture
- **One vault contract per pool.** This isolates risk: one bad pool cannot drain another.
- **ERC-4626-style shares.** `deposit`, `mint`, `withdraw`, `redeem` and `previewX` follow the standard. The vault holds two assets, so share price is based on total value in USDG at a TWAP-checked pool price. Deposits revert if spot and TWAP diverge more than X bps, which defends against sandwich and donation attacks. The first-depositor inflation attack is blocked with seeded dead shares.
- **Position manager.** Holds the Uniswap-V3-style NFT position or positions, plus idle balances.
- **Keeper.** A permissionless `rebalance()` that only succeeds when on-chain conditions hold: price out of range, a cooldown has passed, and TWAP sanity checks pass. The keeper cannot choose a range. The contract derives the range from parameters set by governance. A keeper tip is paid from the vault, with a cap.
- **Zero-swap rebalance (our own words).** When price leaves the range, the position has already turned fully into one token. Instead of swapping back to 50/50, which costs swap fees and slippage and invites MEV, the vault opens a new **one-sided range starting right at the current price**, built from the token it already holds. If price comes back, the pool itself converts the tokens back while earning fees. A **naive swap-rebalance** mode is kept only as an emergency or governance fallback.
- **High-water mark on fees only.** The fee is charged on cumulative LP fees collected (`feesAccrued - feesAlreadyCharged`), never on principal or price gains. No fee is taken on impermanent loss or token-price moves.
- **Emergency pause** (guardian multisig): pauses deposits and rebalances. **Withdrawals can never be paused.** Users can always exit pro-rata in kind.
- **Per-vault TVL caps** plus a per-address cap during the beta.
- **Oracles.** Pool TWAP is used for all value checks. No external price feed is needed for core accounting.

## 3. Fees
| Fee | Rate | Destination |
|---|---|---|
| Performance fee (on LP fees earned only) | **10%** | split below |
| ↳ Treasury | 5% | NetNet USDG treasury, taken **first**, before any other payout |
| ↳ NET liquidity layer (POL) | 3% | protocol-owned NET/USDG liquidity |
| ↳ Builders & ops fund | 2% | **public onchain vesting contract** (for example a 12-month cliff and 36-month linear vest; address published, no admin withdraw) |
| Deposit / withdraw fee | 0% | n/a |

There is no management fee. The split is a constant enforced by the contract. Changes go through the timelock.

## 4. wsNET staker tiers (performance fee)
| Tier | wsNET held (snapshot-checked) | Perf fee |
|---|---|---|
| Base | 0 | 10% |
| Bronze | ≥ 1,000 | 7.5% |
| Silver | ≥ 10,000 | 5% |
| Gold | ≥ 50,000 | 0% on the first $25k deposited, then 5% |

The discount shrinks all three buckets proportionally, so the builders fund never earns more than the treasury share ratio. A balance is measured as the minimum held over the last N days, to stop flash-staking. Thresholds are placeholders (open question).

## 5. Security plan
1. Internal review, a fuzz/invariant suite (share accounting, withdraw-always-works, fee ≤ 10% of fees) and a testnet soak test.
2. **Two independent audits** before mainnet. Audit reports are published.
3. **Bug bounty tied to NetNet Prizes.** A standing "Break the Vault" prize, paid by the treasury in USDG, with a severity ladder and a disclosed max payout.
4. Caps: start at $50k per vault, ramp after 30 incident-free days.
5. Governance: Safe multisig (3/5 or more, with known signers) behind a **48h+ timelock** for every parameter change. The guardian can only pause and can only lower caps.
6. Immutable core where possible. No upgradeable proxy at launch, or one behind the timelock if it is unavoidable.
7. Monitoring and a public incident runbook.

## 6. Roadmap
1. **Testnet**: NET/USDG plus one stock pool, public dashboard, keeper bot, simulations replaced with testnet data.
2. **Capped mainnet beta**: audited, caps, bounty live, wsNET tiers.
3. **Scale**: more RWA pools, raised caps, optional strategy modules (range width chosen per volatility).

## 7. Simulation findings (see `sim.py` / `sim_results.txt`, SIMULATED)
- Concentrated LP **loses to just holding in most simulated paths** once impermanent loss is counted. Fees only win when a pool's real fee/volume yield is high relative to its volatility.
- **Range width matters more than the rebalance method.** In the NET-like pool (90% vol), ±5–10% ranges lost 70–95% of value. ±40% roughly broke even with holding.
- Zero-swap cuts rebalance costs by about 95% versus naive swap-rebalancing (for example $344 → $6 per $10k in an uptrend). It wins in mean-reverting markets. In strong trends it "chases" price with many small one-sided ranges and can end slightly worse than naive.
- Treasury revenue is modest and **diluted as TVL grows**, because pool fees are fixed by volume. With assumed inputs: at $1M TVL, about $10k/yr to the treasury (NET pool) or about $5k/yr (NVDA pool). At $10M, about $26k/yr or about $19k/yr.
- Implications: show no APY promises, use volatility-scaled wide ranges, and start with a cap.

## 8. Legal flags (MiCA / EU). Get counsel before mainnet.
- Offering vaults to EU users may count as a crypto-asset service (portfolio management, or reception/transmission of orders) under MiCA. That may require CASP authorisation or a fully non-custodial, decentralised setup.
- Tokenized stock pools may touch MiFID II (financial instruments), not only MiCA.
- The NET token's own MiCA status (white paper, ART/EMT questions) matters if NET is marketed together with the vaults.
- Fee flows to a team fund may raise marketing/inducement questions. Public vesting helps transparency but is not compliance.
- EU regulators have issued consumer warnings on yield products. Avoid "APY", "guaranteed", and so on. Consider geofencing.
- These vaults are investment products, **not games**. They are kept separate from the skill-game arcade cabinets.

## 9. DEX facts on chain 4663: NOT independently verified (open)
Third-party sources (the GitHub repo `nirholas/robinhood-toolkit` `dex/DEPLOYMENTS.md`, RobinScreener, Voxelithic) report the following. I could not confirm them against a public RPC. Treat all of them as **unverified**:
- Uniswap V3 factory `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`, SwapRouter02 `0xCaf681a66D020601342297493863E78C959E5cb2`, QuoterV2 `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7`
- Uniswap V4 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`. Many stock/USDG pools are reportedly on **V4** (GLD, QQQ, META, CRCL, MSTR…).
- USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals), WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Other reported venues: Ramses, Giga, Up, Alandale.

## 10. Open questions
1. Verify every address above from official Robinhood or Uniswap sources and an RPC.
2. Does a NET/USDG CL pool exist yet, and on V3 or V4? V4 hooks would change the architecture (it could even be a hook-native vault).
3. Real volume and fee data per pool, to replace the assumed fee yields.
4. Tier thresholds, builders-fund vesting terms, cap ramp schedule.
5. Keeper: our own bot, or Gelato/Chainlink-style automation on 4663?
6. Choice of auditors and bounty size.
7. MiCA/MiFID legal opinion and geofencing policy.
8. Name: "NetNet Liquidity Vaults", or shorter, "NET Range Vaults".
