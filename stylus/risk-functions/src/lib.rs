//! Fixed-point 1e18 math primitives and core risk functions for NORN protocol.

pub const WAD: u128 = 1_000_000_000_000_000_000;
pub const BPS_SCALE: u128 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RiskRegime {
    Normal,
    Constrained,
    Defensive,
    Frozen,
}

impl RiskRegime {
    pub const NORMAL: Self = Self::Normal;
    pub const CONSTRAINED: Self = Self::Constrained;
    pub const DEFENSIVE: Self = Self::Defensive;
    pub const FROZEN: Self = Self::Frozen;

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Normal => "NORMAL",
            Self::Constrained => "CONSTRAINED",
            Self::Defensive => "DEFENSIVE",
            Self::Frozen => "FROZEN",
        }
    }

    pub fn is_settlement_permitted(&self, priority: u8) -> bool {
        match self {
            Self::Frozen => false,
            Self::Defensive => priority == 0,
            Self::Constrained => priority <= 1,
            Self::Normal => true,
        }
    }

    pub fn required_reserve_bps(&self) -> u32 {
        match self {
            Self::Normal => 1000,      // 10%
            Self::Constrained => 2500, // 25%
            Self::Defensive => 5000,   // 50%
            Self::Frozen => 10000,     // 100%
        }
    }
}

/// Multiplies two 128-bit unsigned integers into a 256-bit result (hi, lo).
#[inline]
pub fn mul_wide_u128(a: u128, b: u128) -> (u128, u128) {
    let a_lo = a as u64 as u128;
    let a_hi = (a >> 64) as u64 as u128;
    let b_lo = b as u64 as u128;
    let b_hi = (b >> 64) as u64 as u128;

    let p00 = a_lo * b_lo;
    let p01 = a_lo * b_hi;
    let p10 = a_hi * b_lo;
    let p11 = a_hi * b_hi;

    let carry1 = p00 >> 64;
    let mid1 = carry1 + (p01 as u64 as u128) + (p10 as u64 as u128);
    let low_64 = p00 as u64 as u128;
    let mid_64 = (mid1 as u64 as u128) << 64;

    let lo = mid_64 | low_64;
    let carry2 = mid1 >> 64;
    let hi = p11 + (p01 >> 64) + (p10 >> 64) + carry2;

    (hi, lo)
}

/// Divides a 256-bit unsigned integer (hi, lo) by a 128-bit divisor.
/// Returns None if d == 0 or if the quotient exceeds u128::MAX (hi >= d).
pub fn div_wide_u128(hi: u128, lo: u128, d: u128) -> Option<u128> {
    if d == 0 {
        return None;
    }
    if hi >= d {
        return None;
    }
    if hi == 0 {
        return Some(lo / d);
    }

    let mut rem = hi;
    let mut quot = 0u128;
    for i in (0..128).rev() {
        let bit = (lo >> i) & 1;
        let carry = (rem >> 127) != 0;
        rem = (rem << 1) | bit;
        if carry || rem >= d {
            rem = rem.wrapping_sub(d);
            quot |= 1 << i;
        }
    }
    Some(quot)
}

/// Multiplies two u128 numbers and divides by divisor d with 256-bit intermediate precision.
pub fn mul_div_u128(a: u128, b: u128, d: u128) -> Option<u128> {
    if d == 0 {
        return None;
    }
    if a == 0 || b == 0 {
        return Some(0);
    }
    let (hi, lo) = mul_wide_u128(a, b);
    div_wide_u128(hi, lo, d)
}

/// Multiplies two 1e18 fixed-point numbers: (a * b) / 1e18.
pub fn checked_wad_mul(a: u128, b: u128) -> Option<u128> {
    mul_div_u128(a, b, WAD)
}

/// Multiplies two 1e18 fixed-point numbers, panicking on overflow.
pub fn wad_mul(a: u128, b: u128) -> u128 {
    checked_wad_mul(a, b).expect("wad_mul overflow")
}

/// Divides two 1e18 fixed-point numbers: (a * 1e18) / b.
pub fn checked_wad_div(a: u128, b: u128) -> Option<u128> {
    if b == 0 {
        return None;
    }
    mul_div_u128(a, WAD, b)
}

/// Divides two 1e18 fixed-point numbers. Returns 0 if denominator is 0.
pub fn wad_div(a: u128, b: u128) -> u128 {
    if b == 0 {
        return 0;
    }
    checked_wad_div(a, b).unwrap_or(u128::MAX)
}

/// Converts basis points (10000 = 100%) to 1e18 fixed point.
pub fn bps_to_wad(bps: u32) -> u128 {
    (bps as u128) * (WAD / BPS_SCALE)
}

/// Converts 1e18 fixed point to basis points.
pub fn wad_to_bps(wad: u128) -> u32 {
    let bps = (wad * BPS_SCALE) / WAD;
    bps as u32
}

/// Calculates reserve ratio in 1e18 fixed-point precision: (reserved * 1e18) / deposited.
/// Safely returns 0 if deposited is zero.
pub fn calculate_reserve_ratio(deposited: u128, reserved: u128) -> u128 {
    if deposited == 0 {
        return 0;
    }
    mul_div_u128(reserved, WAD, deposited).unwrap_or(u128::MAX)
}

/// Calculates liquidity shortfall when net debit obligations exceed available liquidity.
/// Returns net_debit - available_liquidity if debit > available, otherwise 0.
pub fn calculate_shortfall(net_debit: u128, available_liquidity: u128) -> u128 {
    net_debit.saturating_sub(available_liquidity)
}

/// Calculates post-settlement reserve shortfall under a mandatory reserve threshold.
pub fn calculate_post_settlement_shortfall(
    available_liquidity: u128,
    net_debit: u128,
    required_reserve: u128,
) -> u128 {
    if net_debit > available_liquidity {
        (net_debit - available_liquidity).saturating_add(required_reserve)
    } else {
        let remaining = available_liquidity - net_debit;
        required_reserve.saturating_sub(remaining)
    }
}

/// Determines the risk regime from the reserve ratio in WAD precision:
/// - NORMAL: >= 30% (0.30 * 1e18)
/// - CONSTRAINED: 20% to 30% (0.20 to 0.30 * 1e18)
/// - DEFENSIVE: 10% to 20% (0.10 to 0.20 * 1e18)
/// - FROZEN: < 10% (0.10 * 1e18)
pub fn determine_regime(reserve_ratio_wad: u128) -> RiskRegime {
    const THIRTY_PERCENT: u128 = 300_000_000_000_000_000;
    const TWENTY_PERCENT: u128 = 200_000_000_000_000_000;
    const TEN_PERCENT: u128 = 100_000_000_000_000_000;

    if reserve_ratio_wad >= THIRTY_PERCENT {
        RiskRegime::Normal
    } else if reserve_ratio_wad >= TWENTY_PERCENT {
        RiskRegime::Constrained
    } else if reserve_ratio_wad >= TEN_PERCENT {
        RiskRegime::Defensive
    } else {
        RiskRegime::Frozen
    }
}

/// Applies haircut discount in basis points (10000 bps = 100% haircut).
/// Value remaining after haircut = amount * (10000 - haircut_bps) / 10000.
/// Overflow safe for all u128 amounts up to u128::MAX.
pub fn apply_haircut(amount: u128, haircut_bps: u32) -> u128 {
    if haircut_bps >= 10_000 {
        return 0;
    }
    let factor = (10_000 - haircut_bps) as u128;
    let q = amount / 10_000;
    let r = amount % 10_000;
    q * factor + (r * factor) / 10_000
}

/// Sums an array of u128 values into a 256-bit accumulator (hi, lo) to prevent overflow.
fn sum_wide(slice: &[u128]) -> (u128, u128) {
    let mut hi: u128 = 0;
    let mut lo: u128 = 0;
    for &val in slice {
        let (new_lo, carry) = lo.overflowing_add(val);
        lo = new_lo;
        if carry {
            hi = hi.checked_add(1).expect("Sum exceeded 256-bit range");
        }
    }
    (hi, lo)
}

/// Verifies network conservation: total credits must equal total debits.
/// Overflow safe via 256-bit accumulator.
pub fn verify_conservation(credits: &[u128], debits: &[u128]) -> bool {
    sum_wide(credits) == sum_wide(debits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wad_math_basic() {
        assert_eq!(wad_mul(WAD, WAD), WAD);
        assert_eq!(wad_mul(2 * WAD, 3 * WAD), 6 * WAD);
        assert_eq!(wad_div(6 * WAD, 2 * WAD), 3 * WAD);
        assert_eq!(wad_div(WAD, 2 * WAD), WAD / 2);
        assert_eq!(bps_to_wad(2500), 250_000_000_000_000_000);
        assert_eq!(wad_to_bps(250_000_000_000_000_000), 2500);
    }

    #[test]
    fn test_zero_denominators() {
        assert_eq!(calculate_reserve_ratio(0, 100), 0);
        assert_eq!(calculate_reserve_ratio(0, 0), 0);
        assert_eq!(wad_div(100, 0), 0);
        assert_eq!(checked_wad_div(100, 0), None);
        assert_eq!(mul_div_u128(100, 200, 0), None);
    }

    #[test]
    fn test_boundary_regimes() {
        let thirty_pct = 300_000_000_000_000_000;
        let twenty_pct = 200_000_000_000_000_000;
        let ten_pct = 100_000_000_000_000_000;

        assert_eq!(determine_regime(thirty_pct), RiskRegime::Normal);
        assert_eq!(determine_regime(thirty_pct + 1), RiskRegime::Normal);
        assert_eq!(determine_regime(thirty_pct - 1), RiskRegime::Constrained);

        assert_eq!(determine_regime(twenty_pct), RiskRegime::Constrained);
        assert_eq!(determine_regime(twenty_pct + 1), RiskRegime::Constrained);
        assert_eq!(determine_regime(twenty_pct - 1), RiskRegime::Defensive);

        assert_eq!(determine_regime(ten_pct), RiskRegime::Defensive);
        assert_eq!(determine_regime(ten_pct + 1), RiskRegime::Defensive);
        assert_eq!(determine_regime(ten_pct - 1), RiskRegime::Frozen);

        assert_eq!(determine_regime(0), RiskRegime::Frozen);
    }

    #[test]
    fn test_shortfall_calculation() {
        assert_eq!(calculate_shortfall(1000, 400), 600);
        assert_eq!(calculate_shortfall(400, 1000), 0);
        assert_eq!(calculate_shortfall(500, 500), 0);
        assert_eq!(calculate_shortfall(0, 100), 0);
        assert_eq!(calculate_shortfall(100, 0), 100);

        assert_eq!(calculate_post_settlement_shortfall(100, 60, 50), 10);
        assert_eq!(calculate_post_settlement_shortfall(100, 40, 50), 0);
        assert_eq!(calculate_post_settlement_shortfall(50, 80, 20), 50);
    }

    #[test]
    fn test_apply_haircut() {
        assert_eq!(apply_haircut(20_000, 2000), 16_000);
        assert_eq!(apply_haircut(1_000_000, 0), 1_000_000);
        assert_eq!(apply_haircut(1_000_000, 10_000), 0);
        assert_eq!(apply_haircut(1_000_000, 15_000), 0);

        let max_val = u128::MAX;
        let halved = apply_haircut(max_val, 5000);
        assert!(halved < max_val);
        assert_eq!(apply_haircut(max_val, 0), max_val);
    }

    #[test]
    fn test_conservation_verification() {
        let credits = [100, 250, 350, 500];
        let debits = [400, 300, 500];
        assert!(verify_conservation(&credits, &debits));

        let debits_mismatched = [400, 300, 501];
        assert!(!verify_conservation(&credits, &debits_mismatched));

        assert!(verify_conservation(&[], &[]));
        assert!(!verify_conservation(&[10], &[]));

        let large_credits = [u128::MAX, 100];
        let large_debits = [100, u128::MAX];
        assert!(verify_conservation(&large_credits, &large_debits));
    }

    #[test]
    fn test_overflow_safety() {
        let large_a = u128::MAX / 2;
        let large_b = 2 * WAD;
        let result = wad_mul(large_a, large_b);
        assert_eq!(result, large_a * 2);

        let ratio = calculate_reserve_ratio(u128::MAX, u128::MAX / 2);
        assert_eq!(ratio, (WAD / 2) - 1);
        let exact_half = calculate_reserve_ratio(1_000_000_000 * WAD, 500_000_000 * WAD);
        assert_eq!(exact_half, WAD / 2);
    }

    #[test]
    fn test_checked_wad_mul_overflow() {
        let max_val = u128::MAX;
        let overflow_mul = checked_wad_mul(max_val, 2 * WAD);
        assert_eq!(overflow_mul, None);
    }

    #[test]
    fn test_reserve_ratio_edge_cases() {
        // Reserved > deposited (over-collateralized / high reserve)
        let ratio = calculate_reserve_ratio(100 * WAD, 150 * WAD);
        assert_eq!(ratio, (3 * WAD) / 2);

        // Zero reserved with non-zero deposited
        let zero_reserved = calculate_reserve_ratio(100 * WAD, 0);
        assert_eq!(zero_reserved, 0);
    }

    #[test]
    fn test_regime_properties_and_permissions() {
        assert_eq!(RiskRegime::Normal.as_str(), "NORMAL");
        assert_eq!(RiskRegime::Constrained.as_str(), "CONSTRAINED");
        assert_eq!(RiskRegime::Defensive.as_str(), "DEFENSIVE");
        assert_eq!(RiskRegime::Frozen.as_str(), "FROZEN");

        assert_eq!(RiskRegime::Normal.required_reserve_bps(), 1000);
        assert_eq!(RiskRegime::Constrained.required_reserve_bps(), 2500);
        assert_eq!(RiskRegime::Defensive.required_reserve_bps(), 5000);
        assert_eq!(RiskRegime::Frozen.required_reserve_bps(), 10000);

        // Permissions by priority (0=Critical, 1=High, 2=Normal, 3=Nettable, 4=Deferred)
        for prio in 0..=4 {
            assert!(RiskRegime::Normal.is_settlement_permitted(prio));
        }

        assert!(RiskRegime::Constrained.is_settlement_permitted(0));
        assert!(RiskRegime::Constrained.is_settlement_permitted(1));
        assert!(!RiskRegime::Constrained.is_settlement_permitted(2));
        assert!(!RiskRegime::Constrained.is_settlement_permitted(3));

        assert!(RiskRegime::Defensive.is_settlement_permitted(0));
        assert!(!RiskRegime::Defensive.is_settlement_permitted(1));

        for prio in 0..=4 {
            assert!(!RiskRegime::Frozen.is_settlement_permitted(prio));
        }
    }
}
