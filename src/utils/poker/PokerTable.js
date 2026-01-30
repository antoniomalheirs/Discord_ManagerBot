const Deck = require('./Deck');
const Hand = require('./Hand');

class PokerTable {
    constructor(hostId, channelId, maxPlayers = 8, buyIn = 100) {
        this.hostId = hostId;
        this.channelId = channelId;
        this.maxPlayers = maxPlayers;
        this.buyIn = buyIn;

        this.players = []; // { id, name, hand, chips, bet, folded, isAI }
        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.dealerIndex = 0;
        this.turnIndex = -1; // Init to -1 so first increment makes it 0 (or rot logic handles it)

        this.state = 'WAITING'; // WAITING, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
        this.invitedUsers = []; // IDs allowed to join (if private)
        this.logs = []; // Game history logs
    }

    addLog(message) {
        const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logs.unshift(`\`[${timestamp}]\` ${message}`);
        if (this.logs.length > 20) this.logs.pop(); // Keep last 20
    }

    addPlayer(user, isAI = false) {
        if (this.players.length >= this.maxPlayers) return false;
        if (this.players.find(p => p.id === user.id)) return false;

        if (this.invitedUsers.length > 0 && !this.invitedUsers.includes(user.id) && !isAI && user.id !== this.hostId) {
            return 'INVITE_ONLY'; // Rejected
        }

        this.players.push({
            id: user.id,
            name: user.username,
            hand: [],
            chips: this.buyIn, // Deduction happens at command level? Or here? detailed design check. 
            // Usually commands deduct from DB and give to "Table Chips".
            currentBet: 0,
            totalHandBet: 0, // NEW: Track total contribution for Side Pots
            folded: false,
            acted: false,
            isAI: isAI
        });
        return true;
    }

    removePlayer(userId) {
        const index = this.players.findIndex(p => p.id === userId);
        if (index === -1) return false;
        this.players.splice(index, 1);
        return true;
    }

    handleAction(playerId, action, amount = 0) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        if (action === 'fold') {
            player.folded = true;
            player.acted = true;
            return { action: 'fold', player, message: `${player.name} desistiu.` };
        }

        if (action === 'call') {
            const amountToCall = this.currentBet - player.currentBet;

            // Check (Mesa)
            if (amountToCall === 0) {
                player.acted = true;
                return { action: 'call', player, message: `${player.name} pediu Mesa.` };
            }

            if (player.chips < amountToCall) {
                // All-in Call
                const actualBet = player.chips;
                player.chips = 0;
                player.currentBet += actualBet;
                player.totalHandBet += actualBet; // Track Total
                this.pot += actualBet;
                player.acted = true;
                return { action: 'call', player, message: `${player.name} pagou ${actualBet} (All-in).` };
            } else {
                player.chips -= amountToCall;
                player.currentBet += amountToCall;
                player.totalHandBet += amountToCall; // Track Total
                this.pot += amountToCall;
                player.acted = true;
                return { action: 'call', player, message: `${player.name} pagou ${amountToCall}.` };
            }
        }

        if (action === 'raise') {
            // Amount comes as 'all' or a number (the INCREASE amount)
            let raiseAmount = amount;
            let totalBet;

            if (amount === 'all') {
                // All-in Raise
                // Logic: Bet everything they have.
                // Total Bet becomes old_currentBet + everything_else?
                // No, All-in means they put EVERYTHING in.
                // New CurrentBet will be whatever they reach.
                const allInTotal = player.currentBet + player.chips;

                // If their all-in is less than current bet, it's effectively a call (all-in) not a raise, but we handle it here.
                if (allInTotal <= this.currentBet) {
                    // Logic mapped to Call All-in
                    // Reuse call logic or just execute
                    const actualBet = player.chips;
                    player.chips = 0;
                    player.currentBet += actualBet;
                    player.totalHandBet += actualBet;
                    this.pot += actualBet;
                    player.acted = true;
                    return { action: 'raise', player, message: `${player.name} foi de All-in (${player.currentBet})!` };
                }

                totalBet = allInTotal;
                raiseAmount = totalBet - this.currentBet; // The actual raise over previous
            } else {
                // Normal Raise (+50, +100 etc on top of CURRENT BET)
                totalBet = this.currentBet + raiseAmount;
            }

            const amountToAdd = totalBet - player.currentBet;

            if (player.chips < amountToAdd) {
                return { action: 'error', message: "Fichas insuficientes para aumentar." };
            }

            player.chips -= amountToAdd;
            player.currentBet += amountToAdd;
            player.totalHandBet += amountToAdd; // Track Total
            this.pot += amountToAdd;
            this.currentBet = totalBet;
            player.acted = true;

            // Should reset others' acted flags? 
            // In strict rules: Yes, if someone raises, others must act again.
            this.players.forEach(p => { if (p.id !== playerId) p.acted = false; });

            return { action: 'raise', player, message: `${player.name} aumentou para ${totalBet} (+${raiseAmount}).` };
        }

        return null;
    }

    startRound() {
        if (this.players.length < 2) return false;

        this.state = 'PREFLOP';
        this.deck.reset();
        this.deck.shuffle();
        this.communityCards = [];
        this.pot = 0;

        // Dealer Rotation
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

        // Blinds Setup (25/50)
        let bigBlindAmount = 50;
        let smallBlindAmount = 25;

        // Identify Positions (Heads-up vs Multi-way)
        let sbIndex, bbIndex, actionIndex;

        if (this.players.length === 2) {
            sbIndex = this.dealerIndex; // Dealer is SB in Heads-up
            bbIndex = (this.dealerIndex + 1) % this.players.length;
            actionIndex = sbIndex; // SB acts first Preflop in Heads-up? No, usually SB is button, acts first.
        } else {
            sbIndex = (this.dealerIndex + 1) % this.players.length;
            bbIndex = (this.dealerIndex + 2) % this.players.length;
            actionIndex = (this.dealerIndex + 3) % this.players.length; // UTG
        }

        // Apply Forced Bets (Handle All-in if low stack)
        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];

        // Apply SB
        const sbBet = Math.min(sbPlayer.chips, smallBlindAmount);
        sbPlayer.chips -= sbBet;
        sbPlayer.currentBet = sbBet;
        sbPlayer.totalHandBet = sbBet;
        this.pot += sbBet;

        // Apply BB
        const bbBet = Math.min(bbPlayer.chips, bigBlindAmount);
        bbPlayer.chips -= bbBet;
        bbPlayer.currentBet = bbBet;
        bbPlayer.totalHandBet = bbBet;
        this.pot += bbBet;

        this.currentBet = bigBlindAmount;
        this.turnIndex = actionIndex;

        // Reset Round Flags & Hands
        for (let p of this.players) {
            p.hand = this.deck.deal(2);
            p.folded = false;
            // Reset flags but preserve blind currentBet
            p.acted = false;
            // If they are all-in from blind, they are acted? 
            // No, they still have option to check if everyone calls? 
            // Simpler: Just reset acted.
            if (p !== sbPlayer && p !== bbPlayer) {
                p.currentBet = 0;
                p.totalHandBet = 0;
            } else {
                // Keep blind bets
            }
        }

        // Fix: Ensure players who aren't blinds have 0 totalHandBet
        this.players.forEach(p => {
            if (p !== sbPlayer && p !== bbPlayer) {
                p.totalHandBet = 0;
            }
        });

        this.addLog(`Botões: Dealer(${this.players[this.dealerIndex].name}), SB(${sbPlayer.name}), BB(${bbPlayer.name}).`);
        this.addLog(`Blinds cobrados: ${sbBet}/${bbBet}.`);

        return true;
    }

    nextStage() {
        if (this.state === 'PREFLOP') {
            this.state = 'FLOP';
            this.communityCards.push(...this.deck.deal(3));
        } else if (this.state === 'FLOP') {
            this.state = 'TURN';
            this.communityCards.push(...this.deck.deal(1));
        } else if (this.state === 'TURN') {
            this.state = 'RIVER';
            this.communityCards.push(...this.deck.deal(1));
        } else if (this.state === 'RIVER') {
            this.state = 'SHOWDOWN';
            return 'SHOWDOWN';
        }

        // Reset betting for new round
        this.currentBet = 0;
        this.players.forEach(p => {
            p.currentBet = 0;
            p.acted = false;
        });

        // Post-flop Action Order: Starts left of Dealer (SB position)
        this.turnIndex = (this.dealerIndex + 1) % this.players.length;

        // Skip folded/all-in players to find first active player
        let attempts = 0;
        while ((this.players[this.turnIndex].folded || this.players[this.turnIndex].chips === 0) && attempts < this.players.length) {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            attempts++;
        }

        return this.state;
    }

    processAITurn() {
        // Find current player
        const currentPlayer = this.players[this.turnIndex];
        if (!currentPlayer.isAI || currentPlayer.folded) return null;

        // Check if AI has chips to play
        if (currentPlayer.chips <= 0) return null;

        // Simple Random Logic with chip awareness
        const decision = Math.random();
        let action = 'call';

        // Can only raise if has enough chips for minimum raise
        const amountToCall = this.currentBet - currentPlayer.currentBet;
        const canRaise = currentPlayer.chips > amountToCall + 50; // Need chips beyond call amount

        if (decision > 0.8 && canRaise) action = 'raise';
        if (decision < 0.2 && this.currentBet > 0) action = 'fold';

        // Apply action via handleAction to ensure consistency
        return this.handleAction(currentPlayer.id, action);
    }

    checkRoundComplete() {
        // Active players (not folded)
        const activePlayers = this.players.filter(p => !p.folded);

        // 1. Every active player (who still has chips) must have acted
        const potentialActors = activePlayers.filter(p => p.chips > 0);
        const allActed = potentialActors.every(p => p.acted);

        if (!allActed) return false;

        // 2. Every active player must match currentBet OR be All-in
        const allMatched = activePlayers.every(p => p.currentBet === this.currentBet || p.chips === 0);

        return allMatched;
    }

    resetRoundFlags() {
        this.players.forEach(p => {
            if (!p.folded && p.chips > 0) p.acted = false;
        });
    }

    // ... processAI ...

    resolveShowdown() {
        // Filter Active Players (Not Folded)
        // Folded players lose everything they put in.

        let candidates = this.players.filter(p => !p.folded);
        if (candidates.length === 0) return []; // Should not happen

        // Calculate Hand Strength for everyone active
        candidates.forEach(p => {
            p.eval = Hand.evaluate([...p.hand, ...this.communityCards]);
            p.winnings = 0; // Init winnings
            p.remainingClaim = p.totalHandBet; // Amount they can win from each other person
        });

        // Add Folder players to "Money Source" but not as winners
        // Actually, we process pot by iterating contributions.

        // Better Algorithm (Side Pot Logic):
        // 1. Create list of all pots (Main + Sides).
        // OR: Distribute iteratively.

        // Iterative Approach:
        // Sort Candidates by Strength (Best to Worst)
        candidates.sort((a, b) => {
            if (b.eval.rank !== a.eval.rank) return b.eval.rank - a.eval.rank;
            for (let i = 0; i < 5; i++) {
                const cardA = a.eval.cards[i] ? a.eval.cards[i].numericValue : 0;
                const cardB = b.eval.cards[i] ? b.eval.cards[i].numericValue : 0;
                if (cardB !== cardA) return cardB - cardA;
            }
            return 0;
        });

        // We also need a list of ALL players (including folded) to take money FROM.
        // Copy their total bets to a mutable 'contribution' tracker.
        const contributions = this.players.map(p => ({ id: p.id, amount: p.totalHandBet }));

        let totalDistributed = 0;
        const results = [];

        // Loop through winners (candidates) from Best to Worst
        for (let i = 0; i < candidates.length; i++) {
            const winner = candidates[i];
            if (winner.remainingClaim <= 0) continue; // Already fully paid (or covered)

            // Find ties
            const tiedWinners = [winner];
            for (let j = i + 1; j < candidates.length; j++) {
                const next = candidates[j];
                // Check equality logic (same as sort)
                let isTie = false;
                if (next.eval.rank === winner.eval.rank) {
                    let cardTie = true;
                    for (let k = 0; k < 5; k++) {
                        if (next.eval.cards[k].numericValue !== winner.eval.cards[k].numericValue) {
                            cardTie = false; break;
                        }
                    }
                    if (cardTie) isTie = true;
                }

                if (isTie) tiedWinners.push(next);
                else break;
            }

            // Determine the "Cap" for this pot level
            // The cap is the smallest 'remainingClaim' among the tied winners
            // (Actually, usually side pots are defined by the smallest ALL-IN amount)
            // But here we iterate top-down.
            // If the best hand has only bet 50, he can only take 50 from everyone.

            // Find min claim among tied winners who still have a claim
            let minClaim = Math.min(...tiedWinners.filter(w => w.remainingClaim > 0).map(w => w.remainingClaim));

            // Collect this amount from everyone's AVAILABLE contributions
            let potForThisLevel = 0;
            contributions.forEach(c => {
                const take = Math.min(c.amount, minClaim);
                c.amount -= take;
                potForThisLevel += take;
            });

            if (potForThisLevel > 0) {
                // Split among tied winners
                const share = Math.floor(potForThisLevel / tiedWinners.length);
                tiedWinners.forEach(w => {
                    w.winnings += share;
                    // Deduct from their claim?
                    // Logic check: If I bet 50 and win against someone who bet 100.
                    // I take 50 from him. My claim satisfied.
                    // He has 50 left. Next winner takes it.
                    // So we must reduce the 'remainingClaim' of the winners by the amount 'minClaim' we just processed.
                    w.remainingClaim -= minClaim;
                });
            }

            // Skip the rest of tied winners in the outer loop to avoid double processing?
            // No, the inner loop just grouped them for THIS pot level.
            // We need to advance 'i' carefully, BUT 'remainingClaim' handles logic.
            // If w.remainingClaim becomes 0, he is skipped next time.
            // However, typical side pot logic runs one 'pot' at a time.
            // Simplified: We processed 'minClaim' slice of the pot for THOSE winners.
            // If they still have claim (because minClaim was limited by someone else?), they stay candidates for next slice?
            // Actually, if we use minClaim from the winners themselves, at least one winner is satisfied/capped.
        }

        // Prepare Output
        // Return active players with their total winnings > 0
        const winners = candidates.filter(p => p.winnings > 0).map(p => ({
            player: p,
            hand: p.eval,
            splitAmount: p.winnings, // Total Won
            chipsBefore: p.chips, // Debug
        }));

        // Update Chips exactly
        winners.forEach(w => {
            w.player.chips += w.splitAmount;
        });

        return winners;
    }

    getShowdownResults() {
        const results = [];
        for (let p of this.players) {
            if (p.folded) {
                results.push({ player: p, status: 'FOLDED' });
                continue;
            }
            const evalResult = Hand.evaluate([...p.hand, ...this.communityCards]);
            results.push({ player: p, hand: evalResult, status: 'ACTIVE' });
        }

        // Sort active players by strength for display, folded last
        results.sort((a, b) => {
            if (a.status === 'FOLDED') return 1;
            if (b.status === 'FOLDED') return -1;

            // Primary: Hand Rank
            if (b.hand.rank !== a.hand.rank) return b.hand.rank - a.hand.rank;

            // Secondary: Deep Card Comparison (Kickers)
            for (let i = 0; i < 5; i++) {
                const cardA = a.hand.cards[i] ? a.hand.cards[i].numericValue : 0;
                const cardB = b.hand.cards[i] ? b.hand.cards[i].numericValue : 0;
                if (cardB !== cardA) return cardB - cardA;
            }
            return 0;
        });

        return results;
    }
}

module.exports = PokerTable;
