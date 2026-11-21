#!/usr/bin/env python3
"""
NetNet Liquidity Vaults: deterministic backtest SIMULATOR.
EVERYTHING HERE IS SIMULATED: seeded synthetic price paths and made-up fee assumptions.
Not real market data, not a forecast, not an APY claim.

Strategies compared per path:
  HOLD       keep the initial 50/50 tokens, do nothing
  NAIVE      concentrated range around price; when out of range, withdraw, SWAP back to
             the ratio the new centred range needs (pays swap fee + slippage), re-centre
  ZERO-SWAP  concentrated range; when out of range the vault holds only one token, so it
             opens a new one-sided range right next to the current price using only that
             token (no swap). If price comes back, the pool itself converts the tokens back.
Uniswap-V3-style math: x = base token, y = USDG (quote), price p = USDG per base.
"""
import math, random, json, sys

STEPS_PER_DAY = 24
DAYS = 180
PERF_FEE = 0.10                     # 10% of earned LP fees only
SPLIT = {"treasury": 0.05, "net_liquidity_layer": 0.03, "builders_fund_vested": 0.02}

POOLS = {
    # vol = annualised volatility of the simulated path; base_fee_apr = ASSUMED fee yield earned by
    # in-range liquidity at the vault's own range width (made-up assumption); width = range half-width;
    # other_active_tvl = ASSUMED competing in-range liquidity (used to dilute fees at larger TVL)
    "NET/USDG":  dict(vol=0.90, base_fee_apr=0.25, width=0.40, swap_cost=0.010 + 0.006, other_active_tvl=2_000_000),
    "NVDA/USDG": dict(vol=0.40, base_fee_apr=0.08, width=0.15, swap_cost=0.0005 + 0.002, other_active_tvl=5_000_000),
}
REGIMES = ["random_walk", "mean_revert", "trend_up", "trend_down"]
KEEPER_GAS_USD = 0.05               # per rebalance tx, assumed

def path(seed, vol, regime, p0=100.0):
    r = random.Random(seed)
    dt = 1 / (365 * STEPS_PER_DAY)
    p, out, anchor = p0, [p0], p0
    mu = {"trend_up": 1.0, "trend_down": -0.8}.get(regime, 0.0)
    for _ in range(DAYS * STEPS_PER_DAY):
        z = r.gauss(0, 1)
        drift = mu
        if regime == "mean_revert":
            drift = -12.0 * math.log(p / anchor)          # pulls back toward the anchor
        p *= math.exp((drift - 0.5 * vol * vol) * dt + vol * math.sqrt(dt) * z)
        out.append(p)
    return out

# ---- concentrated liquidity helpers
def amounts(L, p, a, b):
    sp, sa, sb = math.sqrt(p), math.sqrt(a), math.sqrt(b)
    if p <= a: return L * (1 / sa - 1 / sb), 0.0
    if p >= b: return 0.0, L * (sb - sa)
    return L * (1 / sp - 1 / sb), L * (sp - sa)

def liquidity_for(x, y, p, a, b):
    """Max liquidity mintable from amounts x,y; returns (L, used_x, used_y)."""
    sp, sa, sb = math.sqrt(p), math.sqrt(a), math.sqrt(b)
    if p <= a: L = x / (1 / sa - 1 / sb)
    elif p >= b: L = y / (sb - sa)
    else:
        Lx = x / (1 / sp - 1 / sb) if x > 0 else 0.0
        Ly = y / (sp - sa) if y > 0 else 0.0
        L = min(Lx, Ly)
    ux, uy = amounts(L, p, a, b)
    return L, ux, uy

def fee_step(L, p, a, b, base_fee_apr):
    """Fees for one step if in range: proportional to liquidity L. Calibrated so a centred
    +/-width position earns base_fee_apr on its value (rough stand-in for the share of pool fees
    competing concentrated LPs earn). One-sided ranges hold more L per dollar, so earn somewhat more."""
    if not (a < p < b): return 0.0
    return L * K[0] * math.sqrt(p) * base_fee_apr / (365 * STEPS_PER_DAY)

K = [1.0]
def calibrate(w):
    p = 1.0; a, b = p / (1 + w), p * (1 + w)
    x, y = amounts(1.0, p, a, b)
    K[0] = (x * p + y) / 1.0   # value per unit L at p=1, scales with sqrt(p)

def run(prices, cfg, mode):
    w, fee_apr = cfg["width"], cfg["base_fee_apr"]; calibrate(w)
    p0, V0 = prices[0], 10_000.0
    x, y = V0 / 2 / p0, V0 / 2                        # start 50/50 by value
    if mode == "hold":
        return dict(final=x * prices[-1] + y, fees=0.0, rebalances=0, cost=0.0, in_range=0.0)
    a, b = p0 / (1 + w), p0 * (1 + w)
    L, ux, uy = liquidity_for(x, y, p0, a, b)
    ix, iy = x - ux, y - uy                           # idle leftovers stay in the vault
    fees = cost = 0.0; reb = 0; inr = 0
    for p in prices[1:]:
        f = fee_step(L, p, a, b, fee_apr)
        if f: inr += 1
        fees += f; iy += f                            # fees accrue in USDG (auto-compounded at next rebalance)
        if a < p < b: continue
        # ---- out of range: rebalance
        px, py = amounts(L, p, a, b)
        x, y = px + ix, py + iy
        reb += 1; cost += KEEPER_GAS_USD; y -= KEEPER_GAS_USD
        if mode == "naive":
            a, b = p / (1 + w), p * (1 + w)
            ux1, uy1 = amounts(1.0, p, a, b)
            ratio = ux1 * p / (ux1 * p + uy1)         # value share the new range needs in base
            V = x * p + y; target_x = V * ratio / p
            dv = abs(target_x - x) * p                # value that must be swapped
            c = dv * cfg["swap_cost"]; cost += c
            x, y = target_x, V - target_x * p - c
        else:  # zero-swap: one-sided range adjacent to price, built from what we hold
            if x * p >= y:   # mostly base: price fell through the range -> sell-side range above price
                a, b = p * 1.0001, p * (1 + w) * 1.0001
            else:            # mostly USDG: price rose through the range -> buy-side range below price
                a, b = p / (1 + w) / 1.0001, p / 1.0001
        L, ux, uy = liquidity_for(x, y, p, a, b)
        ix, iy = x - ux, y - uy
    px, py = amounts(L, prices[-1], a, b)
    final = (px + ix) * prices[-1] + py + iy
    return dict(final=final, fees=fees, rebalances=reb, cost=cost, in_range=inr / (len(prices) - 1))

def main():
    rows = []
    for pool, cfg in POOLS.items():
        for k, regime in enumerate(REGIMES):
            seed = 4663 + 101 * k + (0 if pool.startswith("NET") else 7)
            pr = path(seed, cfg["vol"], regime)
            res = {m: run(pr, cfg, m) for m in ("hold", "naive", "zero_swap")}
            rows.append((pool, regime, pr[-1] / pr[0] - 1, res))
    print("NETNET LIQUIDITY VAULTS · BACKTEST SIMULATION (synthetic seeded paths, assumed fee yields)")
    print(f"{DAYS} days, hourly steps, $10,000 start, 50/50. Values before the 10% performance fee.\n")
    hdr = f"{'pool':10} {'regime':12} {'price':>7} | {'HOLD':>8} | {'NAIVE':>8} {'fees':>7} {'cost':>7} {'reb':>4} | {'ZERO-SWAP':>9} {'fees':>7} {'cost':>6} {'reb':>4} {'inRng':>5}"
    print(hdr); print("-" * len(hdr))
    out = []
    for pool, regime, chg, r in rows:
        h, n, z = r["hold"], r["naive"], r["zero_swap"]
        print(f"{pool:10} {regime:12} {chg*100:+6.1f}% | {h['final']:8.0f} | {n['final']:8.0f} {n['fees']:7.0f} {n['cost']:7.0f} {n['rebalances']:4d} | {z['final']:9.0f} {z['fees']:7.0f} {z['cost']:6.1f} {z['rebalances']:4d} {z['in_range']*100:4.0f}%")
        out.append(dict(pool=pool, regime=regime, price_change=chg, **{m: r[m] for m in r}))
    # treasury revenue at example TVL, from zero-swap fees (annualised, averaged over regimes)
    print("\nFEE SPLIT AT EXAMPLE TVL (zero-swap fee yield, annualised, avg of 4 regimes; diluted by")
    print("assumed competing liquidity: pool fees are fixed by volume, the vault only earns its share)")
    for pool in POOLS:
        f = [o["zero_swap"]["fees"] for o in out if o["pool"] == pool]
        fee_yield = sum(f) / len(f) / 10_000 * 365 / DAYS
        for tvl in (1_000_000, 10_000_000):
            other = POOLS[pool]["other_active_tvl"]
            lp_fees = fee_yield * other * tvl / (tvl + other)   # vault share of a fixed fee pie
            perf = lp_fees * PERF_FEE
            parts = ", ".join(f"{k} ${lp_fees*v:,.0f}" for k, v in SPLIT.items())
            print(f"  {pool:10} TVL ${tvl:>11,}: LP fees ${lp_fees:,.0f}/yr (sim fee yield {fee_yield*100:.1f}%) (diluted) -> 10% perf fee ${perf:,.0f}: {parts}")
    print("\nRANGE-WIDTH SENSITIVITY (avg final value of 4 regimes, $10,000 start; HOLD avg shown)")
    for pool, cfg in POOLS.items():
        prs = [path(4663 + 101 * k + (0 if pool.startswith("NET") else 7), cfg["vol"], rg) for k, rg in enumerate(REGIMES)]
        hold = sum(run(p, cfg, "hold")["final"] for p in prs) / 4
        line = []
        for w in (0.05, 0.10, 0.20, 0.40, 0.80):
            c = dict(cfg, width=w)
            n = sum(run(p, c, "naive")["final"] for p in prs) / 4
            z = sum(run(p, c, "zero_swap")["final"] for p in prs) / 4
            line.append(f"+/-{int(w*100)}%: naive {n:,.0f} / zero {z:,.0f}")
        print(f"  {pool:10} HOLD {hold:,.0f} | " + " | ".join(line))
    json.dump(out, open("sim_results.json", "w"), indent=1, default=float)

if __name__ == "__main__":
    main()
