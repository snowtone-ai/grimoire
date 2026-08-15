// The .ts extension keeps this import resolvable by Node's type-stripping
// test runner (node --test) as well as the Next bundler.
import { PLANT_SPECIES, type PlantSpecies } from "./plant.ts";

/* Material-drop reward domain — pure functions, no side effects.
 *
 * Completing a quest (task) rolls exactly one drop, Monster-Hunter style:
 * an unpredictable material reward at the moment of completion. Rarity is a
 * full RARE 1-8 ladder (like MHW), with a material pool at every rank so the
 * scale has no gaps. Higher ranks are exponentially rarer. The two seasonal
 * anchors keep their ranks (RARE4 = the month's flower, RARE8 = its vista);
 * ranks 2/3/5/6/7 are generic frozen-survey materials. Anti-frustration rules:
 * - Pity: PITY_LIMIT rolls without a RARE8 guarantees the next one.
 * - First roll of the day is floored to RARE4 (a reason to start today).
 * Drops are never revoked (no punishment). */

export type DropRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DropDef {
  id: string;
  rarity: DropRarity;
  name: string;
  flavor: string;
  /** RARE1/RARE4 use an emoji icon; RARE8 uses a photo. */
  emoji?: string;
  photo?: string;
  /** Season month for RARE4/RARE8 (drives the current-month weighting). */
  month?: number;
  color: string;
}

/** RARE1 — common gathering materials of the frozen survey region. */
export const COMMON_DROPS: DropDef[] = [
  { id: "c-yukinoshita", rarity: 1, name: "ユキノシタソウ", emoji: "🌿", color: "#8fbf9f", flavor: "雪の下でも枯れない、強い草" },
  { id: "c-kooribana",   rarity: 1, name: "コオリバナ",     emoji: "❄️", color: "#9fd3e8", flavor: "息を吹きかけると溶けて光る" },
  { id: "c-toudokinoko", rarity: 1, name: "トウドキノコ",   emoji: "🍄", color: "#d4907a", flavor: "凍土の岩陰にひっそり生える" },
  { id: "c-shimofuri",   rarity: 1, name: "シモフリムギ",   emoji: "🌾", color: "#d8c98a", flavor: "霜の朝にだけ穂を出す" },
  { id: "c-reikanomi",   rarity: 1, name: "レイカノミ",     emoji: "🫐", color: "#7a8fd4", flavor: "冷気を蓄えた、甘い実" },
  { id: "c-hidamari",    rarity: 1, name: "ヒダマリギク",   emoji: "🌼", color: "#f0d060", flavor: "吹雪の合間の陽だまりに咲く" },
  { id: "c-hikarigoke",  rarity: 1, name: "ヒカリゴケ",     emoji: "🌱", color: "#a0e8c0", flavor: "洞窟の壁で青白く光る" },
  { id: "c-yugetsubaki", rarity: 1, name: "ユゲツバキ",     emoji: "🌺", color: "#e88a9a", flavor: "温泉の湯気を浴びて育つ椿" },
  { id: "c-suishousou",  rarity: 1, name: "スイショウソウ", emoji: "🧊", color: "#b0d8f0", flavor: "氷の結晶とそっくりの草" },
  { id: "c-kazekusa",    rarity: 1, name: "カゼクサ",       emoji: "🍃", color: "#90c890", flavor: "風の通り道を教えてくれる" },
  { id: "c-koyukizakura",rarity: 1, name: "コユキザクラ",   emoji: "🌸", color: "#f0c0d0", flavor: "粉雪のような小さな花" },
  { id: "c-hoshikuzu",   rarity: 1, name: "ホシクズタケ",   emoji: "✨", color: "#e8d890", flavor: "夜になると星屑のように光る" },
  { id: "c-matsubayuki",        rarity: 1, name: "マツバユキソウ",     emoji: "🌿", color: "#8fc49f", flavor: "松葉に似た葉で寒さをしのぐ" },
  { id: "c-koorimoichigo",      rarity: 1, name: "コオリイチゴ",       emoji: "🍓", color: "#e8a8b8", flavor: "凍っても甘みを保つ野いちご" },
  { id: "c-shimobashirasou",    rarity: 1, name: "シモバシラソウ",     emoji: "🌾", color: "#d9d0b5", flavor: "根元に霜柱を作る不思議な草" },
  { id: "c-fubukiazami",        rarity: 1, name: "フブキアザミ",       emoji: "🌸", color: "#d3b3e0", flavor: "吹雪でも茎を折らない薊" },
  { id: "c-kokemomo",           rarity: 1, name: "コケモモの実",       emoji: "🫐", color: "#a85a78", flavor: "酸味の強い赤い小さな実" },
  { id: "c-yamiginryou",        rarity: 1, name: "ヤミギンリョウソウ", emoji: "🍄", color: "#d8d8d2", flavor: "光の届かぬ場所に生える白い茸" },
  { id: "c-hatsuyukina",        rarity: 1, name: "ハツユキナ",         emoji: "🌿", color: "#c8e8d2", flavor: "初雪の頃だけ甘くなる野菜" },
  { id: "c-sazaregoke",         rarity: 1, name: "サザレゴケ",         emoji: "🌱", color: "#a8c8b2", flavor: "砂利の隙間を覆う丈夫な苔" },
  { id: "c-touhiwakaba",        rarity: 1, name: "トウヒワカバ",       emoji: "🌲", color: "#7fa878", flavor: "凍て地でも常緑を保つ針葉の芽" },
  { id: "c-karamatsushizuku",   rarity: 1, name: "カラマツシズク",     emoji: "💧", color: "#cfe0e8", flavor: "落葉松の枝先で凍る樹液の粒" },
  { id: "c-iwachousou",         rarity: 1, name: "イワチョウソウ",     emoji: "🌼", color: "#f0e8d2", flavor: "岩の隙間で咲く白い八弁花" },
  { id: "c-minehaigoke",        rarity: 1, name: "ミネハイゴケ",       emoji: "🌱", color: "#93c2a0", flavor: "尾根の岩を這うように広がる苔" },
  { id: "c-yukiazukigusa",      rarity: 1, name: "ユキアズキグサ",     emoji: "🌾", color: "#d8bcae", flavor: "小豆に似た実をつける耐寒草" },
  { id: "c-kanransou",          rarity: 1, name: "カンランソウ",       emoji: "🌿", color: "#7ab894", flavor: "寒さに強い、蘭に似た葉の草" },
  { id: "c-tsuraraansou",       rarity: 1, name: "ツララランソウ",     emoji: "🌿", color: "#a7d6ea", flavor: "氷柱のように垂れて咲く蘭" },
  { id: "c-togarigiku",         rarity: 1, name: "トガリギク",         emoji: "🌼", color: "#e8dcae", flavor: "花びらの縁だけ尖って色づく菊" },
  { id: "c-yukiwarisou",        rarity: 1, name: "ユキワリソウ",       emoji: "🌸", color: "#e8b8c8", flavor: "雪解けの隙間から顔を出す花" },
  { id: "c-kanbanoshinme",      rarity: 1, name: "カンバノシンメ",     emoji: "🌿", color: "#b8d0a0", flavor: "白樺の若い芽。強い香りがする" },
  { id: "c-yukigurumi",         rarity: 1, name: "ユキグルミの実",     emoji: "🌰", color: "#c8a878", flavor: "殻の硬い、凍て地特有の胡桃" },
  { id: "c-hyourindou",         rarity: 1, name: "ツララリンドウ",     emoji: "💠", color: "#6a8fd0", flavor: "青紫の花を短い夏に一度だけ咲かせる" },
  { id: "c-fuyuzansou",         rarity: 1, name: "フユザンソウ",       emoji: "🌿", color: "#92b090", flavor: "根に養分を蓄えて冬を越す草" },
  { id: "c-shiratamakinoko",    rarity: 1, name: "シロタマキノコ",     emoji: "🍄", color: "#e0ded8", flavor: "白く丸い、雪玉のようなきのこ" },
  { id: "c-koorinori",          rarity: 1, name: "コオリノリ",         emoji: "🌿", color: "#9fd0c0", flavor: "湖底で育つ、凍えても枯れない藻" },
  { id: "c-seppigoke",          rarity: 1, name: "セッピゴケ",         emoji: "🌱", color: "#b0d8c8", flavor: "雪庇の下、湿った岩に張りつく苔" },
  { id: "c-shicchigusa",        rarity: 1, name: "シッチグサ",         emoji: "🌾", color: "#cfc79a", flavor: "凍土の湿地に根を張る細い草" },
  { id: "c-himesetsugenazami",  rarity: 1, name: "ヒメセツゲンアザミ", emoji: "🌸", color: "#d0a0c8", flavor: "雪原に低く咲く小さな薊" },
  { id: "c-shirafujimame",      rarity: 1, name: "シラフジマメ",       emoji: "🌿", color: "#b0a8d8", flavor: "白い花をつける耐寒性のつる豆" },
  { id: "c-koorisumire",        rarity: 1, name: "コオリスミレ",       emoji: "🌸", color: "#8898d0", flavor: "早春の霜の中で咲く小さな菫" },
  { id: "c-yamabukigoke",       rarity: 1, name: "ヤマブキゴケ",       emoji: "🌱", color: "#d0c060", flavor: "黄金色に輝く、乾いた岩の苔" },
  { id: "c-yukigumi",           rarity: 1, name: "ユキグミの実",       emoji: "🫐", color: "#c07888", flavor: "強い酸味を持つ、赤い偽果" },
  { id: "c-kanzashigusa",       rarity: 1, name: "カンザシグサ",       emoji: "🌾", color: "#d8c8a0", flavor: "穂先が簪のように反り返る草" },
  { id: "c-ganpyoudake",        rarity: 1, name: "ガンピョウダケ",     emoji: "🍄", color: "#b09888", flavor: "崖の氷に張りつくように育つ茸" },
  { id: "c-touyousou",          rarity: 1, name: "トウヨウソウ",       emoji: "🌿", color: "#a0c8a8", flavor: "凍てついた陽だまりに群生する草" },
  { id: "c-kiritsuyumame",      rarity: 1, name: "キリツユマメ",       emoji: "🌱", color: "#9fc8b0", flavor: "霧の朝、葉先に露を結ぶ豆科の草" },
  { id: "c-yukimushirogusa",    rarity: 1, name: "ユキムシログサ",     emoji: "🍃", color: "#90c8a0", flavor: "地面を這うように広がる被覆植物" },
  { id: "c-hyousetsuran",       rarity: 1, name: "ヒョウセツラン",     emoji: "💠", color: "#7fb0d8", flavor: "花びらが凍った氷片のように見える蘭" },
  { id: "c-akebigoke",          rarity: 1, name: "アケビゴケ",         emoji: "🌱", color: "#a8b878", flavor: "紫がかった珍しい色合いの地衣類" },
  { id: "c-shirafubukigusa",    rarity: 1, name: "シラフブキグサ",     emoji: "🌾", color: "#dcdce0", flavor: "白一色の穂を風になびかせる草" },
  { id: "c-setsugentanpopo",    rarity: 1, name: "セツゲンタンポポ",   emoji: "🌼", color: "#e8d060", flavor: "低い丈で花を守る、雪原のたんぽぽ" },
  { id: "c-koorizerisou",       rarity: 1, name: "コオリゼリソウ",     emoji: "🌿", color: "#a0d0b0", flavor: "湿地に生える、清涼な香りの草" },
  { id: "c-yukishoubu",         rarity: 1, name: "ユキショウブ",       emoji: "🌿", color: "#7fae8a", flavor: "葉に霜の模様が浮かぶ菖蒲" },
  { id: "c-kanreisou",          rarity: 1, name: "カンレイソウ",       emoji: "🌾", color: "#c8b090", flavor: "地中深く根を張る、乾燥に強い草" },
  { id: "c-touketsuka",         rarity: 1, name: "トウケツカ",         emoji: "❄️", color: "#bcdcf0", flavor: "触れると音もなく崩れる霜の造形" },
  { id: "c-hyoukasou",          rarity: 1, name: "ヒョウカソウ",       emoji: "🌿", color: "#90b8d0", flavor: "凍った露をまとったまま朝を迎える草" },
  { id: "c-asagirigusa",        rarity: 1, name: "アサギリグサ",       emoji: "🌫️", color: "#b8c8c0", flavor: "朝霧の中でだけ香りを強める草" },
  { id: "c-fuyumushirogoke",    rarity: 1, name: "フユムシロゴケ",     emoji: "🌱", color: "#8fae90", flavor: "地表を覆い、霜から根を守る苔" },
  { id: "c-setsugenyuri",       rarity: 1, name: "セツゲンユリ",       emoji: "🌸", color: "#f0e8f0", flavor: "雪原に一輪だけ咲く白い百合" },
  { id: "c-kangiku",            rarity: 1, name: "カンギク",           emoji: "🌼", color: "#e8c8d8", flavor: "厳寒の中でも花弁を落とさない菊" },
];

const SPECIES_EMOJI: Record<string, string> = {
  plum: "🌸", wintersweet: "💮", sakura: "🌸", wisteria: "🪻",
  rose: "🌹", hydrangea: "🪷", sunflower: "🌻", morning_glory: "🌺",
  cosmos: "🌸", osmanthus: "🏵️", chrysanthemum: "🌼", cyclamen: "🌺",
};

function rareFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `r-${species.nameEn}`,
    rarity: 4,
    name: species.name,
    emoji: SPECIES_EMOJI[species.nameEn] ?? "🌸",
    month: species.month,
    color: species.color,
    flavor: `${species.month}月の希少植物。研究所で大切に育てられている`,
  };
}

function ssrFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `s-${species.nameEn}`,
    rarity: 8,
    name: `${species.name}の絶景`,
    photo: species.rewardImage,
    month: species.month,
    color: species.accentColor,
    flavor: `調査班が記録した、一面の${species.name}`,
  };
}

/** RARE2 — good-quality gathering materials. */
export const TIER2_DROPS: DropDef[] = [
  { id: "t2-aotsurara", rarity: 2, name: "アオツララ",   emoji: "🧊", color: "#a9d8ef", flavor: "青みを帯びた、溶けにくい氷柱" },
  { id: "t2-yukiwata",  rarity: 2, name: "ユキワタ",     emoji: "🪶", color: "#e8eef5", flavor: "雪原を舞う綿毛。上質な保温材になる" },
  { id: "t2-koketsubu", rarity: 2, name: "コケツブ",     emoji: "🍀", color: "#8fbf9f", flavor: "岩肌の苔が結晶化した粒" },
  { id: "t2-hiuchiishi",rarity: 2, name: "ヒウチイシ",   emoji: "🪨", color: "#9a9a9a", flavor: "打つと火花が散る硬い石" },
  { id: "t2-reitosui",  rarity: 2, name: "レイトウスイ", emoji: "🫧", color: "#bfe3f2", flavor: "凍らない不思議な水滴" },
  { id: "t2-shirakaba", rarity: 2, name: "シラカバ樹皮", emoji: "🪵", color: "#d8c9a8", flavor: "凍て地の白樺から剥がした樹皮" },
  { id: "t2-ginsanago",        rarity: 2, name: "ギンサナゴ",       emoji: "🪨", color: "#b8b8c0", flavor: "磨くと銀色に光る、硬い川砂利" },
  { id: "t2-koorinowata",      rarity: 2, name: "コオリノワタ",     emoji: "☁️", color: "#dceaf2", flavor: "湖面で凍りついた綿雲のような霜" },
  { id: "t2-tsuraranomitsu",   rarity: 2, name: "ツララノミツ",     emoji: "🍯", color: "#e8c878", flavor: "氷柱の芯にたまる、甘く濃い雫" },
  { id: "t2-yukiusagi-no-ke",  rarity: 2, name: "ユキウサギの毛",   emoji: "🐇", color: "#eef0f0", flavor: "真っ白に生え変わった保温性の高い毛" },
  { id: "t2-kanbahibi",        rarity: 2, name: "カンバノヒビ",     emoji: "🪵", color: "#c8b090", flavor: "樹皮に走る、寒さで生じた自然のひび" },
  { id: "t2-hyousenshi",       rarity: 2, name: "ヒョウセンシ",     emoji: "🧵", color: "#cfe4ee", flavor: "氷点下でも凍らない不思議な繊維" },
  { id: "t2-iwatsubaki",       rarity: 2, name: "イワツバキの葉",   emoji: "🍃", color: "#7fae7f", flavor: "蝋質で凍りにくい、厚みのある葉" },
  { id: "t2-shirogin-zuna",    rarity: 2, name: "シロガネズナ",     emoji: "⚪", color: "#d0d0d8", flavor: "白銀色に輝く、粒の揃った砂" },
  { id: "t2-tounowa",          rarity: 2, name: "凍ノ輪",           emoji: "💍", color: "#a8d0e8", flavor: "木の枝を一周する、輪状に張った氷" },
  { id: "t2-yukigitsune-no-ke",rarity: 2, name: "ユキギツネの綿毛", emoji: "🦊", color: "#e8e0d8", flavor: "冬毛の下に隠れた柔らかな綿毛" },
  { id: "t2-ganseki-hakuhen",  rarity: 2, name: "岩石の薄片",       emoji: "🪨", color: "#a0a0a8", flavor: "薄く剥がれた、層のわかる岩の欠片" },
  { id: "t2-reikahaku",        rarity: 2, name: "レイカハク",       emoji: "🤍", color: "#e8eef0", flavor: "冷気で固まった、真珠に似た結晶" },
  { id: "t2-touchi-nendo",     rarity: 2, name: "凍土の粘土",       emoji: "🧱", color: "#b09070", flavor: "凍結と融解を繰り返し粘り気を増した土" },
  { id: "t2-karamatsuyani",    rarity: 2, name: "カラマツヤニ",     emoji: "🟠", color: "#d09050", flavor: "落葉松から採れる、香り高い樹脂" },
  { id: "t2-koorigai",         rarity: 2, name: "コオリガイ",       emoji: "🐚", color: "#cfe0ea", flavor: "表面が氷結したような光沢を持つ貝殻" },
  { id: "t2-hakuchou-no-hane", rarity: 2, name: "白鳥の羽",         emoji: "🪶", color: "#f0f0ee", flavor: "渡りの途中で落ちた、大きな風切羽" },
  { id: "t2-yukidokei-seki",   rarity: 2, name: "雪解け石",         emoji: "🪨", color: "#99b0a0", flavor: "雪解け水の跡がしみ込んだまだら石" },
  { id: "t2-tsuraraginu",      rarity: 2, name: "ツララギヌ",       emoji: "🕸️", color: "#cde6f0", flavor: "洞窟の天井で織られたような氷の膜" },
  { id: "t2-shimobana-kesshou",rarity: 2, name: "霜花結晶",         emoji: "❄️", color: "#d8ecf5", flavor: "窓ガラスに咲いたような羊歯状の霜" },
  { id: "t2-touchi-kohaku",    rarity: 2, name: "凍土琥珀",         emoji: "🟡", color: "#d8a838", flavor: "太古の虫を閉じ込めた小さな琥珀" },
  { id: "t2-yukinoshita-ne",   rarity: 2, name: "ユキノシタの根",   emoji: "🥕", color: "#c8a888", flavor: "苦味が薬になると言われる太い根" },
  { id: "t2-ginmo",            rarity: 2, name: "銀毛皮のふさ",     emoji: "🐾", color: "#d8d8dc", flavor: "冬毛の生え際に残る、房状の銀毛" },
  { id: "t2-koorishio",        rarity: 2, name: "コオリジオ",       emoji: "🧂", color: "#eaf2f5", flavor: "塩湖の岸に結晶化した、冷たい塩" },
  { id: "t2-yukigeta-kinoko",  rarity: 2, name: "ユキゲタキノコ",   emoji: "🍄", color: "#c0a8a0", flavor: "傘の形が下駄に似た、大ぶりの茸" },
  { id: "t2-hiokoseki",        rarity: 2, name: "緋熾石",           emoji: "🔺", color: "#c86848", flavor: "地熱地帯でだけ採れる、赤く熱を持つ石" },
  { id: "t2-reisuishou",       rarity: 2, name: "冷水晶のかけら",   emoji: "💎", color: "#a8d8ea", flavor: "触れると指先が痺れるほど冷たい欠片" },
  { id: "t2-tounoito",         rarity: 2, name: "凍ノ糸",           emoji: "🧵", color: "#b8ccdc", flavor: "蜘蛛の巣が凍って糸状になったもの" },
  { id: "t2-yukigumo-wata",    rarity: 2, name: "雪雲ワタ",         emoji: "☁️", color: "#e4eaf0", flavor: "雪雲から降った、軽く乾いた綿状の氷" },
  { id: "t2-shiratsuchi",      rarity: 2, name: "白土",             emoji: "🏺", color: "#e0d8c8", flavor: "陶器の材料になる、きめ細かな白土" },
  { id: "t2-koorikawa",        rarity: 2, name: "氷革",             emoji: "🟤", color: "#a08868", flavor: "極寒で鞣された、丈夫でしなやかな革" },
  { id: "t2-tsuranoha",        rarity: 2, name: "ツラノハ",         emoji: "🍂", color: "#c8b878", flavor: "凍りついたまま散らずに残る枯葉" },
  { id: "t2-ginsame-uroko",    rarity: 2, name: "銀鮫の鱗",         emoji: "🐟", color: "#c0d0d8", flavor: "凍った川で獲れる魚の、硬い鱗" },
  { id: "t2-yukinomizuame",    rarity: 2, name: "雪ノ水飴",         emoji: "🍯", color: "#e8dcc0", flavor: "樹液を煮詰めた、素朴な甘み" },
  { id: "t2-hyouseki-sango",   rarity: 2, name: "氷石サンゴ",       emoji: "🪸", color: "#e0a8b0", flavor: "太古の海の名残とされる白い化石状の塊" },
  { id: "t2-koorinozanmai",    rarity: 2, name: "氷の残滓",         emoji: "🧊", color: "#cfe6f0", flavor: "溶けきる直前の氷が放つ、淡い光" },
  { id: "t2-fuyugomo-ito",     rarity: 2, name: "冬篭りの糸",       emoji: "🕸️", color: "#d8d0c0", flavor: "冬眠前の虫が残した、丈夫な糸" },
  { id: "t2-yukibashira",      rarity: 2, name: "雪柱の芯",         emoji: "🌨️", color: "#dce8ee", flavor: "吹き溜まりの奥で固く締まった雪の芯" },
  { id: "t2-touchi-tanko",     rarity: 2, name: "凍土炭鉱石",       emoji: "⚫", color: "#6a6a6e", flavor: "燃えにくいが火持ちのよい黒い岩" },
];

/** RARE3 — crystals and ores. */
export const TIER3_DROPS: DropDef[] = [
  { id: "t3-hyousho",    rarity: 3, name: "ヒョウショウ",   emoji: "🔷", color: "#7fb8e0", flavor: "六角形に育った氷の結晶" },
  { id: "t3-ginsazare",  rarity: 3, name: "ギンサザレ",     emoji: "⚪", color: "#c8c8d0", flavor: "銀色に光る細かな砂利" },
  { id: "t3-akanezuna",  rarity: 3, name: "アカネズナ",     emoji: "🔶", color: "#e0a060", flavor: "夕焼け色を宿した鉱砂" },
  { id: "t3-aokoseki",   rarity: 3, name: "アオコウセキ",   emoji: "💠", color: "#6fa8d8", flavor: "青く透きとおる鉱石" },
  { id: "t3-shirogane",  rarity: 3, name: "シロガネ鉱",     emoji: "🪫", color: "#b0b0b8", flavor: "叩くと澄んだ音が鳴る" },
  { id: "t3-tsuraragane",rarity: 3, name: "ツララガネ",     emoji: "🩵", color: "#90c0d8", flavor: "氷と金属が混じった塊" },
  { id: "t3-fuyuzekkou",        rarity: 3, name: "フユセッコウ",     emoji: "⚪", color: "#e8e4de", flavor: "冬にしか採取できない、白く柔らかい石膏" },
  { id: "t3-aotoseki",          rarity: 3, name: "青透石",           emoji: "🔵", color: "#5a90c8", flavor: "奥まで見通せるほど透明な青い石" },
  { id: "t3-kohakuko",          rarity: 3, name: "琥珀鉱",           emoji: "🟠", color: "#d89840", flavor: "樹液が長い時をかけて固まった鉱石" },
  { id: "t3-shiroishi-unmo",    rarity: 3, name: "白雲母片",         emoji: "⚪", color: "#e0e0e0", flavor: "薄く割れる、光を反射する雲母" },
  { id: "t3-murasaki-suisho-ka",rarity: 3, name: "紫水晶の欠片",     emoji: "🟣", color: "#9070c0", flavor: "割れ口が鋭い、紫色の水晶片" },
  { id: "t3-kingoku",           rarity: 3, name: "金鉱脈石",         emoji: "🟡", color: "#d4a828", flavor: "岩の筋にわずかに混ざる金色の鉱脈" },
  { id: "t3-ryokugyokuseki",    rarity: 3, name: "緑玉石",           emoji: "🟢", color: "#4fae7a", flavor: "磨くと深緑に発色する硬い石" },
  { id: "t3-shimofuriseki",     rarity: 3, name: "霜降石",           emoji: "⚪", color: "#c8d4dc", flavor: "表面に霜のような白い模様が浮かぶ石" },
  { id: "t3-touketsu-tekko",    rarity: 3, name: "凍結鉄鉱",         emoji: "⚙️", color: "#8a8a92", flavor: "錆びにくいと言われる、重い鉄鉱石" },
  { id: "t3-hyouhakuseki",      rarity: 3, name: "氷白石",           emoji: "⚪", color: "#eaf2f7", flavor: "割ると内部から冷気がこぼれる石" },
  { id: "t3-akaganeko",         rarity: 3, name: "銅鉱脈石",         emoji: "🟠", color: "#c07840", flavor: "緑青を帯びた、古い銅の鉱脈" },
  { id: "t3-gansekisui",        rarity: 3, name: "岩清水晶",         emoji: "💧", color: "#a8d8e0", flavor: "岩の隙間から染み出た水が結晶化した石" },
  { id: "t3-enseki",            rarity: 3, name: "塩結晶",           emoji: "🧂", color: "#eef2f0", flavor: "塩湖の底で育った、透明な結晶柱" },
  { id: "t3-tourokuseki",       rarity: 3, name: "凍緑石",           emoji: "🟢", color: "#7fae8f", flavor: "苔むしたように見える、緑がかった鉱石" },
  { id: "t3-ginkasai",          rarity: 3, name: "銀花砕",           emoji: "⚪", color: "#d0d4dc", flavor: "砕けると花びらのように散る鉱物" },
  { id: "t3-taiyouseki",        rarity: 3, name: "太陽石",           emoji: "🟡", color: "#f0c050", flavor: "曇天でもわずかに熱を持つ黄色い石" },
  { id: "t3-fuyugane",          rarity: 3, name: "冬鉄",             emoji: "⚫", color: "#55565c", flavor: "打っても曲がらない、黒く重い金属塊" },
  { id: "t3-hyoumonseki",       rarity: 3, name: "氷紋石",           emoji: "🔵", color: "#7fb8d8", flavor: "内部に氷の亀裂のような模様を宿す石" },
  { id: "t3-tekkousha",         rarity: 3, name: "鉄鉱砂",           emoji: "🟤", color: "#8a7060", flavor: "川底に沈む、赤みを帯びた砂鉄" },
  { id: "t3-getsumeiseki",      rarity: 3, name: "月明石",           emoji: "⚪", color: "#d8dce8", flavor: "月光を浴びるとほのかに発光する石" },
  { id: "t3-souhyouseki",       rarity: 3, name: "蒼氷石",           emoji: "🔵", color: "#4a80c0", flavor: "凍った湖の底の色をそのまま宿す石" },
  { id: "t3-kinsazare",         rarity: 3, name: "金砂利",           emoji: "🟡", color: "#d0a840", flavor: "川底で微かに金色が混じる砂利" },
  { id: "t3-jamonseki",         rarity: 3, name: "蛇紋石",           emoji: "🟢", color: "#5a7a60", flavor: "くねる縞模様を持つ、緑黒い石" },
  { id: "t3-hakuyokuseki",      rarity: 3, name: "白翼石",           emoji: "⚪", color: "#eef0ee", flavor: "薄く割れると翼のような形になる石" },
  { id: "t3-enshouseki",        rarity: 3, name: "炎晶石",           emoji: "🔴", color: "#d05838", flavor: "地熱帯の割れ目でだけ採れる赤い結晶" },
  { id: "t3-touketsuhi",        rarity: 3, name: "凍結緋石",         emoji: "🔴", color: "#c86858", flavor: "冷えているのに赤く見える不思議な石" },
  { id: "t3-ryusuisho",         rarity: 3, name: "流水晶",           emoji: "🔵", color: "#6fb0d0", flavor: "川の流れで丸く磨かれた透明な水晶" },
  { id: "t3-kokutanko",         rarity: 3, name: "黒炭鉱石",         emoji: "⚫", color: "#3a3a3e", flavor: "よく燃え、長く火を保つ黒い鉱石" },
  { id: "t3-hakuunmo",          rarity: 3, name: "白雲母塊",         emoji: "⚪", color: "#dcdce0", flavor: "薄い層が幾重にも重なった軽い塊" },
  { id: "t3-seihyousho",        rarity: 3, name: "青氷晶",           emoji: "🔵", color: "#6098d0", flavor: "澄んだ青色をした、六角柱の結晶" },
  { id: "t3-oukaseki",          rarity: 3, name: "黄華石",           emoji: "🟡", color: "#e8c868", flavor: "硫黄を含み、独特の香りを放つ石" },
  { id: "t3-ginmonseki",        rarity: 3, name: "銀紋石",           emoji: "⚪", color: "#c8ccd4", flavor: "表面に銀色の細かな筋が走る石" },
  { id: "t3-tanseki",           rarity: 3, name: "炭石",             emoji: "⚫", color: "#48484c", flavor: "燃料としても使われる、軽い黒石" },
  { id: "t3-suishoutou",        rarity: 3, name: "水晶塔石",         emoji: "🔵", color: "#82b8dc", flavor: "塔のように尖った形に育つ水晶" },
  { id: "t3-hyokuseki",         rarity: 3, name: "氷玉石",           emoji: "⚪", color: "#d8ecf2", flavor: "磨くと真珠のような光沢を見せる石" },
  { id: "t3-akakaneseki",       rarity: 3, name: "赤銅石",           emoji: "🟠", color: "#b86840", flavor: "赤銅色に輝く、加工しやすい鉱石" },
  { id: "t3-rurikaseki",        rarity: 3, name: "瑠璃花石",         emoji: "🔵", color: "#3f5fae", flavor: "深い瑠璃色に、白い斑が浮かぶ石" },
  { id: "t3-hakuboku",          rarity: 3, name: "白墨石",           emoji: "⚪", color: "#eae6dc", flavor: "柔らかく、線を引くのに適した石" },
];

/** RARE5 — special materials. */
export const TIER5_DROPS: DropDef[] = [
  { id: "t5-yukibotaru", rarity: 5, name: "ユキボタル",       emoji: "🌟", color: "#d8e8a0", flavor: "雪原にだけ現れる、発光する虫" },
  { id: "t5-reikagai",   rarity: 5, name: "レイカガイ",       emoji: "🐚", color: "#d0c0a8", flavor: "冷気の中で育つ巻貝の殻" },
  { id: "t5-yugegoke",   rarity: 5, name: "ユゲランプゴケ",   emoji: "🕯️", color: "#f0d878", flavor: "温泉の湯気で仄かに灯る苔" },
  { id: "t5-hakuginyo",  rarity: 5, name: "ハクギンヨウ",     emoji: "🪙", color: "#d8d8e0", flavor: "銀箔のように薄い葉" },
  { id: "t5-koorichou",  rarity: 5, name: "コオリチョウ鱗粉", emoji: "🦋", color: "#b8d8e8", flavor: "凍蝶がまとう霜の鱗粉" },
  { id: "t5-yumigoori",  rarity: 5, name: "ユミゴオリ",       emoji: "🔮", color: "#9fd0e8", flavor: "弓なりに凍った透明な氷塊" },
  { id: "t5-yukiotoshi-no-tsubasa",rarity: 5, name: "雪落としの翅",     emoji: "🦟", color: "#cfe6e8", flavor: "羽ばたくたび粉雪を散らす虫の翅" },
  { id: "t5-hikaridake",       rarity: 5, name: "光茸",             emoji: "🍄", color: "#a8e0b0", flavor: "暗闇で青白く発光する希少な茸" },
  { id: "t5-koorikumo-no-ito", rarity: 5, name: "氷蜘蛛の糸",       emoji: "🕸️", color: "#b8d8e8", flavor: "凍える谷でしか紡がれない強靭な糸" },
  { id: "t5-touka-no-tsuno",   rarity: 5, name: "凍花の角",         emoji: "🦌", color: "#d8ccc0", flavor: "花の形に枝分かれした、小さな角" },
  { id: "t5-shizukudori-no-hane",rarity: 5, name: "雫鳥の羽",        emoji: "🪶", color: "#cfe4f0", flavor: "濡れても凍らない撥水性の羽" },
  { id: "t5-yoruginboshi",     rarity: 5, name: "夜銀星",           emoji: "✨", color: "#d0d8f0", flavor: "夜空を映したように輝く小さな鉱物" },
  { id: "t5-kankourou",        rarity: 5, name: "寒香蝋",           emoji: "🕯️", color: "#e8dca0", flavor: "独特の香りを放つ、凍て地特産の蝋" },
  { id: "t5-hyoumakuchou",     rarity: 5, name: "氷膜蝶の翅",       emoji: "🦋", color: "#a0d0e0", flavor: "薄い氷の膜に包まれたような翅" },
  { id: "t5-reiukiba",         rarity: 5, name: "冷雨牙",           emoji: "🦷", color: "#d8e0e8", flavor: "凍雨の中で育った獣の、白く鋭い牙" },
  { id: "t5-touran-no-shu",    rarity: 5, name: "凍卵の殻",         emoji: "🥚", color: "#e8e0d0", flavor: "極寒でも中身を凍らせない卵の殻" },
  { id: "t5-yamiboshi-goke",   rarity: 5, name: "闇星苔",           emoji: "🌌", color: "#7a88b0", flavor: "星屑のような粒を宿す、珍しい苔" },
  { id: "t5-tsuraranomiryoku", rarity: 5, name: "氷柱の魅玉",       emoji: "🔮", color: "#9fd8ec", flavor: "氷柱の芯に生まれる、透き通った珠" },
  { id: "t5-fubukisuzume-no-u",rarity: 5, name: "吹雪雀の羽毛",     emoji: "🐦", color: "#e8e8ec", flavor: "極寒の吹雪でも凍えない密な羽毛" },
  { id: "t5-yukiginga",        rarity: 5, name: "雪銀河",           emoji: "🌌", color: "#8898d8", flavor: "粉雪が舞う様が銀河のように見える一瞬" },
  { id: "t5-touketsu-choukoku",rarity: 5, name: "凍結彫刻氷",       emoji: "🧊", color: "#b0e0f0", flavor: "風が偶然彫り上げた、繊細な氷の造形" },
  { id: "t5-shizuku-shinju",   rarity: 5, name: "雫真珠",           emoji: "⚪", color: "#f0eee0", flavor: "湧き水の中で稀に見つかる小さな真珠" },
  { id: "t5-reikataki",        rarity: 5, name: "冷花滝の飛沫",     emoji: "💦", color: "#a8dce8", flavor: "凍る寸前の滝しぶきが固まったもの" },
  { id: "t5-yukishika-no-tsuno-kake",rarity: 5, name: "雪鹿の角欠片",emoji: "🦌", color: "#d0c8b8", flavor: "生え変わりの時期にだけ見つかる角の欠片" },
  { id: "t5-touka-kohaku",     rarity: 5, name: "凍花琥珀",         emoji: "🟠", color: "#e0a850", flavor: "花を閉じ込めたまま固まった琥珀" },
  { id: "t5-ginkarasu-no-hane",rarity: 5, name: "銀烏の羽",         emoji: "🪶", color: "#c8ccd8", flavor: "稀に見られる、銀色がかった烏の羽" },
  { id: "t5-hikarigai",        rarity: 5, name: "光貝",             emoji: "🐚", color: "#a0e0d0", flavor: "内側が虹色に光る、珍しい二枚貝" },
  { id: "t5-yukiotome-no-nukege",rarity: 5, name: "雪乙女の抜け毛",  emoji: "🧵", color: "#eaeaf0", flavor: "雪山の妖精譚に語られる、絹糸のような毛" },
  { id: "t5-touketsuko",       rarity: 5, name: "凍結光",           emoji: "✨", color: "#cfe8f5", flavor: "太陽が氷面に反射した光そのものの結晶" },
  { id: "t5-reika-no-tamago",  rarity: 5, name: "冷花の卵",         emoji: "🥚", color: "#f0d8e0", flavor: "珍しい高山蝶が残す、淡紅色の卵" },
  { id: "t5-yamineko-no-hige", rarity: 5, name: "闇猫の髭",         emoji: "🐈", color: "#b0b0c0", flavor: "夜行性の山猫が残した、感覚に優れた髭" },
  { id: "t5-suishou-choukoku", rarity: 5, name: "水晶蝶の翅粉",     emoji: "🦋", color: "#b8d8f0", flavor: "触れると水晶のように砕け散る翅の粉" },
  { id: "t5-touka-no-mitsu",   rarity: 5, name: "凍花の蜜",         emoji: "🍯", color: "#e8c880", flavor: "一輪の花からわずかしか採れない蜜" },
  { id: "t5-yukiakari-goke",   rarity: 5, name: "雪明かり苔",       emoji: "🌱", color: "#c8e8b8", flavor: "積もった雪の下でほのかに光る苔" },
  { id: "t5-reikaze-no-fue",   rarity: 5, name: "冷風の笛",         emoji: "🎐", color: "#a8d0d8", flavor: "風が通ると澄んだ音を鳴らす氷の穴" },
  { id: "t5-touketsu-ryuusei", rarity: 5, name: "凍結流星の欠片",   emoji: "☄️", color: "#8898c8", flavor: "夜空を横切った光跡に見立てられた鉱石" },
  { id: "t5-yukiusagi-no-tama",rarity: 5, name: "雪兎の魂珠",       emoji: "🔮", color: "#dce8f0", flavor: "雪原の伝承に語られる、丸い霜の珠" },
  { id: "t5-hyouka-shinju",    rarity: 5, name: "氷花真珠",         emoji: "⚪", color: "#eaf0ec", flavor: "花の形に成長した、珍しい真珠状の氷" },
  { id: "t5-touhotaru-no-tsuchi",rarity: 5, name: "凍蛍の土",        emoji: "🪱", color: "#a8c0a0", flavor: "発光する蛍の幼虫が眠る、温かな土" },
  { id: "t5-ginkaze-no-ha",    rarity: 5, name: "銀風の羽",         emoji: "🪽", color: "#d0d8e8", flavor: "風そのものを切り取ったような軽い羽" },
];

/** RARE6 — precious specimens. */
export const TIER6_DROPS: DropDef[] = [
  { id: "t6-reikaseki", rarity: 6, name: "レイカセキ",       emoji: "🦴", color: "#d8cdb0", flavor: "凍て地で見つかる古い化石" },
  { id: "t6-murasui",   rarity: 6, name: "ムラサキスイショウ", emoji: "🟣", color: "#b090d0", flavor: "紫に発色する希少な水晶" },
  { id: "t6-ginkitsune",rarity: 6, name: "ギンギツネの毛",   emoji: "🦊", color: "#e0e0e8", flavor: "凍て地に棲む銀狐の抜け毛" },
  { id: "t6-yukihyou",  rarity: 6, name: "ユキヒョウの紋",   emoji: "🐆", color: "#c8d0d8", flavor: "雪豹が残した霜の紋様" },
  { id: "t6-seiraiseki",rarity: 6, name: "セイライ石",       emoji: "🔵", color: "#6088c0", flavor: "青雷を宿すと言われる鉱石" },
  { id: "t6-hyouga-kaseki",       rarity: 6, name: "氷河化石",           emoji: "🦴", color: "#d0c8b0", flavor: "氷河に閉じ込められたまま発見された化石" },
  { id: "t6-kokuhyou-no-tsume",   rarity: 6, name: "黒豹の爪",           emoji: "🐾", color: "#4a4a50", flavor: "凍て地に稀に現れる黒豹の鋭い爪" },
  { id: "t6-seiran-suisho",       rarity: 6, name: "青嵐水晶",           emoji: "🔵", color: "#4a78c0", flavor: "稲妻を思わせる筋が走る青い水晶" },
  { id: "t6-touketsu-ryuko",      rarity: 6, name: "凍結竜鱗",           emoji: "🐉", color: "#6a90a8", flavor: "古い言い伝えに残る竜の鱗に似た鉱片" },
  { id: "t6-hakuchou-no-kanmuri", rarity: 6, name: "白鳥の冠羽",         emoji: "🪶", color: "#f0eee8", flavor: "群れの長にしか生えないとされる羽" },
  { id: "t6-tsuraraokami-no-kiba",rarity: 6, name: "氷狼の牙",           emoji: "🦷", color: "#cfe0ea", flavor: "伝説の氷狼が残したという鋭い牙" },
  { id: "t6-kingin-koseki",       rarity: 6, name: "金銀鉱石",           emoji: "🟡", color: "#d8c060", flavor: "金と銀が同時に採れる稀な鉱脈" },
  { id: "t6-touka-no-ishibana",   rarity: 6, name: "凍花の石花",         emoji: "🪨", color: "#e0b8c8", flavor: "鉱物でありながら花の形に育った奇石" },
  { id: "t6-reirin-hyou",         rarity: 6, name: "冷燐氷",             emoji: "⚪", color: "#cfe8f0", flavor: "燐光を帯びて青白く発光する氷塊" },
  { id: "t6-shirokuma-no-tsume",  rarity: 6, name: "白熊の爪",           emoji: "🐾", color: "#eae6de", flavor: "分厚い氷を割るための頑丈な爪" },
  { id: "t6-kokuyouseki-ha",      rarity: 6, name: "黒曜石の刃",         emoji: "🗡️", color: "#2a2a30", flavor: "調査班の先達が加工した鋭利な黒曜石" },
  { id: "t6-touketsu-choukotsu",  rarity: 6, name: "凍結鳥骨",           emoji: "🦴", color: "#d8d0c0", flavor: "極寒を渡った渡り鳥の、軽く強い骨" },
  { id: "t6-murasaki-hyouka",     rarity: 6, name: "紫氷花",             emoji: "🟣", color: "#9878c0", flavor: "極めて稀に咲く、紫色に凍る花" },
  { id: "t6-seiryu-no-uroko",     rarity: 6, name: "青竜の鱗",           emoji: "🐍", color: "#4890b8", flavor: "伝承に語られる青竜を思わせる鱗" },
  { id: "t6-ginmei-kaseki",       rarity: 6, name: "銀鳴化石",           emoji: "⚪", color: "#d0d4dc", flavor: "叩くと澄んだ音を立てる貝の化石" },
  { id: "t6-touka-no-hyouju",     rarity: 6, name: "凍花の氷珠",         emoji: "🔮", color: "#a8d8ea", flavor: "花の中心に生まれた、透き通る珠" },
  { id: "t6-kanreichou-no-u",     rarity: 6, name: "寒麗鳥の羽",         emoji: "🦚", color: "#6aa8c8", flavor: "極寒でしか羽を広げないと言われる鳥の羽" },
  { id: "t6-hyousetsu-kaseki",    rarity: 6, name: "氷雪化石",           emoji: "🦴", color: "#dce8ee", flavor: "氷雪期の生物とされる、白い化石" },
  { id: "t6-yukihyou-no-kiba",    rarity: 6, name: "雪豹の牙",           emoji: "🦷", color: "#d0d8dc", flavor: "雪豹の群れの長だけが持つ大きな牙" },
  { id: "t6-touketsu-shinju",     rarity: 6, name: "凍結真珠",           emoji: "⚪", color: "#eef0ea", flavor: "貝の中で氷のように結晶化した真珠" },
  { id: "t6-akakiba-ryu",         rarity: 6, name: "赤牙竜の爪痕石",     emoji: "🪨", color: "#b85838", flavor: "竜のものと伝わる爪痕が残る石" },
  { id: "t6-reikou-suisho",       rarity: 6, name: "冷光水晶",           emoji: "🔵", color: "#78b8e0", flavor: "内部に冷たい光を宿し続ける水晶" },
  { id: "t6-touka-no-hane",       rarity: 6, name: "凍花の羽衣",         emoji: "🪽", color: "#e8d8e8", flavor: "花の妖精が纏うと伝わる、薄い羽衣状の氷絹" },
  { id: "t6-ginryuu-no-kin",      rarity: 6, name: "銀竜の鱗粉",         emoji: "✨", color: "#d8dce8", flavor: "竜信仰の遺物に混じって見つかる鱗粉" },
  { id: "t6-touketsu-shika-no-kanmuri",rarity: 6, name: "凍結鹿の王冠角", emoji: "🦌", color: "#c8bca8", flavor: "群れの王だけが持つという大きな角" },
  { id: "t6-seihyou-no-me",       rarity: 6, name: "青氷の眼晶",         emoji: "🔵", color: "#4878b0", flavor: "太古の生物の眼が結晶化したと言われる石" },
  { id: "t6-hakugin-no-tsubasa",  rarity: 6, name: "白銀の翼骨",         emoji: "🦴", color: "#dcdce4", flavor: "飛べぬはずの高地で見つかった翼の骨" },
  { id: "t6-touka-genseki",       rarity: 6, name: "凍花原石",           emoji: "🟣", color: "#b090c8", flavor: "磨けば花の模様が浮かぶという原石" },
  { id: "t6-reiga-no-tsuno",      rarity: 6, name: "冷牙の角",           emoji: "🦬", color: "#8a7a68", flavor: "極寒に適応した大型獣の、太く曲がった角" },
];

/** RARE7 — treasured relics. */
export const TIER7_DROPS: DropDef[] = [
  { id: "t7-koreitama", rarity: 7, name: "コレイタマ",     emoji: "🧿", color: "#7fbfe0", flavor: "調査班に語り継がれる霊珠" },
  { id: "t7-ginyoku",   rarity: 7, name: "ギンカの遺翼",   emoji: "🪽", color: "#d8d8e8", flavor: "銀化した古の翼の欠片" },
  { id: "t7-enshinseki",rarity: 7, name: "炎芯石",         emoji: "🔥", color: "#e08040", flavor: "地熱が結晶化した炉の核" },
  { id: "t7-hyoketsurin",rarity: 7, name: "ヒョウケツリン", emoji: "🌌", color: "#6a70b0", flavor: "夜空を封じ込めたような氷輪" },
  { id: "t7-eien-no-shizuku",         rarity: 7, name: "永遠の雫",           emoji: "💧", color: "#a8d8ec", flavor: "千年凍り続けているという伝説の雫" },
  { id: "t7-shiro-ryu-no-kokuin",     rarity: 7, name: "白竜の刻印",         emoji: "🐲", color: "#dce8f0", flavor: "白竜信仰の遺跡に刻まれていたという印" },
  { id: "t7-hoshifuri-no-ken",        rarity: 7, name: "星降りの剣",         emoji: "⚔️", color: "#7888c0", flavor: "隕石から鍛えられたと伝わる古い剣" },
  { id: "t7-tokoyo-no-kagami",        rarity: 7, name: "常夜の鏡",           emoji: "🪞", color: "#6a7098", flavor: "何も映さないという不思議な氷の鏡" },
  { id: "t7-reitei-no-ohn",           rarity: 7, name: "冷帝の王冠欠片",     emoji: "👑", color: "#d8c860", flavor: "滅びた古代王国の王冠の欠片と伝わる" },
  { id: "t7-touka-no-shinzou",        rarity: 7, name: "凍花の心臓石",       emoji: "❤️", color: "#d05868", flavor: "花の中心にあったという伝説の紅い石" },
  { id: "t7-ginga-no-hitomi",         rarity: 7, name: "銀河の瞳",           emoji: "👁️", color: "#6070b0", flavor: "夜空そのものを写し取ったような黒い珠" },
  { id: "t7-koori-no-oukan",          rarity: 7, name: "氷の翁面",           emoji: "🎭", color: "#cfe0ea", flavor: "古い調査班が発見した、氷でできた面" },
  { id: "t7-seirei-no-fue",           rarity: 7, name: "精霊の氷笛",         emoji: "🎐", color: "#a0d0e0", flavor: "吹くと精霊を呼ぶと伝わる古い笛" },
  { id: "t7-touketsu-ryuu-no-kokotsu",rarity: 7, name: "凍結竜の骨珠",       emoji: "🦴", color: "#b0bcc8", flavor: "竜の骨から削り出されたという珠" },
  { id: "t7-yorunoou-no-manto",       rarity: 7, name: "夜の王の外套片",     emoji: "🧥", color: "#383850", flavor: "夜そのものを纏うという伝説の外套の切れ端" },
  { id: "t7-koori-no-tategami",       rarity: 7, name: "氷の鬣",             emoji: "🦁", color: "#d8e0e8", flavor: "伝説の氷獅子が残したという鬣" },
  { id: "t7-touka-no-oukyu",          rarity: 7, name: "凍花の王宮片",       emoji: "🏛️", color: "#d0a8c0", flavor: "花に埋もれた古代宮殿の残欠" },
  { id: "t7-hikari-no-hane",          rarity: 7, name: "光の遺羽",           emoji: "🕊️", color: "#f0eedc", flavor: "光そのものでできていたという伝説の羽" },
  { id: "t7-seija-no-tsue-saki",      rarity: 7, name: "聖者の杖先",         emoji: "🪄", color: "#c8b878", flavor: "調査班の間で聖者の杖と噂される石突" },
  { id: "t7-touketsu-no-shinden-seki",rarity: 7, name: "凍結神殿石",         emoji: "🏯", color: "#8898a8", flavor: "埋もれた神殿の礎石の一部とされる" },
  { id: "t7-hoshikuzu-no-oukan",      rarity: 7, name: "星屑の王冠",         emoji: "👑", color: "#9098d8", flavor: "星屑を鋳込んで作られたという小さな王冠" },
  { id: "t7-touka-no-namida",         rarity: 7, name: "凍花の涙石",         emoji: "💧", color: "#a8c8e0", flavor: "花が涙を流したまま固まったという石" },
  { id: "t7-reisei-no-tsubasa-kokotsu",rarity: 7, name: "霊聖の翼骨",        emoji: "🦴", color: "#d8d0e0", flavor: "空を渡った聖獣の翼の骨と伝わる" },
  { id: "t7-yamiyo-no-kaen",          rarity: 7, name: "闇夜の火炎珠",       emoji: "🔥", color: "#c85838", flavor: "闇の中でも消えない炎を宿す珠" },
  { id: "t7-touketsu-no-kane",        rarity: 7, name: "凍結の鐘片",         emoji: "🔔", color: "#8098b0", flavor: "遠い昔、調査拠点に鳴り響いたという鐘の欠片" },
  { id: "t7-eikyuu-no-koori-bara",    rarity: 7, name: "永久の氷薔薇",       emoji: "🌹", color: "#d06888", flavor: "決して枯れず溶けないという伝説の薔薇" },
];

/** RARE4 — the 12 rare research specimens (one per season month). */
export const RARE_DROPS: DropDef[] = PLANT_SPECIES.map(rareFromSpecies);

/** RARE4 variants — 3 collected forms per month's plant, so RARE4 (rolled
 * often via the first-of-day floor) doesn't repeat the same 12 items. */
export const RARE4_VARIANT_DROPS: DropDef[] = [
  { id: "r-plum-seed",              rarity: 4, name: "梅の種子",         emoji: "🌰", month: 1,  color: "#f8b4c8", flavor: "硬い殻に包まれた、香り高い梅の種" },
  { id: "r-plum-pressed",           rarity: 4, name: "梅の押し花",       emoji: "🍃", month: 1,  color: "#f8b4c8", flavor: "調査記録帳に挟んで乾かした梅の花" },
  { id: "r-plum-bud",               rarity: 4, name: "梅の蕾",           emoji: "🌱", month: 1,  color: "#f8b4c8", flavor: "綻ぶ直前で摘み取られた硬い蕾" },
  { id: "r-wintersweet-sprout",     rarity: 4, name: "蝋梅の芽",         emoji: "🌿", month: 2,  color: "#ffe066", flavor: "雪の下から顔を出した黄色い新芽" },
  { id: "r-wintersweet-oil",        rarity: 4, name: "蝋梅の香油",       emoji: "🧴", month: 2,  color: "#ffe066", flavor: "花を漬け込んで作った、甘い香りの油" },
  { id: "r-wintersweet-dried",      rarity: 4, name: "蝋梅の乾燥花",     emoji: "🥀", month: 2,  color: "#ffe066", flavor: "蝋のような光沢を保ったまま乾いた花" },
  { id: "r-sakura-seed",            rarity: 4, name: "桜の種子",         emoji: "🌰", month: 3,  color: "#ffb7c5", flavor: "小さな果実の中に眠る、来春への種" },
  { id: "r-sakura-pressed",         rarity: 4, name: "桜の押し花",       emoji: "🍃", month: 3,  color: "#ffb7c5", flavor: "花びらの薄紅がそのまま残った押し花" },
  { id: "r-sakura-sprout",          rarity: 4, name: "桜の芽",           emoji: "🌱", month: 3,  color: "#ffb7c5", flavor: "固い枝先で春を待つ、小さな芽" },
  { id: "r-wisteria-bud",           rarity: 4, name: "藤の蕾",           emoji: "🌱", month: 4,  color: "#c5a0e8", flavor: "房になって垂れ下がる前の、小さな蕾の束" },
  { id: "r-wisteria-cutting",       rarity: 4, name: "藤の挿し木",       emoji: "🪴", month: 4,  color: "#c5a0e8", flavor: "根付くと何十年も棚を覆うという枝" },
  { id: "r-wisteria-petal",         rarity: 4, name: "藤の花弁標本",     emoji: "🍃", month: 4,  color: "#c5a0e8", flavor: "紫のグラデーションを保った花弁の標本" },
  { id: "r-rose-seed",              rarity: 4, name: "バラの種子",       emoji: "🌰", month: 5,  color: "#e83a3a", flavor: "実の中に隠れた、棘を持たない種" },
  { id: "r-rose-pressed",           rarity: 4, name: "バラの押し花",     emoji: "🍃", month: 5,  color: "#e83a3a", flavor: "色褪せずに深紅を保った押し花" },
  { id: "r-rose-cutting",           rarity: 4, name: "バラの挿し木",     emoji: "🪴", month: 5,  color: "#e83a3a", flavor: "棘のついたまま根付いた若い枝" },
  { id: "r-hydrangea-cutting",      rarity: 4, name: "紫陽花の挿し木",   emoji: "🪴", month: 6,  color: "#7b9fe8", flavor: "土の性質で色が変わるという若い枝" },
  { id: "r-hydrangea-dried",        rarity: 4, name: "紫陽花の乾燥花",   emoji: "🥀", month: 6,  color: "#7b9fe8", flavor: "水分が抜けても形を保つ、乾いた花房" },
  { id: "r-hydrangea-bud",          rarity: 4, name: "紫陽花の蕾",       emoji: "🌱", month: 6,  color: "#7b9fe8", flavor: "梅雨入り前、まだ固く閉じた蕾" },
  { id: "r-sunflower-seed",         rarity: 4, name: "ひまわりの種子",   emoji: "🌰", month: 7,  color: "#ffd700", flavor: "縞模様が特徴の、油分の多い種" },
  { id: "r-sunflower-pollen",       rarity: 4, name: "ひまわりの花粉",   emoji: "✨", month: 7,  color: "#ffd700", flavor: "太陽の色そのままの、細かな花粉" },
  { id: "r-sunflower-pressed",      rarity: 4, name: "ひまわりの押し花", emoji: "🍃", month: 7,  color: "#ffd700", flavor: "大輪のまま押し花にするのは至難という" },
  { id: "r-morning_glory-seed",     rarity: 4, name: "朝顔の種子",       emoji: "🌰", month: 8,  color: "#6a8ed4", flavor: "小さく黒い、朝を待つ硬い種" },
  { id: "r-morning_glory-bud",      rarity: 4, name: "朝顔の蕾",         emoji: "🌱", month: 8,  color: "#6a8ed4", flavor: "ねじれたまま夜明けを待つ蕾" },
  { id: "r-morning_glory-pressed",  rarity: 4, name: "朝顔の押し花",     emoji: "🍃", month: 8,  color: "#6a8ed4", flavor: "しぼむ前の一瞬を閉じ込めた押し花" },
  { id: "r-cosmos-seed",            rarity: 4, name: "コスモスの種子",   emoji: "🌰", month: 9,  color: "#f4a0c8", flavor: "細長く軽い、風に運ばれやすい種" },
  { id: "r-cosmos-pressed",         rarity: 4, name: "コスモスの押し花", emoji: "🍃", month: 9,  color: "#f4a0c8", flavor: "秋風に揺れていた姿のままの押し花" },
  { id: "r-cosmos-sprout",          rarity: 4, name: "コスモスの芽",     emoji: "🌱", month: 9,  color: "#f4a0c8", flavor: "涼しくなった頃にだけ顔を出す芽" },
  { id: "r-osmanthus-oil",          rarity: 4, name: "金木犀の香油",     emoji: "🧴", month: 10, color: "#f5a623", flavor: "小さな花を大量に集めて抽出した香油" },
  { id: "r-osmanthus-dried",        rarity: 4, name: "金木犀の乾燥花",   emoji: "🥀", month: 10, color: "#f5a623", flavor: "香りを閉じ込めたまま乾かした花" },
  { id: "r-osmanthus-bud",          rarity: 4, name: "金木犀の蕾",       emoji: "🌱", month: 10, color: "#f5a623", flavor: "開く直前が最も香り高いという蕾" },
  { id: "r-chrysanthemum-cutting",  rarity: 4, name: "菊の挿し木",       emoji: "🪴", month: 11, color: "#f0f0f0", flavor: "霜が降りる前に切り分けられた若い枝" },
  { id: "r-chrysanthemum-pressed",  rarity: 4, name: "菊の押し花",       emoji: "🍃", month: 11, color: "#f0f0f0", flavor: "白い花弁の輪郭がくっきり残る押し花" },
  { id: "r-chrysanthemum-tea",      rarity: 4, name: "菊の花弁茶",       emoji: "🍵", month: 11, color: "#f0f0f0", flavor: "乾かした花弁を浮かべて飲む、香り高い茶" },
  { id: "r-cyclamen-seed",          rarity: 4, name: "シクラメンの種子", emoji: "🌰", month: 12, color: "#e84080", flavor: "球根の代わりに稀に採れる小さな種" },
  { id: "r-cyclamen-bud",           rarity: 4, name: "シクラメンの蕾",   emoji: "🌱", month: 12, color: "#e84080", flavor: "花茎がくるりと巻いた状態の蕾" },
  { id: "r-cyclamen-pressed",       rarity: 4, name: "シクラメンの押し花",emoji: "🍃", month: 12, color: "#e84080", flavor: "反り返った花弁の形そのままの押し花" },
];

/** RARE4 roll pool: the 12 canonical species plus their 36 collected-form
 * variants. RARE_DROPS itself stays exactly the 12 canonical entries because
 * book-screen.tsx derives its month -> emoji map from it. */
export const RARE4_POOL: DropDef[] = [...RARE_DROPS, ...RARE4_VARIANT_DROPS];

/** RARE8 — the 12 scenic survey photographs. */
export const SSR_DROPS: DropDef[] = PLANT_SPECIES.map(ssrFromSpecies);

/** The material pool for each rarity rank (RARE 1-8, no gaps). */
export const POOL_BY_RARITY: Record<DropRarity, DropDef[]> = {
  1: COMMON_DROPS,
  2: TIER2_DROPS,
  3: TIER3_DROPS,
  4: RARE4_POOL,
  5: TIER5_DROPS,
  6: TIER6_DROPS,
  7: TIER7_DROPS,
  8: SSR_DROPS,
};

export const DROP_CATALOG: DropDef[] = [
  ...COMMON_DROPS,
  ...TIER2_DROPS,
  ...TIER3_DROPS,
  ...RARE_DROPS,
  ...RARE4_VARIANT_DROPS,
  ...TIER5_DROPS,
  ...TIER6_DROPS,
  ...TIER7_DROPS,
  ...SSR_DROPS,
];

// getCollection() calls this once per stored drop record, and the record
// count grows for the life of the install. A linear scan over the catalog
// would make opening the survey notes O(records x catalog).
const DROP_BY_ID: Map<string, DropDef> = new Map(
  DROP_CATALOG.map((drop) => [drop.id, drop])
);

export function getDropById(id: string): DropDef | undefined {
  return DROP_BY_ID.get(id);
}

export const PITY_LIMIT = 12;
/** The in-season drop is this many times likelier within its rarity pool. */
const CURRENT_MONTH_WEIGHT = 4;

/* Per-rank probabilities (sum to 1), highest rank first. Exponential-ish
 * decay grounded in gacha rate curves: most completions yield low ranks so
 * the top ranks stay special. Pity and the first-of-day floor sit on top. */
const RARITY_RATES: [DropRarity, number][] = [
  [8, 0.025],
  [7, 0.035],
  [6, 0.06],
  [5, 0.09],
  [4, 0.12],
  [3, 0.17],
  [2, 0.22],
  [1, 0.28],
];

export interface RollContext {
  rollsSinceSsr: number;
  isFirstOfDay: boolean;
}

/** Decide a roll's rarity from a [0,1) random source. */
export function decideRarity(rng: () => number, context: RollContext): DropRarity {
  if (context.rollsSinceSsr >= PITY_LIMIT) return 8;

  const roll = rng();
  let cumulative = 0;
  let rarity: DropRarity = 1;
  for (const [rank, rate] of RARITY_RATES) {
    cumulative += rate;
    if (roll < cumulative) {
      rarity = rank;
      break;
    }
  }

  // First roll of the day never lands below RARE4 — a reason to start today.
  if (context.isFirstOfDay && rarity < 4) return 4;
  return rarity;
}

/** Pick a drop of the given rarity; in-season drops are weighted up. */
export function pickDrop(rng: () => number, rarity: DropRarity, month: number): DropDef {
  const pool = POOL_BY_RARITY[rarity] ?? COMMON_DROPS;

  const weights = pool.map((drop) =>
    drop.month === month ? CURRENT_MONTH_WEIGHT : 1
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    target -= weights[i];
    if (target < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function getRarityLabel(rarity: DropRarity): string {
  return `RARE ${rarity}`;
}
