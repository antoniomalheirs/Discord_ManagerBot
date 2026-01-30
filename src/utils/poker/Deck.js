const crypto = require('crypto');

/**
 * Standard 52-card Deck implementation
 */
class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        const suits = ['♠', '♥', '♣', '♦'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        for (let suit of suits) {
            for (let value of values) {
                this.cards.push({ suit, value, toString: () => `[${value}${suit}]` });
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            // Crypto-Secure Random Index
            const j = crypto.randomInt(0, i + 1);
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count = 1) {
        if (this.cards.length < count) throw new Error("Not enough cards in deck");
        return this.cards.splice(0, count);
    }
}

module.exports = Deck;
