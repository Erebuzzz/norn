//! Numerical stress engine and cascade simulation for NORN participant networks.

use std::collections::BTreeMap;

pub use risk_functions::{
    apply_haircut, calculate_post_settlement_shortfall, calculate_reserve_ratio,
    calculate_shortfall, checked_wad_div, checked_wad_mul, determine_regime, div_wide_u128,
    mul_div_u128, mul_wide_u128, verify_conservation, wad_div, wad_mul, wad_to_bps,
    bps_to_wad, RiskRegime, BPS_SCALE, WAD,
};

pub type ParticipantId = [u8; 20];
pub type ObligationId = [u8; 32];
pub type AssetId = [u8; 20];

pub fn make_participant_id(byte: u8) -> ParticipantId {
    [byte; 20]
}

pub fn make_obligation_id(byte: u8) -> ObligationId {
    [byte; 32]
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum ObligationPriority {
    Critical = 0,
    High = 1,
    Normal = 2,
    Nettable = 3,
    Deferred = 4,
}

impl ObligationPriority {
    pub fn is_settlement_permitted(&self, regime: RiskRegime) -> bool {
        regime.is_settlement_permitted(*self as u8)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Participant {
    pub id: ParticipantId,
    pub initial_liquidity: u128,
    pub available_liquidity: u128,
    pub reserved_liquidity: u128,
    pub credit_limit: u128,
    pub criticality_tier: u8,
}

impl Participant {
    pub fn new(id: ParticipantId, liquidity: u128, reserved: u128) -> Self {
        Self {
            id,
            initial_liquidity: liquidity,
            available_liquidity: liquidity,
            reserved_liquidity: reserved,
            credit_limit: 0,
            criticality_tier: 1,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Obligation {
    pub id: ObligationId,
    pub payer: ParticipantId,
    pub payee: ParticipantId,
    pub asset: AssetId,
    pub amount: u128,
    pub priority: ObligationPriority,
}

impl Obligation {
    pub fn new(
        id: ObligationId,
        payer: ParticipantId,
        payee: ParticipantId,
        asset: AssetId,
        amount: u128,
        priority: ObligationPriority,
    ) -> Self {
        Self {
            id,
            payer,
            payee,
            asset,
            amount,
            priority,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementTransfer {
    pub payer: ParticipantId,
    pub payee: ParticipantId,
    pub asset: AssetId,
    pub amount: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClearingPlan {
    pub transfers: Vec<SettlementTransfer>,
    pub gross_volume: u128,
    pub net_settlement_volume: u128,
    pub participant_net_debits: BTreeMap<ParticipantId, u128>,
    pub participant_net_credits: BTreeMap<ParticipantId, u128>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ShockConfig {
    pub shock_percentage: u32,
    pub target_regime: RiskRegime,
    pub required_reserve_bps: u32,
}

impl Default for ShockConfig {
    fn default() -> Self {
        Self {
            shock_percentage: 40,
            target_regime: RiskRegime::Constrained,
            required_reserve_bps: 2500,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParticipantShockState {
    pub id: ParticipantId,
    pub initial_liquidity: u128,
    pub shocked_liquidity: u128,
    pub net_debit: u128,
    pub net_credit: u128,
    pub post_settlement_liquidity: u128,
    pub required_reserve: u128,
    pub shortfall: u128,
    pub is_breaching: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CascadeReport {
    pub shocked_participants: Vec<ParticipantShockState>,
    pub breaching_participants: Vec<ParticipantId>,
    pub total_shortfall: u128,
    pub failed_obligations: Vec<ObligationId>,
    pub is_cascade_active: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrunedPlanResult {
    pub cleared_obligations: Vec<Obligation>,
    pub deferred_obligations: Vec<Obligation>,
    pub settlement_transfers: Vec<SettlementTransfer>,
    pub gross_volume: u128,
    pub net_volume: u128,
    pub all_reserves_satisfied: bool,
    pub iterations_count: usize,
}

pub struct StressEngine {
    pub config: ShockConfig,
}

impl StressEngine {
    pub fn new(config: ShockConfig) -> Self {
        Self { config }
    }

    pub fn with_default_config() -> Self {
        Self::new(ShockConfig::default())
    }

    /// Applies liquidity shock to participant balances (default -40%).
    pub fn apply_liquidity_shock(&self, participants: &[Participant]) -> Vec<Participant> {
        let shock_factor = (100 - self.config.shock_percentage.min(100)) as u128;
        participants
            .iter()
            .map(|p| {
                let shocked = (p.available_liquidity * shock_factor) / 100;
                Participant {
                    id: p.id,
                    initial_liquidity: p.initial_liquidity,
                    available_liquidity: shocked,
                    reserved_liquidity: p.reserved_liquidity,
                    credit_limit: p.credit_limit,
                    criticality_tier: p.criticality_tier,
                }
            })
            .collect()
    }

    /// Computes multilateral netting and creates compressed settlement transfers.
    pub fn compute_multilateral_clearing(&self, obligations: &[Obligation]) -> ClearingPlan {
        let mut gross_volume = 0u128;
        let mut asset_map: BTreeMap<AssetId, BTreeMap<ParticipantId, i128>> = BTreeMap::new();

        for ob in obligations {
            gross_volume = gross_volume.saturating_add(ob.amount);
            let balances = asset_map.entry(ob.asset).or_default();

            let payer_bal = balances.entry(ob.payer).or_insert(0);
            *payer_bal -= ob.amount as i128;

            let payee_bal = balances.entry(ob.payee).or_insert(0);
            *payee_bal += ob.amount as i128;
        }

        let mut transfers = Vec::new();
        let mut net_settlement_volume = 0u128;
        let mut participant_net_debits = BTreeMap::new();
        let mut participant_net_credits = BTreeMap::new();

        for (asset, balances) in asset_map {
            let mut debtors: Vec<(ParticipantId, u128)> = Vec::new();
            let mut creditors: Vec<(ParticipantId, u128)> = Vec::new();

            for (participant, net) in balances {
                if net < 0 {
                    let amount = (-net) as u128;
                    debtors.push((participant, amount));
                    let cur = participant_net_debits.entry(participant).or_insert(0u128);
                    *cur = cur.saturating_add(amount);
                } else if net > 0 {
                    let amount = net as u128;
                    creditors.push((participant, amount));
                    let cur = participant_net_credits.entry(participant).or_insert(0u128);
                    *cur = cur.saturating_add(amount);
                }
            }

            debtors.sort_by_key(|b| std::cmp::Reverse(b.1));
            creditors.sort_by_key(|b| std::cmp::Reverse(b.1));

            let mut d_idx = 0;
            let mut c_idx = 0;

            while d_idx < debtors.len() && c_idx < creditors.len() {
                let (debtor_id, ref mut debtor_rem) = debtors[d_idx];
                let (creditor_id, ref mut creditor_rem) = creditors[c_idx];

                let matched = (*debtor_rem).min(*creditor_rem);
                if matched > 0 {
                    transfers.push(SettlementTransfer {
                        payer: debtor_id,
                        payee: creditor_id,
                        asset,
                        amount: matched,
                    });
                    net_settlement_volume = net_settlement_volume.saturating_add(matched);
                    *debtor_rem -= matched;
                    *creditor_rem -= matched;
                }

                if *debtor_rem == 0 {
                    d_idx += 1;
                }
                if *creditor_rem == 0 {
                    c_idx += 1;
                }
            }
        }

        ClearingPlan {
            transfers,
            gross_volume,
            net_settlement_volume,
            participant_net_debits,
            participant_net_credits,
        }
    }

    /// Identifies which participants breach reserve ratios and which obligations fail settlement.
    pub fn detect_cascade(
        &self,
        participants: &[Participant],
        obligations: &[Obligation],
    ) -> CascadeReport {
        let shocked = self.apply_liquidity_shock(participants);
        let clearing = self.compute_multilateral_clearing(obligations);

        let mut shocked_participants = Vec::new();
        let mut breaching_participants = Vec::new();
        let mut total_shortfall = 0u128;

        for p in &shocked {
            let net_debit = clearing
                .participant_net_debits
                .get(&p.id)
                .copied()
                .unwrap_or(0);
            let net_credit = clearing
                .participant_net_credits
                .get(&p.id)
                .copied()
                .unwrap_or(0);

            let required_reserve =
                (p.available_liquidity * self.config.required_reserve_bps as u128) / BPS_SCALE;
            let shortfall = calculate_post_settlement_shortfall(
                p.available_liquidity,
                net_debit,
                required_reserve,
            );

            let is_breaching = shortfall > 0;
            if is_breaching {
                breaching_participants.push(p.id);
                total_shortfall = total_shortfall.saturating_add(shortfall);
            }

            let post_settlement = p
                .available_liquidity
                .saturating_add(net_credit)
                .saturating_sub(net_debit);

            shocked_participants.push(ParticipantShockState {
                id: p.id,
                initial_liquidity: p.initial_liquidity,
                shocked_liquidity: p.available_liquidity,
                net_debit,
                net_credit,
                post_settlement_liquidity: post_settlement,
                required_reserve,
                shortfall,
                is_breaching,
            });
        }

        let mut failed_obligations = Vec::new();
        for ob in obligations {
            if breaching_participants.contains(&ob.payer) {
                failed_obligations.push(ob.id);
            }
        }

        let is_cascade_active = !breaching_participants.is_empty();

        CascadeReport {
            shocked_participants,
            breaching_participants,
            total_shortfall,
            failed_obligations,
            is_cascade_active,
        }
    }

    /// Drops lowest-priority obligations iteratively until post-settlement reserve ratios are restored.
    pub fn calculate_pruned_settlement_plan(
        &self,
        participants: &[Participant],
        obligations: &[Obligation],
    ) -> PrunedPlanResult {
        let shocked = self.apply_liquidity_shock(participants);
        let shocked_map: BTreeMap<ParticipantId, u128> = shocked
            .iter()
            .map(|p| (p.id, p.available_liquidity))
            .collect();

        // 1. Initial filter by regime eligibility
        let mut candidate_obs: Vec<Obligation> = Vec::new();
        let mut deferred_obs: Vec<Obligation> = Vec::new();

        for ob in obligations {
            if ob.priority.is_settlement_permitted(self.config.target_regime) {
                candidate_obs.push(ob.clone());
            } else {
                deferred_obs.push(ob.clone());
            }
        }

        let mut iterations = 0;
        const MAX_ITERATIONS: usize = 300;

        loop {
            if iterations >= MAX_ITERATIONS || candidate_obs.is_empty() {
                break;
            }
            iterations += 1;

            let clearing = self.compute_multilateral_clearing(&candidate_obs);

            let mut breaching_payer: Option<ParticipantId> = None;
            let mut max_shortfall = 0u128;

            for (&payer_id, &debit) in &clearing.participant_net_debits {
                let &available = shocked_map.get(&payer_id).unwrap_or(&0);
                let required_reserve =
                    (available * self.config.required_reserve_bps as u128) / BPS_SCALE;
                let shortfall =
                    calculate_post_settlement_shortfall(available, debit, required_reserve);

                if shortfall > 0 && shortfall > max_shortfall {
                    max_shortfall = shortfall;
                    breaching_payer = Some(payer_id);
                }
            }

            match breaching_payer {
                None => break, // All reserves satisfied
                Some(payer) => {
                    // Find candidate obligations of this breaching payer
                    let mut payer_obs: Vec<(usize, &Obligation)> = candidate_obs
                        .iter()
                        .enumerate()
                        .filter(|(_, ob)| ob.payer == payer)
                        .collect();

                    if payer_obs.is_empty() {
                        // Breaching participant has no outgoing obligations left
                        break;
                    }

                    // Sort: lowest priority first (highest numeric value), then largest amount
                    payer_obs.sort_by(|a, b| {
                        b.1.priority
                            .cmp(&a.1.priority)
                            .then_with(|| b.1.amount.cmp(&a.1.amount))
                    });

                    let remove_idx = payer_obs[0].0;
                    let dropped = candidate_obs.remove(remove_idx);
                    deferred_obs.push(dropped);
                }
            }
        }

        // Final clearing verification
        let final_clearing = self.compute_multilateral_clearing(&candidate_obs);
        let mut all_reserves_satisfied = true;

        for (&payer_id, &debit) in &final_clearing.participant_net_debits {
            let &available = shocked_map.get(&payer_id).unwrap_or(&0);
            let required_reserve =
                (available * self.config.required_reserve_bps as u128) / BPS_SCALE;
            let shortfall =
                calculate_post_settlement_shortfall(available, debit, required_reserve);
            if shortfall > 0 {
                all_reserves_satisfied = false;
                break;
            }
        }

        PrunedPlanResult {
            cleared_obligations: candidate_obs,
            deferred_obligations: deferred_obs,
            settlement_transfers: final_clearing.transfers,
            gross_volume: final_clearing.gross_volume,
            net_volume: final_clearing.net_settlement_volume,
            all_reserves_satisfied,
            iterations_count: iterations,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_network() -> (Vec<Participant>, Vec<Obligation>) {
        let p1 = Participant::new(make_participant_id(1), 100_000, 10_000);
        let p2 = Participant::new(make_participant_id(2), 100_000, 10_000);
        let p3 = Participant::new(make_participant_id(3), 100_000, 10_000);

        let asset = [0xAA; 20];

        let ob1 = Obligation::new(
            make_obligation_id(1),
            p1.id,
            p2.id,
            asset,
            40_000,
            ObligationPriority::High,
        );
        let ob2 = Obligation::new(
            make_obligation_id(2),
            p2.id,
            p3.id,
            asset,
            30_000,
            ObligationPriority::Normal,
        );
        let ob3 = Obligation::new(
            make_obligation_id(3),
            p3.id,
            p1.id,
            asset,
            20_000,
            ObligationPriority::Critical,
        );

        (vec![p1, p2, p3], vec![ob1, ob2, ob3])
    }

    #[test]
    fn test_shock_simulator_40_percent() {
        let engine = StressEngine::with_default_config();
        let (participants, _) = test_network();

        let shocked = engine.apply_liquidity_shock(&participants);
        assert_eq!(shocked.len(), 3);
        for p in shocked {
            // 40% shock of 100,000 leaves 60,000
            assert_eq!(p.available_liquidity, 60_000);
        }
    }

    #[test]
    fn test_cascade_detector_identifies_breaches() {
        let engine = StressEngine::with_default_config();

        // Agent 1 has 50,000 liquidity.
        // Shock (-40%) leaves 30,000.
        // Required reserve (25%) = 7,500.
        // Max allowable net debit without breach = 30,000 - 7,500 = 22,500.
        // Obligation amount = 25,000.
        // Post settlement = 30,000 - 25,000 = 5,000 < 7,500. Shortfall = 2,500.
        let p1 = Participant::new(make_participant_id(1), 50_000, 5_000);
        let p2 = Participant::new(make_participant_id(2), 200_000, 20_000);

        let ob = Obligation::new(
            make_obligation_id(1),
            p1.id,
            p2.id,
            [0xAA; 20],
            25_000,
            ObligationPriority::High,
        );

        let report = engine.detect_cascade(&[p1, p2], &[ob]);
        assert!(report.is_cascade_active);
        assert_eq!(report.breaching_participants.len(), 1);
        assert_eq!(report.breaching_participants[0], make_participant_id(1));
        assert_eq!(report.total_shortfall, 2_500);
        assert_eq!(report.failed_obligations.len(), 1);
    }

    #[test]
    fn test_pruned_plan_recovery() {
        let engine = StressEngine::with_default_config();

        let p1 = Participant::new(make_participant_id(1), 100_000, 10_000);
        let p2 = Participant::new(make_participant_id(2), 100_000, 10_000);
        let asset = [0xAA; 20];

        // p1 after 40% shock has 60,000 available.
        // 25% reserve requires 15,000.
        // Max allowable debit = 45,000.
        // Critical obligation: 30,000 (permitted)
        // High obligation: 10,000 (permitted)
        // Normal obligation: 20,000 (dropped by regime filter or pruning)
        let ob_crit = Obligation::new(
            make_obligation_id(1),
            p1.id,
            p2.id,
            asset,
            30_000,
            ObligationPriority::Critical,
        );
        let ob_high = Obligation::new(
            make_obligation_id(2),
            p1.id,
            p2.id,
            asset,
            10_000,
            ObligationPriority::High,
        );
        let ob_norm = Obligation::new(
            make_obligation_id(3),
            p1.id,
            p2.id,
            asset,
            20_000,
            ObligationPriority::Normal,
        );

        let result = engine.calculate_pruned_settlement_plan(
            &[p1, p2],
            &[ob_crit.clone(), ob_high.clone(), ob_norm.clone()],
        );

        assert!(result.all_reserves_satisfied);
        // ob_norm was deferred, keeping total debit to 40,000 <= 45,000.
        assert_eq!(result.cleared_obligations.len(), 2);
        assert_eq!(result.deferred_obligations.len(), 1);
        assert_eq!(result.deferred_obligations[0].id, ob_norm.id);
    }

    #[test]
    fn test_multilateral_netting_conservation() {
        let engine = StressEngine::with_default_config();
        let (_participants, obligations) = test_network();

        let plan = engine.compute_multilateral_clearing(&obligations);
        // Verify conservation of net debits and credits
        let debits: Vec<u128> = plan.participant_net_debits.values().copied().collect();
        let credits: Vec<u128> = plan.participant_net_credits.values().copied().collect();
        assert!(verify_conservation(&credits, &debits));

        // Circular obligations: A owes B 40k, B owes C 30k, C owes A 20k
        // Net positions:
        // A: owes 40k, receives 20k => net debit 20k
        // B: receives 40k, owes 30k => net credit 10k
        // C: receives 30k, owes 20k => net credit 10k
        // Total net volume = 20k (instead of 90k gross volume)
        assert_eq!(plan.gross_volume, 90_000);
        assert_eq!(plan.net_settlement_volume, 20_000);
    }

    #[test]
    fn test_empty_network_handling() {
        let engine = StressEngine::with_default_config();
        let clearing = engine.compute_multilateral_clearing(&[]);
        assert_eq!(clearing.gross_volume, 0);
        assert_eq!(clearing.net_settlement_volume, 0);
        assert!(clearing.transfers.is_empty());

        let report = engine.detect_cascade(&[], &[]);
        assert!(!report.is_cascade_active);
        assert!(report.breaching_participants.is_empty());

        let result = engine.calculate_pruned_settlement_plan(&[], &[]);
        assert!(result.all_reserves_satisfied);
        assert!(result.cleared_obligations.is_empty());
    }

    #[test]
    fn test_priority_cascade_pruning_order() {
        let engine = StressEngine::with_default_config();

        // P1 has 100k liquidity -> shocked to 60k -> required reserve (25%) = 15k -> max debit = 45k
        let p1 = Participant::new(make_participant_id(1), 100_000, 10_000);
        let p2 = Participant::new(make_participant_id(2), 200_000, 20_000);
        let asset = [0xBB; 20];

        // Obligations totaling 60k debit for P1 (exceeding 45k max debit):
        // 1. Critical: 20k
        // 2. High: 15k
        // 3. Normal: 10k
        // 4. Deferred: 15k
        // In CONSTRAINED regime, Normal and Deferred are filtered out first, leaving Critical (20k) + High (15k) = 35k <= 45k.
        let ob_crit = Obligation::new(make_obligation_id(1), p1.id, p2.id, asset, 20_000, ObligationPriority::Critical);
        let ob_high = Obligation::new(make_obligation_id(2), p1.id, p2.id, asset, 15_000, ObligationPriority::High);
        let ob_norm = Obligation::new(make_obligation_id(3), p1.id, p2.id, asset, 10_000, ObligationPriority::Normal);
        let ob_def = Obligation::new(make_obligation_id(4), p1.id, p2.id, asset, 15_000, ObligationPriority::Deferred);

        let result = engine.calculate_pruned_settlement_plan(&[p1, p2], &[ob_crit, ob_high, ob_norm, ob_def]);

        assert!(result.all_reserves_satisfied);
        assert_eq!(result.cleared_obligations.len(), 2);
        assert_eq!(result.deferred_obligations.len(), 2);

        // Cleared obligations should be Critical and High
        assert!(result.cleared_obligations.iter().any(|o| o.priority == ObligationPriority::Critical));
        assert!(result.cleared_obligations.iter().any(|o| o.priority == ObligationPriority::High));
    }

    #[test]
    fn test_no_breach_scenario() {
        let engine = StressEngine::with_default_config();

        let p1 = Participant::new(make_participant_id(1), 1_000_000, 100_000);
        let p2 = Participant::new(make_participant_id(2), 1_000_000, 100_000);
        let asset = [0xCC; 20];

        let ob = Obligation::new(make_obligation_id(1), p1.id, p2.id, asset, 50_000, ObligationPriority::Critical);

        let report = engine.detect_cascade(&[p1.clone(), p2.clone()], std::slice::from_ref(&ob));
        assert!(!report.is_cascade_active);
        assert_eq!(report.total_shortfall, 0);

        let result = engine.calculate_pruned_settlement_plan(&[p1, p2], &[ob]);
        assert!(result.all_reserves_satisfied);
        assert_eq!(result.cleared_obligations.len(), 1);
        assert_eq!(result.deferred_obligations.len(), 0);
    }

    #[test]
    fn test_custom_shock_configuration() {
        let custom_config = ShockConfig {
            shock_percentage: 50, // 50% shock
            target_regime: RiskRegime::Defensive,
            required_reserve_bps: 5000, // 50% reserve ratio
        };
        let engine = StressEngine::new(custom_config);

        let p1 = Participant::new(make_participant_id(1), 100_000, 10_000);
        let shocked = engine.apply_liquidity_shock(&[p1]);
        assert_eq!(shocked[0].available_liquidity, 50_000);
    }
}
