/**
 * Poker Hand Evaluator
 * Determines the best hand from a set of cards.
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Hand {
    static getRankValue(value) {
        return RANKS.indexOf(value) + 2; // 2=2, ..., A=14
    }

    static evaluate(cards) {
        // Sort cards by value desc (A, K, ..., 2)
        const sorted = cards.map(c => ({
            ...c,
            numericValue: this.getRankValue(c.value)
        })).sort((a, b) => b.numericValue - a.numericValue);

        // Check patterns (from highest to lowest)
        const flush = this.getFlush(sorted);
        const straight = this.getStraight(sorted);
        const pairs = this.getPairs(sorted);

        // 1. Straight Flush
        if (flush && this.getStraight(flush.cards)) {
            const sf = this.getStraight(flush.cards);
            if (sf.highCard === 14) return { rank: 9, name: "Royal Flush", high: 14, cards: sf.cards };
            return { rank: 8, name: "Straight Flush", high: sf.highCard, cards: sf.cards };
        }

        // 2. Four of a Kind
        if (pairs.four) {
            const fourCards = sorted.filter(c => c.numericValue === pairs.four);
            const kickers = sorted.filter(c => c.numericValue !== pairs.four);
            return { rank: 7, name: "Four of a Kind", high: pairs.four, cards: [...fourCards, kickers[0]] };
        }

        // 3. Full House
        if (pairs.three && pairs.pair) {
            const threeCards = sorted.filter(c => c.numericValue === pairs.three);
            const pairCards = sorted.filter(c => c.numericValue === pairs.pair);
            return { rank: 6, name: "Full House", high: pairs.three, cards: [...threeCards, ...pairCards.slice(0, 2)] };
        }

        // 4. Flush
        if (flush) return { rank: 5, name: "Flush", high: flush.cards[0].numericValue, cards: flush.cards.slice(0, 5) };

        // 5. Straight
        if (straight) return { rank: 4, name: "Straight", high: straight.highCard, cards: straight.cards };

        // 6. Three of a Kind
        if (pairs.three) {
            const threeCards = sorted.filter(c => c.numericValue === pairs.three);
            const kickers = sorted.filter(c => c.numericValue !== pairs.three);
            return { rank: 3, name: "Three of a Kind", high: pairs.three, cards: [...threeCards, ...kickers.slice(0, 2)] };
        }

        // 7. Two Pair
        if (pairs.twoPair) {
            const pair1 = sorted.filter(c => c.numericValue === pairs.twoPair[0]);
            const pair2 = sorted.filter(c => c.numericValue === pairs.twoPair[1]);
            const kickers = sorted.filter(c => c.numericValue !== pairs.twoPair[0] && c.numericValue !== pairs.twoPair[1]);
            return { rank: 2, name: "Two Pair", high: pairs.twoPair[0], cards: [...pair1, ...pair2, kickers[0]] };
        }

        // 8. One Pair
        if (pairs.pair) {
            const pairCards = sorted.filter(c => c.numericValue === pairs.pair);
            const kickers = sorted.filter(c => c.numericValue !== pairs.pair);
            return { rank: 1, name: "Pair", high: pairs.pair, cards: [...pairCards, ...kickers.slice(0, 3)] };
        }

        // 9. High Card
        return { rank: 0, name: "High Card", high: sorted[0].numericValue, cards: sorted.slice(0, 5) };
    }

    static getFlush(cards) {
        const suits = {};
        for (let c of cards) {
            if (!suits[c.suit]) suits[c.suit] = [];
            suits[c.suit].push(c);
        }
        for (let s in suits) {
            if (suits[s].length >= 5) return { cards: suits[s] };
        }
        return null;
    }

    static getStraight(cards) {
        // Remove duplicates for straight check
        const unique = cards.filter((v, i, a) => a.findIndex(t => t.numericValue === v.numericValue) === i);
        if (unique.length < 5) return null;

        for (let i = 0; i <= unique.length - 5; i++) {
            const subset = unique.slice(i, i + 5);
            if (subset[0].numericValue - subset[4].numericValue === 4) {
                return { highCard: subset[0].numericValue, cards: subset };
            }
        }
        // Ace low straight (A, 5, 4, 3, 2)
        // Check if we have A, 5, 4, 3, 2
        // A is 14. 5,4,3,2 are 5,4,3,2.
        const hasAce = unique.find(c => c.numericValue === 14);
        const has5432 = unique.filter(c => [2, 3, 4, 5].includes(c.numericValue)).length === 4;

        if (hasAce && has5432) {
            const wheel = [hasAce, ...unique.filter(c => [5, 4, 3, 2].includes(c.numericValue))]; // This logic is simplified
            return { highCard: 5, cards: wheel }; // High card is 5 in wheel
        }

        return null;
    }

    static getPairs(cards) {
        const counts = {};
        for (let c of cards) {
            counts[c.numericValue] = (counts[c.numericValue] || 0) + 1;
        }

        let four = 0, three = 0, pairs = [];
        for (let val in counts) {
            if (counts[val] === 4) four = parseInt(val);
            if (counts[val] === 3) three = parseInt(val); // Keeps highest if 2 sets? No standard deck.
            if (counts[val] === 2) pairs.push(parseInt(val));
        }

        pairs.sort((a, b) => b - a);

        return {
            four,
            three,
            pair: pairs.length > 0 ? pairs[0] : 0,
            twoPair: pairs.length >= 2 ? pairs : null
        };
    }
}

module.exports = Hand;
