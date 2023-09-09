class Random {
    //generator
    mulberry32 = (a) => {
        return function() {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    
    //hasher
    hashCode(str) {
        let hash = 0;
        for (let i = 0, len = str.toString().length; i < len; i++) {
            let chr = str.toString().charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    constructor (seed = Math.random().toString(36).substring(2,12)) {
        this.SEED = seed
        this.random = this.mulberry32(this.hashCode(this.SEED));

        //basic random - returns a random value ranging from 0 and a given input
        this.random.chance = (n) => {
            return ~~(this.random() * (n + 1))
        }

        //returns a random value from a given range
        this.random.range = (a,b) => {
            return a + ~~(this.random() * (b - a + 1)) 
        }

        //given a chance returns either true or false
        this.random.chance = (chance) => {
            if (~~(this.random() * 101) <= chance) {
                return true
            } else {
                return false
            }
}
        return this.random
    }
}