# Grimoire Asset Art Bible

Status: approved with Area exploration amendment  
Scope: RARE 1–7 item art (518 items) and the ten expedition regions exposed from the Record page
Protected: all twelve RARE 8 photographs, IDs, rarity values, region assignments, month mappings, and existing IndexedDB history

## 1. Creative thesis

The collection should feel like a field archive assembled after dangerous expeditions through a vast natural fantasy world. Every image must make the object worth examining, while the complete set must still read as one archive.

The art is realistic rather than cartoon-like: believable weight, erosion, plant fibres, mineral fracture, patina, condensation, soot, salt, and imperfect handcraft. Magic is expressed through physically plausible light and material behaviour. It is never a generic neon aura pasted over an ordinary prop.

The ten regions deliberately occupy different positions on a spectrum from adventurous natural fantasy through gentle storybook wonder to solemn dark myth. This variation belongs to the world, not to inconsistent rendering styles.

## 2. Visual constants

### Camera language

- Items use a near-square archival portrait, suitable for both a small collection cell and a large full-screen inspection view.
- Three-quarter views are preferred when they reveal silhouette and thickness; flat specimens may use a restrained top-down view.
- Use a real macro/product-photography lens language: shallow but not destructive depth of field, intact outer silhouette, and controlled perspective.
- Leave 8–12% breathing room around the object. Nothing important may touch the crop.
- Area masters are portrait exploration canvases representing roughly `2 viewport widths × 2 viewport heights`. The initial phone view is the centered 50% × 50% window, not the whole image.
- The centered initial window must form a complete composition by itself: readable foreground, traversable middle distance, and one unmistakable landmark. The outer bands extend the same place with coherent side paths, elevation, water, ruins, vegetation, or distant geography rather than filler.
- Every quadrant must contain at least one quiet discovery detail, while the central landmark remains the strongest orientation anchor. No critical subject may exist only at an extreme edge.
- Area focal points must survive the centered portrait full-screen view, free two-axis panning, and a shallower panel crop.

### Lighting language

- Use motivated light from the region: aurora, Mediterranean sun, brazier, canopy shafts, lanterns, moonlit mist, savanna sunset, or sea phosphorescence.
- Preserve dark detail on OLED screens. Black areas must contain texture and spatial separation.
- Magical light may illuminate nearby material and cast a coherent shadow; floating glow with no interaction is forbidden.
- Rarity increases lighting precision and narrative focus, not raw exposure or bloom.

### Material language

- Organic: visible veins, fibres, pores, scales, sap, dried edges, wear, and asymmetry.
- Mineral: plausible cleavage, inclusions, refraction, sediment, frost, salt, or volcanic glass.
- Crafted: tool marks, joinery, imperfect gilding, oxidised metal, lacquer layers, woven tension, and repair history.
- Sacred or legendary: uncommon construction and age-specific damage rather than excessive filigree.

### Background language

- Backgrounds vary by region and object history but share a restrained expedition-archive presentation.
- Use fragments of the object's origin—snow slate, temple marble, caravan textile, wet jungle stone, lacquered cedar, rune-cut wood, sun-baked hide, coral limestone—as quiet support.
- Background contrast must preserve the silhouette at 96–120 CSS pixels.
- No decorative frame is baked into the bitmap; rarity framing and status remain UI responsibilities.

### Color language

- Global anchors: ember warmth, glacial cyan, aged parchment, oxidised dark metal, and reserved rarity gold.
- Region color is allowed to dominate its own imagery. Cross-region consistency comes from naturalistic grading, material accuracy, and camera discipline.
- Avoid universal teal-orange grading, synthetic rainbow iridescence, and oversaturated mobile-game colors.

## 3. Expedition identities

| ID | Tone | Light and palette | Visual hook | Darkness |
|---|---|---|---|---|
| `frost` | severe polar wonder | blue ice, snow-white, aurora green, ember shelter light | headquarters lights beneath a monumental aurora glacier | medium |
| `aegis` | adventurous sunlit antiquity | white limestone, lapis sea, olive green, warm gold | a sea-carved temple causeway descending into clear water | low |
| `caravan` | dangerous wonder and old trade magic | ochre sand, indigo textile, copper, lamp amber | a half-buried city aligned with a celestial caravan route | medium |
| `canopy` | oppressive living archaeology | wet jade, black stone, orchid accents, mist white | a stair-temple being slowly lifted apart by colossal roots | medium-high |
| `lantern` | intimate seasonal mystery | lacquer red, paper ivory, moss, rain reflections | thousands of weathered lanterns leading into an abandoned garden | low-medium |
| `grove` | ancient northern dread | desaturated pine, rune silver, moon blue, peat black | a rune-bound world tree disappearing into sentient-looking fog | high |
| `savanna` | regal loss beneath immense skies | dry gold, storm violet, ebony, aged brass | ruined royal drums and walls revealed along a migration path | medium |
| `tide` | navigational awe at the world's edge | deep cyan, coral limestone, moon silver, volcanic black | star-aligned tidal channels glowing between islands | low-medium |
| `petal` | delicate confectionery court fantasy | blush rose, cream porcelain, pistachio, sugar-glass highlights | a flower-sweet palace garden arranged for an enchanted tea ceremony | low |
| `lullaby` | tranquil celestial bedtime wonder | periwinkle, moon silver, cloud white, lavender | a dream-weaving valley where moon bridges and music-box lights cross the clouds | low-medium |

No people appear in Area imagery. Small fauna may appear only when ecologically and fantastically plausible, subordinate to the landscape, and never posed as a mascot.

## 4. Rarity progression

Rarity must be legible from silhouette, material, construction, provenance, and light even before the UI frame appears.

| RARE | Collection meaning | Silhouette and construction | Material/light treatment |
|---:|---|---|---|
| 1 | field-gathered common material | simple, humble, lightly irregular | one familiar material; diffuse natural light; little or no magic |
| 2 | selected or carefully prepared material | cleaner specimen or modest craft | refined surface, small regional detail, controlled highlight |
| 3 | unusual material or skilled workmanship | recognisable secondary feature | rare inclusion, precise craft, subtle internal response to light |
| 4 | distinctive rare botanical specimen | mature, well-preserved, display-worthy form | rich natural color, specimen care, restrained magical ecology |
| 5 | exceptional object with a strong identity | memorable silhouette and evidence of ritual/use | layered material story, focused supernatural behaviour |
| 6 | legendary surviving fragment | authoritative mass and deliberate construction | rare material interaction, age, provenance, quiet radiance |
| 7 | world-significant icon | instantly recognisable at thumbnail scale | singular impossible-but-coherent phenomenon; cinematic restraint |

Higher rarity does not mean adding more gold, particles, spikes, or ornaments. An austere RARE 7 may be visually simpler than a ceremonial RARE 5 if its material phenomenon and history are stronger.

## 5. Item differentiation policy

- Every item receives an individual design brief derived from `region × rarity × name × flavor × object type`.
- Every RARE 5–7 item requires a distinct primary silhouette.
- RARE 3–4 may share camera families, never the same object silhouette and material arrangement.
- RARE 1–2 may share controlled templates within a material family, but must differ in specimen geometry, wear, origin detail, and color response.
- A redesign may change a name or flavor only when the rendered object no longer matches the existing wording. IDs, rarity, region, and history keys remain unchanged.
- New flavor text should reveal provenance through one concrete trace or consequence. It should not explain the entire mystery.

## 6. Item brief schema

Each production record contains:

1. Stable item ID and current name/flavor.
2. Region, rarity, object family, visual complexity, and narrative importance.
3. Primary silhouette and secondary identifying feature.
4. Material stack and age/wear evidence.
5. Regional background surface and motivated light.
6. One visualised piece of backstory.
7. Thumbnail readability requirement.
8. Forbidden motifs and duplication checks.
9. Generated asset path, dimensions, checksum, review score, and regeneration count.
10. Revised name/flavor only when required by an approved redesign.

## 7. Mobile presentation rules

- The undiscovered collection remains hidden; generated art is not exposed before acquisition.
- Item and Area inspection use true full-screen mobile surfaces with a persistent, thumb-reachable close control and system back support.
- Area inspection opens at the exact center of a roughly 200vw × 200dvh image plane. One-finger drag pans freely on both axes with bounded edges and subtle resistance; the image never exposes empty space. Pinch/double-tap zoom is layered on top of that base exploration scale.
- Item inspection uses swipe navigation between collected items; Area one-finger gestures are reserved for exploring inside the current region so page navigation cannot steal the gesture.
- A restrained survey locator may show the current viewport within the larger canvas, then recede so chrome does not compete with the world.
- No screen shake and no flashing. Strong completion feedback comes from radial motion, material light, directional particles, sound, and short timing.
- Reduced-motion users receive a still/high-contrast equivalent and immediate state change.
- Images must not delay task completion, modal dismissal, or navigation.

## 8. Asset and performance policy

- Working masters may be lossless, but shipped items use responsive WebP/AVIF derivatives with an explicit fallback policy.
- Item thumbnails and inspection images are separate delivery sizes; the grid must never decode full-size masters.
- Area panels use a compact preview derived from the centered initial window and load the exploration master on intent/open. Area images are not speculatively prefetched as a carousel because gestures belong to two-axis exploration.
- The exploration source should map close to 2 source pixels per viewport CSS dimension where practical, but decode cost and texture limits remain bounded for the Pixel 7a. The runtime renders one Area master at a time and releases the previous decoded surface on close.
- Do not precache all 518 item images. Cache acquired or viewed assets with a bounded runtime policy so daily task use remains reliable offline without unbounded storage growth.
- Target devices are Xiaomi 14T Pro and Pixel 7a. The Pixel 7a is the performance floor for full effects; lower capability or thermal pressure may reduce particle count, DPR, and speculative prefetch.
- Quality/speed target is 60/40. Interaction response remains immediate even when art is still decoding.

## 9. Sound and haptic direction

- Add: organic water tension with a small magical bloom, synchronised to touch-origin ripple.
- Complete: tactile impact, rising reward color, and a short satisfying tail scaled by rarity; energetic without becoming loud.
- Cancel: dry, quiet retreat with no reward-like pitch rise.
- Sound and haptic preferences become separate toggles. No volume slider.
- Haptic is implemented with the device vibration capability; audio assets cannot create physical haptics. It is reserved for important actions and degrades silently where unsupported.

## 10. Forbidden patterns

- No people, mascots, logos, readable text, watermarks, or copied franchise symbols.
- No generic loot-chest framing, card borders baked into art, inventory-slot backgrounds, or UI chrome inside images.
- No ubiquitous floating sparks, excessive bloom, rainbow crystals, symmetrical AI filigree, impossible tangent collisions, duplicated appendages, or ornamental noise.
- No screen shake, strobe, flash-to-white, or rapid luminance pulsing.
- No style drift into anime, cartoon, plastic 3D, or clean studio fantasy props without age and context.

## 11. Pilot approval set

The single approval gate uses seven item images and two Area heroes:

- R1 `frost-1-yukinoshita` — humble organic readability.
- R2 `lantern-2-origami-tsuru` — modest crafted detail and human history without depicting a person.
- R3 `tide-3-chouryuu-ishi` — unusual mineral material.
- R4 `r-hydrangea-dried` — rare botanical preservation.
- R5 `canopy-5-jaguar-tamashii` — powerful identity without visual excess.
- R6 `savanna-6-hoshiyomishi-tsue` — legendary craft fragment.
- R7 `caravan-7-negai-mahoubin` — iconic world-significant object.
- Area `aegis` — bright adventurous natural fantasy.
- Area `grove` — dark mythic environmental fantasy.

Approval evaluates the system, not only individual beauty: cross-rarity legibility, regional identity, thumbnail clarity, full-screen interest, realism, and absence of franchise imitation.
