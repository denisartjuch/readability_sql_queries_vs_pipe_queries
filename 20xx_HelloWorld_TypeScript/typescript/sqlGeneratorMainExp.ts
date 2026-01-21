import * as fs from "node:fs";
import { SET_SEED } from "../N-of-1-Experimentation/modules/Experimentation/Experimentation";
let SEED = "42";
SET_SEED(SEED);

type Triplet = [number, number, number]; 
type ErrorType = "SELECT_UNKNOWN" | "AGG_UNKNOWN" | "GROUP_UNKNOWN" | "NoError";
type ErrorMarkerRole = "ATTR" | "AGG" | "GROUP";

class Aggregate {
    function: string = "";
    attribute: string = "";
    rename: string = "";
}

interface SqlGenerationResult {
    sql: string;
    pipeSql: string;
    cteErrorCost?: number;
    pipeErrorCost?: number | null;
    diff?: number | null;
    totalInformationSQL: number;
    totalInformationPipe: number;
    unknownName: string | null;
    errorType?: ErrorType;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;
    cteErrorLine?: number | null;
    pipeErrorLine?: number | null;
}

export interface ResultRow {
    sqlQuery: string;
    pipeQuery: string;
    totalInformationSQL: number;
    totalInformationPipe: number;
    totalInformationUntilErrorSQL: number | null;
    totalInformationUntilErrorPipe: number | null;
    errorType: ErrorType | null;
    totalInformationDifference: number | null;
    unknownName: string | null;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;
    errorLineSQL: number | null;
    errorLinePipe: number | null;
}
class Query {
    attributes: string[] = [];
    group_by: string[] = [];
    aggregates: Aggregate[] = [];
    from: Query | null = null;

    errorMarker?: {
        type: ErrorType;
        role: ErrorMarkerRole;
        index: number;
    };

    total_costs_CTE(): number {
        let total_costs = 0;
        if (this.from != null) total_costs = this.from.total_costs_CTE();
        total_costs += this.attributes.length + this.aggregates.length * 2 + this.group_by.length;
        return total_costs;
    }

    total_costs_pipe(): number {
        let total_costs = 0;
        if (this.from != null) total_costs = this.from.total_costs_pipe();
        if (this.aggregates.length > 0) {
            total_costs += this.aggregates.length * 2 + this.group_by.length;
        } else {
            total_costs += this.attributes.length;
        }
        return total_costs;
    }

    clone(): Query {
        const q = new Query();
        q.attributes = [...this.attributes];
        q.group_by = [...this.group_by];
        q.aggregates = this.aggregates.map(a => {
            const agg = new Aggregate();
            agg.function = a.function;
            agg.attribute = a.attribute;
            agg.rename = a.rename;
            return agg;
        });
        q.from = this.from ? this.from.clone() : null;
        if (this.errorMarker) {
            q.errorMarker = { ...this.errorMarker };
        }
        return q;
    }
}

const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"] as const;
const BASE_COLUMNS = 5;

const STATIC_WORDS = [
    "world", "house", "place", "group", "party", "money", "point", "state", "night", "water", "thing", "order", "power", "court", "level", "child",
    "south", "staff", "woman", "north", "sense", "death", "range", "table", "trade", "study", "other", "price", "class", "union", "value", "paper",
    "right", "voice", "stage", "light", "march", "board", "month", "music", "field", "award", "issue", "basis", "front", "heart", "force", "model",
    "space", "peter", "hotel", "floor", "style", "event", "press", "doubt", "blood", "sound", "title", "glass", "earth", "river", "whole", "piece",
    "mouth", "radio", "peace", "start", "share", "truth", "smith", "stone", "queen", "stock", "horse", "plant", "visit", "scale", "image", "trust",
    "chair", "cause", "speed", "crime", "pound", "henry", "match", "scene", "stuff", "japan", "claim", "video", "trial", "phone", "train", "sight",
    "grant", "shape", "offer", "while", "smile", "track", "route", "china", "touch", "youth", "waste", "crown", "birth", "faith", "entry", "total",
    "major", "owner", "lunch", "cross", "judge", "guide", "cover", "jones", "green", "brain", "phase", "coast", "drink", "drive", "metal", "index",
    "adult", "sport", "noise", "agent", "simon", "motor", "sheet", "brown", "crowd", "shock", "fruit", "steel", "plate", "grass", "dress", "theme",
    "error", "lewis", "white", "focus", "chief", "sleep", "beach", "sugar", "panel", "dream", "bread", "chain", "chest", "frank", "block", "store",
    "break", "drama", "skill", "round", "rugby", "scope", "plane", "uncle", "abuse", "limit", "taste", "fault", "tower", "input", "enemy", "anger",
    "cycle", "pilot", "frame", "novel", "reply", "prize", "nurse", "cream", "depth", "sheep", "dance", "spite", "coach", "ratio", "fight", "unity",
    "steam", "final", "clock", "pride", "buyer", "smoke", "score", "watch", "apple", "trend", "proof", "pitch", "shirt", "knife", "draft", "shift",
    "terry", "squad", "layer", "laura", "colin", "curve", "wheel", "topic", "guard", "angle", "smell", "grace", "flesh", "mummy", "pupil", "guest",
    "delay", "mayor", "logic", "album", "habit", "billy", "audit", "baker", "paint", "great", "storm", "worth", "black", "daddy", "canal", "robin",
    "kelly", "leave", "lease", "young", "louis", "print", "fleet", "crash", "count", "asset", "cloud", "villa", "actor", "ocean", "brand", "craft",
    "alarm", "bench", "diary", "abbey", "grade", "bible", "jimmy", "shell", "cloth", "piano", "clerk", "stake", "barry", "stand", "mouse", "cable",
    "manor", "local", "penny", "shame", "check", "forum", "brick", "fraud", "stick", "grain", "movie", "cheek", "reign", "label", "theft", "lover",
    "shore", "guilt", "devil", "fence", "glory", "panic", "juice", "debut", "laugh", "chaos", "bruce", "strip", "derby", "jenny", "chart", "widow",
    "essay", "fibre", "patch", "fluid", "virus", "pause", "angel", "cliff", "brass", "magic", "honey", "rover", "bacon", "sally", "trick", "bonus",
    "straw", "shelf", "sauce", "grief", "verse", "shade", "heath", "sword", "waist", "slope", "betty", "organ", "skirt", "ghost", "serum", "lorry",
    "brush", "spell", "lodge", "devon", "ozone", "nerve", "craig", "rally", "eagle", "bowel", "suite", "ridge", "reach", "human", "gould", "breed",
    "bloke", "photo", "lemon", "charm", "elite", "basin", "venue", "flood", "swing", "punch", "grave", "saint", "intel", "corps", "bunch", "usage",
    "trail", "carol", "tommy", "width", "yield", "ferry", "close", "array", "crack", "clash", "alpha", "truck", "trace", "salad", "medal", "cabin",
    "plain", "bride", "stamp", "tutor", "mount", "bobby", "thumb", "mercy", "fever", "laser", "realm", "blade", "boost", "flour", "arrow", "pulse",
    "elbow", "clive", "graph", "flame", "ellen", "skull", "sweat", "texas", "arena", "marsh", "maker", "ulcer", "folly", "wrist", "frost", "donna",
    "choir", "rider", "wheat", "rival", "exile", "flora", "spine", "holly", "lobby", "irony", "ankle", "giant", "mason", "dairy", "merit", "chase",
    "ideal", "agony", "gloom", "toast", "linen", "probe", "scent", "canon", "slide", "metre", "beard", "chalk", "blast", "tiger", "vicar", "ruler",
    "motif", "paddy", "beast", "worry", "ivory", "split", "slave", "hedge", "lotus", "shaft", "cargo", "prose", "altar", "small", "flash", "piper",
    "quest", "quota", "catch", "torch", "slice", "feast", "siege", "queue", "blame", "towel", "rebel", "decay", "stool", "telly", "hurry",
    "onset", "libel", "belly", "grasp", "twist", "basil", "maxim", "urine", "trunk", "mould", "baron", "fairy", "batch", "colon", "spray", "madam",
    "wendy", "guild", "coral", "thigh", "valve", "disco", "drift", "hazel", "teddy", "molly", "greek", "drill", "thief", "tweed", "snake", "derry",
    "tribe", "trout", "morse", "kylie", "spoon", "stall", "daily", "surge", "grove", "benny", "treat", "knock", "gooch", "pearl", "nylon", "purse",
    "depot", "delta", "gauge", "rifle", "onion", "odour", "salon", "radar", "chill", "hardy", "globe", "crust", "guess", "wigan", "cloak", "orbit",
    "oscar", "blaze", "midst", "haven", "tooth", "climb", "flock", "malta", "brook", "wrong", "short", "daisy", "chess", "burst", "mandy", "nanny",
    "dolly", "donor", "cohen", "slate", "amino", "booth", "duchy", "hobby", "alley", "idiot", "verge", "leigh", "drain", "crane", "scrap", "wagon",
    "stoke", "abbot", "genre", "costa", "chile", "stack", "mungo", "lever", "dwarf", "witch", "whale", "crest", "chord", "nancy", "larry", "perry",
    "tract", "molla", "badge", "pasta", "joint", "slump", "ditch", "locke", "jerry", "irene", "minus", "venus", "troop", "curry", "blend", "sweep",
    "porch", "penis", "lager", "flint", "scarf", "tonic", "cough", "litre", "fiver", "attic", "creed", "cocoa", "weber", "goose", "jelly", "greed",
    "carer", "pizza", "brake", "meter", "assay", "boxer", "puppy", "berry", "guido", "couch", "mound", "brief", "glare", "inset", "steak", "moran",
    "hatch", "cider", "apron", "bloom", "newco", "sting", "token", "quote", "niece", "query", "robot", "rotor", "thorn", "patio", "gedge", "cigar",
    "shout", "sperm", "ethos", "ryder", "frown", "satin", "bream", "truce", "spark", "niche", "aisle", "locus", "grill", "forth", "beech", "screw",
    "paste", "brink", "metro", "gypsy", "wight", "burke", "tummy", "friar", "swift", "bunny", "oxide", "vowel", "sharp", "hurst", "razor",
    "fancy", "groom", "satan", "haste", "cache", "guise", "strap", "canoe", "build", "peach", "vogue", "tenor", "birch", "gamma", "bliss", "stare",
    "curse", "flute", "parry", "mafia", "viola", "dread", "crook", "stain", "glove", "remit", "genus", "honda", "rouge", "candy", "flank", "wreck",
    "vault", "pinch", "float", "foyer", "camel", "modem", "miner", "flair", "stern", "fauna", "wedge", "clown", "ghana", "ledge", "gloss", "tramp",
    "shine", "brent", "jewel", "ethel", "firth", "bodie", "proxy", "roach", "maple", "gorge", "crewe", "decor", "throw", "stair", "wrath", "bingo",
    "groin", "scalp", "belle", "tempo", "savoy", "loser", "aroma", "ascot", "motto", "basic", "havoc", "aggie", "willy", "blind", "batty", "monte",
    "yeast", "comic", "scrum", "wharf", "lynch", "ounce", "broom", "click", "snack", "crypt", "spate", "beryl", "pouch", "maize", "liner", "tonne",
    "vinyl", "flush", "dough", "envoy", "smart", "shark", "farce", "arson", "payne", "drake", "turbo", "platt", "minor", "boyle", "broad", "munro",
    "horne", "deity", "synod", "alien", "stein", "vodka", "resin", "alloy", "shrug", "trait", "grand", "spade", "sweet", "sauna", "voter", "scout",
    "gemma", "chuck", "franc", "snail", "scorn", "pedal", "shake", "chant", "spear", "demon", "clone", "swell", "heron", "noble", "gleam", "booze",
    "brett", "kitty", "peril", "chunk", "grape", "finch", "madge", "spike", "stead", "senna", "patsy", "rogue", "barge", "laird", "suede", "topaz",
    "plank", "rhyme", "shire", "relay", "chick", "scare", "brute", "hitch", "idiom", "flask", "gully", "blitz", "fella", "indie", "tyler", "creek",
    "buddy", "tunic", "gravy", "olive", "laity", "comet", "forte", "crisp", "duvet", "rhine", "gland", "filth", "steen", "aunty", "ethic", "tally",
    "blanc", "shrub", "atlas", "lance", "croft", "cheer", "mince", "dogma", "poppy", "lough", "hound", "sigma", "venom", "adobe", "caste", "combo",
    "prior", "siren", "whore", "chang", "dummy", "alert", "scrub", "shoot", "bosom", "forge", "smash", "acorn", "xerox", "logan", "lapse", "denim",
    "smyth", "piety", "rhino", "syrup", "matey", "flake", "amber", "brace", "flare", "smear", "stump", "burgh", "avail", "bluff",
    "foley", "groan", "mucus", "psalm", "crate", "stile", "zebra", "diver", "bully", "reeve", "cobra", "shawl", "spire", "torso", "blank", "think",
    "brunt", "roche", "pixel", "facet", "jetty", "gable", "toxin", "leone", "crush", "optic", "harem", "knack", "moray", "strat", "opium", "poker",
    "vigil", "bowie", "swamp", "sheen", "berth", "debit", "sonny", "sewer", "fritz", "taboo", "norma", "woody", "stint", "baton", "mixer", "clint",
    "slang", "ariel", "wally", "shoal", "bulge", "clump", "flick", "slick", "helix", "stunt", "timer", "comma", "cadet", "melon", "hinge", "barth",
    "smack", "hogan", "champ", "comer", "digit", "stout", "glint", "relic",
    "course", "system", "school", "family", "market", "police", "policy", "office", "person", "health", "mother", "period", "father", "centre", "effect",
    "action", "moment", "report", "church", "change", "street", "result", "reason", "nature", "member", "figure", "friend", "amount", "series", "future",
    "labour", "letter", "theory", "growth", "chance", "record", "energy", "income", "scheme", "design", "choice", "couple", "county", "summer", "colour",
    "season", "garden", "charge", "advice", "doctor", "extent", "window", "access", "region", "degree", "return", "public", "answer", "leader", "appeal",
    "method", "source", "oxford", "demand", "sector", "status", "safety", "weight", "league", "budget", "review", "minute", "survey", "speech", "effort",
    "career", "attack", "length", "memory", "impact", "forest", "sister", "winter", "corner", "damage", "credit", "debate", "supply", "museum", "animal",
    "island", "relief", "target", "spirit", "coffee", "factor", "battle", "prison", "bridge", "detail", "client", "search", "master", "dinner", "agency",
    "manner", "favour", "crisis", "prince", "danger", "output", "middle", "player", "threat", "notice", "bottom", "profit", "second", "castle", "option",
    "reform", "spring", "estate", "volume", "martin", "branch", "object", "driver", "belief", "murder", "flight", "treaty", "desire", "palace", "engine",
    "breath", "screen", "silver", "injury", "valley", "bishop", "christ", "motion", "author", "nation", "sample", "aspect", "cancer", "beauty", "square",
    "vision", "reader", "behalf", "deputy", "artist", "graham", "expert", "parish", "strike", "border", "bottle", "autumn", "victim", "editor", "stress",
    "wealth", "parent", "decade", "height", "writer", "taylor", "clause", "worker", "empire", "notion", "mirror", "travel", "regime", "circle", "pocket",
    "module", "affair", "winner", "breach", "finger", "throat", "phrase", "holder", "canada", "defeat", "joseph", "origin", "shadow", "device", "tennis",
    "jacket", "column", "guitar", "signal", "poetry", "camera", "maggie", "string", "tenant", "burden", "cattle", "studio", "cheese", "summit", "carbon",
    "stream", "berlin", "medium", "ulster", "cotton", "heaven", "farmer", "tongue", "petrol", "walker", "timber", "oliver", "tunnel", "lesson", "norman",
    "carpet", "humour", "lawyer", "miller", "strain", "honour", "turkey", "flower", "glance", "ticket", "secret", "fabric", "format", "female", "chapel",
    "butter", "talent", "prayer", "export", "tissue", "temple", "dollar", "priest", "horror", "wright", "equity", "garage", "salary", "warmth", "gender",
    "cheque", "harris", "weapon", "seller", "cinema", "oxygen", "launch", "escape", "resort", "virtue", "morgan", "wonder", "fellow", "desert", "morris",
    "planet", "copper", "symbol", "excess", "dealer", "muscle", "singer", "stance", "cousin", "spread", "regard", "brazil", "infant", "domain", "switch",
    "rescue", "whisky", "surrey", "excuse", "reward", "breast", "pardon", "arrest", "button", "avenue", "finish", "johnny", "wisdom", "virgin", "german",
    "daniel", "toilet", "newton", "bronze", "repair", "filter", "rhythm", "vendor", "margin", "custom", "jordan", "shower", "matrix", "clinic", "bureau",
    "terror", "salmon", "comedy", "vessel", "merger", "supper", "killer", "coffin", "lounge", "keeper", "clergy", "server", "accent", "collar", "butler",
    "soccer", "breeze", "remedy", "carter", "trophy", "senate", "hunter", "marble", "diesel", "stroke", "orange", "ladder", "powder", "basket", "willie",
    "thesis", "layout", "ballet", "misery", "script", "needle", "murray", "legend", "sphere", "liquid", "gravel", "throne", "cooper", "remark", "fusion",
    "turner", "entity", "parker", "handle", "intake", "praise", "manual", "intent", "inside", "packet", "temper", "porter", "darwin", "pencil", "colony",
    "critic", "claire", "victor", "canvas", "hunger", "racism", "jersey", "knight", "sophie", "steven", "gospel", "legacy", "genius", "double", "bailey",
    "mucosa", "census", "parade", "accord", "nelson", "hatred", "shield", "motive", "outset", "recipe", "madame", "plasma", "bucket", "hammer", "quarry",
    "ballot", "murphy", "franco", "morale", "pepper", "sheila", "patent", "import", "tumour", "fringe", "chorus", "heroin", "jungle", "asylum", "vacuum",
    "sleeve", "unrest", "refuge", "ritual", "sodium", "fridge", "burial", "fossil", "debtor", "strand", "drawer", "armour", "statue", "common", "patten",
    "warren", "dragon", "cherry", "velvet", "potato", "luxury", "thrust", "barrel", "brandy", "kettle", "travis", "palmer", "fisher", "elaine", "gossip",
    "burton", "outfit", "combat", "joanna", "biopsy", "advent", "decree", "poison", "thread", "garlic", "hazard", "candle", "sewage", "foster", "cruise",
    "little", "patron", "hamlet", "corpse", "jockey", "debris", "patrol", "ernest", "insect", "dexter", "enzyme", "mosaic", "denial", "poster", "tomato",
    "purity", "corpus", "revolt", "circus", "header", "stitch", "nephew", "plight", "parcel", "lawson", "guinea", "waiter", "warden", "demise", "boiler",
    "soviet", "bullet", "single", "oracle", "runner", "voyage", "gentry", "tariff", "litter", "saddle", "vector", "marker", "helmet", "excise", "spider",
    "meadow", "pillow", "bowler", "gloria", "tenure", "famine", "bundle", "warsaw", "stella", "radius", "rumour", "asthma", "cellar", "auntie", "ribbon",
    "defect", "melody", "regret", "cannon", "spouse", "mickey", "henley", "climax", "campus", "recall", "herald", "rocket", "galaxy", "picnic", "torque",
    "baxter", "hockey", "granny", "socket", "sierra", "bomber", "cement", "potter", "kidney", "sketch", "brooke", "ordeal", "barley", "coupon", "syntax",
    "divide", "dancer", "outlet", "regent", "clough", "sherry", "pistol", "wallet", "trader", "banker", "stereo", "violin", "tackle", "fender",
    "wicket", "convoy", "escort", "mantle", "monkey", "bypass", "michel", "buffet", "banner", "update", "sunset", "sorrow", "mister", "legion", "hurdle",
    "saloon", "squash", "talbot", "trench", "vigour", "hostel", "mortar", "rubber", "dismay", "heater", "cooker", "banana", "trauma", "mutant", "jumper",
    "hector", "barton", "warner", "winger", "jargon", "shrine", "outing", "donkey", "center", "puzzle", "midday", "runway", "jaguar", "pledge", "harper",
    "scream", "plague", "embryo", "rector", "canopy", "anchor", "pastry", "bubble", "savage", "upside", "groove", "menace", "insult", "vapour", "barrow",
    "ascent", "reflux", "serial", "blouse", "repeat", "rental", "cereal", "stride", "slogan", "suburb", "replay", "sultan", "pillar", "caesar", "viewer",
    "grange", "viking", "roller", "marina", "sailor", "plaque", "homage", "advert", "glider", "novice", "jasper", "gamble", "liquor", "priory", "barber",
    "goblin", "sponge", "fowler", "tactic", "polish", "slater", "barker", "cuckoo", "bidder", "exodus", "cavity", "streak", "thrill", "weaver", "unease",
    "lender", "clutch", "tallis", "storey", "bugger", "pigeon", "scorer", "fright", "bonnet", "influx", "currie", "phoebe", "hollow", "freeze", "yellow",
    "sudden", "fulham", "hooker", "sermon", "misuse", "tarmac", "tanker", "parity", "racket", "esteem", "cassie", "hearth", "violet", "carrot", "gutter",
    "parrot", "barnet", "assent", "matron", "tavern", "spiral", "cortex", "vanity", "rubble", "stroud", "golfer", "creole", "cohort", "amazon", "uptake",
    "splash", "portal", "gallon", "ridley", "caller", "walnut", "upland", "finale", "tablet", "cradle", "covent", "arcade", "hopper", "grease", "willow",
    "cursor", "jumble", "dinghy", "cutter", "pickup", "pollen", "badger", "wizard", "folder", "expiry", "thorpe", "stable", "coward", "almond", "apollo",
    "gummer", "squire", "brewer", "sheikh", "artery", "archie", "enamel", "cowboy", "faeces", "malice", "magnet", "trough", "settee", "barney", "scotch",
    "lionel", "garvey", "uplift", "marrow", "argyll", "tiller", "karate", "beacon", "anthem", "saucer", "plough", "bunker", "crunch", "raffle", "incest",
    "mobile", "riddle", "ferret", "staple", "digest", "mosque", "sexism", "median", "ledger", "helper", "umpire", "piazza", "unison", "ginger",
    "puppet", "murmur", "tucker", "tailor", "fungus", "myriad", "manure", "cobalt", "barman", "opener", "becker", "livery", "lesion", "tandem", "thirst",
    "rarity", "dobson", "stroll", "ransom", "millie", "thrush", "retina", "bamboo", "mammal", "craven", "dalton", "connie", "seaman", "jigsaw", "frenzy",
    "hassle", "bakery", "cartel", "crater", "nausea", "alaska", "falcon", "dagger", "plunge", "flurry", "harrow", "strife", "apathy", "schema", "gunman",
    "outcry", "sprint", "papacy", "deacon", "rudder", "daphne", "refuse", "trifle", "tangle", "martyr", "alkali", "pulpit", "stigma", "pirate",
    "bumper", "burrow", "jessie", "witney", "beetle", "hooper", "hoover", "sequel", "mentor", "stench", "turtle", "parody", "feeder", "condom", "canyon",
    "volley", "facade", "remand", "sanity", "parson", "subset", "maiden", "quartz", "orient", "bryony", "curate", "locker", "fiasco", "curfew", "tundra",
    "bleach", "sonata", "galley", "bearer", "heyday", "spence", "manila", "teapot", "upturn", "psyche", "ration", "hearer", "caddie", "rattle", "canary",
    "outlay", "zenith", "pastor", "primer", "refund", "yogurt", "saliva", "salute", "parole", "botany", "bridle", "sender", "kitten", "maggot",
    "mercer", "safari", "permit", "enigma", "pellet", "octave", "kinase", "spruce", "shrimp", "uproar", "nether", "hangar", "recess", "picket", "beggar",
    "mousse", "helium", "dieter", "parkin", "hybrid", "ghetto", "casino", "claret", "heresy", "bother", "bazaar", "oyster", "ambush", "foetus", "clover",
    "affect", "utopia", "fodder", "orchid", "tender", "ripple", "burger", "rigour", "draper", "prompt", "lizard", "backup", "sensor", "wicker", "occult",
    "relish", "closet", "binder", "bertha", "tensor", "shaikh", "ribber", "muddle", "slough", "surety", "mutiny", "kernel", "fiddle", "sonnet", "reggae",
    "repeal", "carver", "proton", "reflex", "louvre", "amelia", "tycoon", "laurel", "insert", "fleece", "rebate", "hernia", "lagoon", "trance", "tremor",
    "grouse", "tardis", "glover", "satire", "resale", "collor", "lotion", "genome", "airbus", "celery"
];

class NounPool {
    private available: string[];
    private used: Set<string> = new Set();

    constructor() {
        this.available = [...STATIC_WORDS];
        this.shuffle();
    }

    private shuffle(): void {
        for (let i = this.available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.available[i], this.available[j]] = [this.available[j], this.available[i]];
        }
    }

    pull(n: number): string[] {
        const result: string[] = [];
        for (let i = 0; i < n && this.available.length > 0; i++) {
            const word = this.available.pop()!;
            this.used.add(word);
            result.push(word);
        }
        return result;
    }

    pullExcluding(n: number, forbidden: Set<string>): string[] {
        const result: string[] = [];
        const tempReturned: string[] = [];

        while (result.length < n && this.available.length > 0) {
            const word = this.available.pop()!;
            if (forbidden.has(word)) {
                tempReturned.push(word);
            } else {
                this.used.add(word);
                result.push(word);
            }
        }

        this.available.push(...tempReturned);

        return result;
    }

    reset(): void {
        this.available = [...STATIC_WORDS];
        this.used.clear();
        this.shuffle();
    }

    getUsed(): Set<string> {
        return new Set(this.used);
    }
}

const partitionCache = new Map<string, number[][]>();

function integerPartitionsWithConstraint(n: number, k: number, constraint: (x: number) => boolean): number[][] {
    const cacheKey = `${n}-${k}-constrained`;
    if (partitionCache.has(cacheKey)) {
        return partitionCache.get(cacheKey)!;
    }

    const result: number[][] = [];

    function backtrack(remaining: number, parts: number[]): void {
        if (parts.length === k) {
            if (remaining === 0) {
                result.push([...parts]);
            }
            return;
        }

        for (let i = 0; i <= remaining; i++) {
            if (constraint(i)) {
                parts.push(i);
                backtrack(remaining - i, parts);
                parts.pop();
            }
        }
    }

    backtrack(n, []);
    partitionCache.set(cacheKey, result);
    return result;
}

function isValidTriplet(att: number, agg: number, group: number): boolean {
    if (att + agg === 0) return false;
    if (agg > 0 && group === 0 && att > 0) return false;
    if (agg > 0 && att > 0 && group < att) return false;
    if (group > 0 && agg === 0) return false;
    return true;
}
function precomputeAllValidTripletSequences(
    numberQueries: number,
    totalCosts: number
): Triplet[][] {
    const remainingCosts = totalCosts - BASE_COLUMNS;
    if (remainingCosts <= 0) return [];

    const costPartitions = integerPartitionsWithConstraint(
        remainingCosts,
        numberQueries,
        (n) => n > 1
    );

    const allValidSequences: Triplet[][] = [];

    for (const costPartition of costPartitions) {
        const tripletOptionsPerQuery: Triplet[][] = [];

        for (const queryCost of costPartition) {
            const validTriplets: Triplet[] = [];

            for (let att = 0; att <= queryCost; att++) {
                for (let agg = 0; agg <= Math.floor((queryCost - att) / 2); agg++) {
                    const group = queryCost - att - 2 * agg;
                    if (group >= 0 && isValidTriplet(att, agg, group)) {
                        validTriplets.push([att, agg, group]);
                    }
                }
            }

            if (validTriplets.length === 0) {
                break;
            }
            tripletOptionsPerQuery.push(validTriplets);
        }

        if (tripletOptionsPerQuery.length !== numberQueries) continue;

        const cartesianProduct = cartesian(tripletOptionsPerQuery);

        for (const sequence of cartesianProduct) {
            if (isValidSequence(sequence)) {
                allValidSequences.push(sequence);
            }
        }
    }

    return allValidSequences;
}
function cartesian(arrays: Triplet[][]): Triplet[][] {
    if (arrays.length === 0) return [[]];

    const result: Triplet[][] = [];
    function helper(current: Triplet[], depth: number): void {
        if (depth === arrays.length) {
            result.push([...current]);
            return;
        }

        for (const triplet of arrays[depth]) {
            current.push(triplet);
            helper(current, depth + 1);
            current.pop();
        }
    }

    helper([], 0);
    return result;
}
function isValidSequence(sequence: Triplet[]): boolean {
    let availableCols: number = BASE_COLUMNS;

    for (const [att, agg, group] of sequence) {
        if (att > availableCols) return false;

        if (group > availableCols) return false;

        const aggregatableCols = availableCols - group;
        if (agg > 0 && aggregatableCols <= 0) return false;
        if (agg > aggregatableCols * AGG_FUNCTIONS.length) return false;

        availableCols = att + agg;

        if (availableCols === 0) return false;
    }

    return true;
}
function returnColumnsOfQuery(q: Query): string[] {
    return [...q.attributes, ...q.aggregates.map(a => a.rename)];
}
function injectError(
    root: Query,
    errorType: ErrorType,
    errorCost: number,
    nounPool: NounPool
): Query | null {
    if (errorCost <= 0 || errorType === "NoError") {
        return root;
    }

    const chain = getQueryChain(root);
    if (chain.length === 0) return null;

    const baseNouns = new Set<string>(chain[0].attributes);
    let costCounter = 0;

    const generateNewNoun = (): string => {
        const forbidden = new Set([...baseNouns, ...nounPool.getUsed()]);
        const nouns = nounPool.pullExcluding(1, forbidden);
        return nouns[0] || `unknown_${Math.random().toString(36).slice(2, 8)}`;
    };

    for (const q of chain) {
        switch (errorType) {
            case "SELECT_UNKNOWN": {
                const onlySelect = q.aggregates.length === 0 && q.group_by.length === 0;

                for (let i = 0; i <= q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        if (!onlySelect) return null;

                        const name = generateNewNoun();
                        q.attributes.splice(i, 0, name);
                        q.errorMarker = { type: "SELECT_UNKNOWN", role: "ATTR", index: i };
                        return root;
                    }
                    if (i < q.attributes.length) costCounter += 1;
                }

                for (let i = 0; i < q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1; 
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1; 
                }

                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1;
                }
                break;
            }

            case "AGG_UNKNOWN": {
                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1;
                }

                for (let i = 0; i <= q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        if (q.attributes.length > 0 && q.group_by.length === 0) return null;

                        const unknownCol = generateNewNoun();
                        const aliasNoun = generateNewNoun();

                        const agg = new Aggregate();
                        agg.function = AGG_FUNCTIONS[Math.floor(Math.random() * AGG_FUNCTIONS.length)];
                        agg.attribute = unknownCol;
                        agg.rename = aliasNoun;

                        q.aggregates.splice(i, 0, agg);
                        q.errorMarker = { type: "AGG_UNKNOWN", role: "AGG", index: i };
                        return root;
                    }
                    if (i < q.aggregates.length) {
                        costCounter += 2; 
                    }
                }

                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1;
                }
                break;
            }

            case "GROUP_UNKNOWN": {
                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1;
                }

                for (let i = 0; i < q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1; 
                    if (costCounter + 1 === errorCost) return null;
                    costCounter += 1;
                }

                for (let i = 0; i <= q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        const name = generateNewNoun();
                        q.group_by.splice(i, 0, name);
                        q.errorMarker = { type: "GROUP_UNKNOWN", role: "GROUP", index: i };
                        return root;
                    }
                    if (i < q.group_by.length) costCounter += 1;
                }
                break;
            }
        }
    }

    return null;
}
function getQueryChain(root: Query): Query[] {
    const chain: Query[] = [];
    let current: Query | null = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();
    return chain;
}
function computeErrorCostPipe(root: Query): number | null {
    const chain = getQueryChain(root);
    let costCounter = 0;

    for (const q of chain) {
        const hasAgg = q.aggregates.length > 0;
        const marker = q.errorMarker;

        if (!hasAgg) {
            if (marker && marker.role === "ATTR") {
                costCounter += marker.index + 1;
                return costCounter;
            }
            costCounter += q.attributes.length;
            continue;
        }

        if (marker) {
            switch (marker.role) {
                case "AGG":
                    costCounter += marker.index * 2 + 1;
                    return costCounter;
                case "GROUP":
                    costCounter += q.aggregates.length * 2 + marker.index + 1;
                    return costCounter;
                case "ATTR":
                    return null;
            }
        }

        costCounter += q.aggregates.length * 2 + q.group_by.length;
    }

    return null;
}
function getUnknownNameFromError(root: Query): string | null {
    const chain = getQueryChain(root);
    for (const q of chain) {
        if (q.errorMarker) {
            switch (q.errorMarker.role) {
                case "ATTR": return q.attributes[q.errorMarker.index] ?? null;
                case "GROUP": return q.group_by[q.errorMarker.index] ?? null;
                case "AGG": return q.aggregates[q.errorMarker.index]?.attribute ?? null;
            }
        }
    }
    return null;
}

function lineHasExactIdentifier(line: string, ident: string): boolean {
    const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`);
    return pattern.test(line);
}
function queryToCteSql(root: Query): string {
    const chain = getQueryChain(root);
    const ctes: string[] = [];
    let lastSourceName = "base";

    for (let i = 0; i < chain.length; i++) {
        const q = chain[i];
        const selectParts: string[] = [
            ...q.attributes,
            ...q.aggregates.map(a => `${a.function}(${a.attribute}) AS ${a.rename}`)
        ];

        const selectLines = selectParts.map(p => `  ${p}`);
        const selectClause = `SELECT\n${selectLines.join(",\n")}`;

        let groupByClause = "";
        if (q.group_by.length > 0) {
            const groupLines = q.group_by.map(col => `  ${col}`);
            groupByClause = `\nGROUP BY\n${groupLines.join(",\n")}`;
        }

        const selectSql = `${selectClause}\nFROM ${lastSourceName}${groupByClause}`;
        const cteName = `cte_${i}`;

        const indentedSelectSql = selectSql.split("\n").map(line => "  " + line).join("\n");
        ctes.push(`${cteName} AS (\n${indentedSelectSql}\n)`);

        lastSourceName = cteName;
    }

    return ctes.length > 0
        ? `WITH\n${ctes.join(",\n")}\n SELECT * \n FROM ${lastSourceName};`
        : `SELECT * FROM ${lastSourceName};`;
}

function queryToPipeSql(root: Query): string {
    const chain = getQueryChain(root);
    const lines: string[] = ["FROM base"];

    for (const q of chain) {
        const hasAgg = q.aggregates.length > 0;
        const hasGroup = q.group_by.length > 0;
        const hasAttr = q.attributes.length > 0;

        if (!hasAgg && !hasGroup) {
            if (hasAttr) {
                lines.push("|> SELECT");
                lines.push(q.attributes.map(a => `     ${a}`).join(",\n"));
            }
            continue;
        }

        if (hasAgg && !hasGroup && !hasAttr) {
            lines.push("|> AGGREGATE");
            lines.push(q.aggregates.map(a => `     ${a.function}(${a.attribute}) AS ${a.rename}`).join(",\n"));
            continue;
        }

        lines.push("|> AGGREGATE");
        if (q.aggregates.length > 0) {
            lines.push(q.aggregates.map(a => `     ${a.function}(${a.attribute}) AS ${a.rename}`).join(",\n"));
        }
        if (hasGroup) {
            lines.push("   GROUP BY");
            lines.push(q.group_by.map(col => `     ${col}`).join(",\n"));
        }
    }

    lines.push("|> SELECT *");
    return lines.join("\n");
}

function buildQueryFromTripletSequence(
    tripletSequence: Triplet[],
    nounPool: NounPool
): Query | null {
    const baseQuery = new Query();
    baseQuery.attributes = nounPool.pull(BASE_COLUMNS);

    let currentQuery = baseQuery;
    let currentColumns = [...baseQuery.attributes];
    const globalUsedAggCombos = new Set<string>();

    for (const [attCount, aggCount, groupCount] of tripletSequence) {
        const q = new Query();
        q.from = currentQuery;

        const availableColumns = [...currentColumns];

        q.attributes = availableColumns.slice(0, attCount);
        q.group_by = availableColumns.slice(0, groupCount);

        const groupSet = new Set(q.group_by);
        const aggregatableColumns = availableColumns.filter(c => !groupSet.has(c));

        if (aggCount > 0 && aggregatableColumns.length === 0) {
            return null;
        }

        const aggregates: Aggregate[] = [];

        for (let i = 0; i < aggCount; i++) {
            const candidates: { func: (typeof AGG_FUNCTIONS)[number]; col: string }[] = [];

            for (const col of aggregatableColumns) {
                for (const func of AGG_FUNCTIONS) {
                    const key = `${func}|${col}`;
                    if (!globalUsedAggCombos.has(key)) {
                        candidates.push({ func, col });
                    }
                }
            }

            if (candidates.length === 0) {
                return null;
            }

            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            globalUsedAggCombos.add(`${choice.func}|${choice.col}`);

            const aliasNouns = nounPool.pull(1);
            if (aliasNouns.length === 0) {
                return null;
            }

            const agg = new Aggregate();
            agg.function = choice.func;
            agg.attribute = choice.col;
            agg.rename = aliasNouns[0]; 
            aggregates.push(agg);
        }

        q.aggregates = aggregates;
        currentQuery = q;
        currentColumns = returnColumnsOfQuery(q);
    }

    return currentQuery;
}
function generateQuery(
    precomputedSequences: Triplet[][],
    errorType: ErrorType,
    errorCost: number | undefined,
    desiredDiff: number,
    totalCosts: number
): SqlGenerationResult | null {
    const shuffledIndices = [...Array(precomputedSequences.length).keys()];
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }

    for (const idx of shuffledIndices) {
        const tripletSequence = precomputedSequences[idx];
        const nounPool = new NounPool();

        let root = buildQueryFromTripletSequence(tripletSequence, nounPool);
        if (!root) continue;

        if (root.total_costs_CTE() !== totalCosts) continue;

        let pipeErrorCost: number | null = null;
        const isErrorCase = errorType && errorType !== "NoError";

        if (isErrorCase && typeof errorCost === "number") {
            const modified = injectError(root, errorType, errorCost, nounPool);
            if (!modified) continue;
            root = modified;
            pipeErrorCost = computeErrorCostPipe(root);
        }

        let expectedCostIncrease = 0;
        if (isErrorCase) {
            expectedCostIncrease = errorType === "AGG_UNKNOWN" ? 2 : 1;
        }
        const expectedCost = totalCosts + expectedCostIncrease;

        if (root.total_costs_CTE() !== expectedCost) continue;

        const totalInformationSQL = expectedCost;
        const totalInformationPipe = root.total_costs_pipe();

        let diff: number | null = null;
        if (isErrorCase) {
            if (typeof errorCost === "number" && pipeErrorCost != null) {
                diff = Math.abs(errorCost - pipeErrorCost);
            }
        } else {
            diff = totalInformationSQL - totalInformationPipe;
        }

        if (diff === null || diff !== desiredDiff) continue;

        const sql = queryToCteSql(root);
        const pipeSql = queryToPipeSql(root);
        const unknownName = getUnknownNameFromError(root);
        const chain = getQueryChain(root);

        let cteErrorLine: number | null = null;
        let pipeErrorLine: number | null = null;

        if (unknownName) {
            const cteLines = sql.split("\n");
            for (let i = 0; i < cteLines.length; i++) {
                if (lineHasExactIdentifier(cteLines[i], unknownName)) {
                    cteErrorLine = i + 1;
                    break;
                }
            }

            const pipeLines = pipeSql.split("\n");
            for (let i = 0; i < pipeLines.length; i++) {
                if (lineHasExactIdentifier(pipeLines[i], unknownName)) {
                    pipeErrorLine = i + 1;
                    break;
                }
            }
        }

        return {
            sql,
            pipeSql,
            cteErrorCost: errorCost,
            pipeErrorCost,
            diff,
            totalInformationSQL,
            totalInformationPipe,
            unknownName,
            errorType,
            numberQueries_excludingBase: chain.length - 1,
            columnsBaseQuery: chain[0]?.attributes.length ?? BASE_COLUMNS,
            cteErrorLine,
            pipeErrorLine
        };
    }

    return null;
}

const desiredDiffs: number[] = [0, 4, 8];
const errorTypes: ErrorType[] = ["SELECT_UNKNOWN", "AGG_UNKNOWN", "GROUP_UNKNOWN"];
const totalCosts = 33;
const errorCost = 26;
const numberQueries = 4;
const repetitionsPerCombo = 100;
const triesLimitPerCombo = 1000; 


const precomputedSequences = precomputeAllValidTripletSequences(numberQueries, totalCosts);

const resultArray: ResultRow[] = [];

for (const et of errorTypes) {
    for (const diffTarget of desiredDiffs) {
        let localTries = 0;
        let produced = 0;

        const startCombo = Date.now();

        while (produced < repetitionsPerCombo && localTries < triesLimitPerCombo) {
            localTries++;

            const gen = generateQuery(
                precomputedSequences,
                et,
                et === "NoError" ? undefined : errorCost,
                diffTarget,
                totalCosts
            );

            if (gen != null) {
                resultArray.push({
                    sqlQuery: gen.sql,
                    pipeQuery: gen.pipeSql,
                    totalInformationSQL: gen.totalInformationSQL,
                    totalInformationPipe: gen.totalInformationPipe,
                    totalInformationUntilErrorSQL: gen.cteErrorCost ?? null,
                    totalInformationUntilErrorPipe: gen.pipeErrorCost ?? null,
                    errorType: gen.errorType ?? null,
                    totalInformationDifference: gen.diff ?? null,
                    unknownName: gen.unknownName,
                    numberQueries_excludingBase: gen.numberQueries_excludingBase,
                    columnsBaseQuery: gen.columnsBaseQuery,
                    errorLineSQL: gen.cteErrorLine ?? null,
                    errorLinePipe: gen.pipeErrorLine ?? null
                });
                produced++;
            }
        }
    }
}

export type Row = {
    sqlQuery: string;
    pipeQuery: string;
    totalInformationSQL: number;
    totalInformationPipe: number;
    totalInformationUntilErrorSQL: number | string | null;
    totalInformationUntilErrorPipe: number | string | null;
    errorType: string;
    totalInformationDifference: number;
    unknownName: string;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;
    errorLineSQL: number | string;
    errorLinePipe: number | string;
};

function toRow(r: ResultRow): Row {
    return {
        sqlQuery: r.sqlQuery,
        pipeQuery: r.pipeQuery,
        totalInformationSQL: r.totalInformationSQL,
        totalInformationPipe: r.totalInformationPipe,
        totalInformationUntilErrorSQL: r.totalInformationUntilErrorSQL ?? null,
        totalInformationUntilErrorPipe: r.totalInformationUntilErrorPipe ?? null,
        errorType: (r.errorType ?? "null") as string,
        totalInformationDifference: (r.totalInformationDifference ?? 0) as number,
        unknownName: (r.unknownName ?? "null") as string,
        numberQueries_excludingBase: r.numberQueries_excludingBase,
        columnsBaseQuery: r.columnsBaseQuery,
        errorLineSQL: (r.errorLineSQL ?? "null") as number | string,
        errorLinePipe: (r.errorLinePipe ?? "null") as number | string,
    };
}

function writeResultsTs(rows: ResultRow[], outPath = "resultArray20Reps.ts") {
    const mapped = rows.map(toRow);

    const fileContent =
        `export type Row = {\n` +
        `    sqlQuery: string;\n` +
        `    pipeQuery: string;\n` +
        `    totalInformationSQL: number;\n` +
        `    totalInformationPipe: number;\n` +
        `    totalInformationUntilErrorSQL: number | string | null;\n` +
        `    totalInformationUntilErrorPipe: number | string | null;\n` +
        `    errorType: string;\n` +
        `    totalInformationDifference: number;\n` +
        `    unknownName: string;\n` +
        `    numberQueries_excludingBase: number;\n` +
        `    columnsBaseQuery: number;\n` +
        `    errorLineSQL: number | string;\n` +
        `    errorLinePipe: number | string;\n` +
        `};\n\n` +
        `export type QueryKind = "sql" | "pipe";\n\n` +
        `export type Entry = Row & { queryKind: QueryKind };\n\n` +
        `export const resultArray20Reps: Row[] =\n` +
        `${JSON.stringify(mapped, null, 4)};\n\n` +
        `const unescape = (s: string) =>\n` +
        `    s\n` +
        `        .replace(/\\\\r\\\\n/g, "\\n")\n` +
        `        .replace(/\\\\n/g, "\\n")\n` +
        `        .replace(/\\\\r/g, "\\n")\n` +
        `        .replace(/\\\\t/g, "\\t");\n\n` +
        `export const formatted: Row[] = resultArray20Reps.map((r) => ({\n` +
        `    ...r,\n` +
        `    sqlQuery: unescape(r.sqlQuery),\n` +
        `    pipeQuery: unescape(r.pipeQuery),\n` +
        `}));\n\n`;

    fs.writeFileSync(outPath, fileContent, "utf8");
}

writeResultsTs(resultArray, "queries100RepsMainExperiment.ts");
