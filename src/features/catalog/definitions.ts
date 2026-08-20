import { normalizeCatalogDefinitions } from './model'

/**
 * The first reviewed specimen in each category. IDs are permanent: rewards and
 * the catalog both import this same corpus so a discovered item can never drift
 * to a different entry after an app update.
 */
export const CATALOG_DEFINITIONS = normalizeCatalogDefinitions([
  { schema: 1, id: 'flora-00', name: '月白の露花', categoryId: 'flora', description: '夜明け前だけ花弁の縁に淡い露を結ぶ草花。乾くと銀色の筋だけが残る。', sortOrder: 0 },
  { schema: 1, id: 'fungi-00', name: '灯し胞子茸', categoryId: 'fungi', description: '傘の裏に青い胞子を抱く小さな茸。暗がりで息をするように明滅する。', sortOrder: 0 },
  { schema: 1, id: 'fruits-seeds-00', name: '星殻の種', categoryId: 'fruits-seeds', description: '硬い殻に五本の稜線を持つ種。振ると遠い波音に似た響きが返る。', sortOrder: 0 },
  { schema: 1, id: 'minerals-00', name: '薄明晶', categoryId: 'minerals', description: '光を蓄えず、周囲の影だけを淡く映す半透明の結晶片。', sortOrder: 0 },
  { schema: 1, id: 'waterside-00', name: '潮待ちの小瓶', categoryId: 'waterside', description: '封を開けてもこぼれない一滴を収めた瓶。月の満ち欠けで水位が変わる。', sortOrder: 0 },
  { schema: 1, id: 'feathers-castoffs-00', name: '雲渡りの羽根', categoryId: 'feathers-castoffs', description: '見た目よりも温かい灰青色の羽根。風上へ向けるとわずかに震える。', sortOrder: 0 },
  { schema: 1, id: 'old-tools-00', name: '苔むす測り針', categoryId: 'old-tools', description: '何を量った道具かは不明。針はいつも北西の森を指している。', sortOrder: 0 },
  { schema: 1, id: 'magic-tools-00', name: '余光の鍵', categoryId: 'magic-tools', description: '鍵穴ではなく、忘れかけた景色に反応して淡い輪郭を灯す鍵。', sortOrder: 0 },
  { schema: 1, id: 'papers-books-00', name: '雨読みの断章', categoryId: 'papers-books', description: '濡れるたび異なる一節が現れる紙片。乾けば文字は静かに消える。', sortOrder: 0 },
  { schema: 1, id: 'adornments-00', name: '水脈の耳飾り', categoryId: 'adornments', description: '青緑の細線が内部を巡る耳飾り。近くの清水へ向くと冷たくなる。', sortOrder: 0 },
  { schema: 1, id: 'food-00', name: '琥珀蜜の焼菓子', categoryId: 'food', description: '森の蜂蜜を練り込んだ小さな焼菓子。割ると樹皮と花の香りが立つ。', sortOrder: 0 },
  { schema: 1, id: 'oddities-00', name: '眠らない影石', categoryId: 'oddities', description: '持ち主が眠っている間だけ、石から細い影が伸びて周囲を見守る。', sortOrder: 0 },
].map((definition) => ({
  ...definition,
  art: {
    src: '/brand/grimoire-seal.svg',
    alt: `${definition.name}の標本印`,
    width: 512,
    height: 512,
  },
})))

export const CATALOG_REWARD_POOL = Object.freeze(
  CATALOG_DEFINITIONS.map(({ id }) => Object.freeze({ itemId: id, weight: 1 })),
)
