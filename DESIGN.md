# Design System Specification

## 1. Overview & Creative North Star: "The Midnight Voyager"
This design system is built to evoke the feeling of a late-night planning session under a tropical sky. It rejects the sterile, flat "SaaS" aesthetic in favor of **The Digital Curator**—a high-end, editorial approach to travel planning. 

The visual language moves away from rigid grids and boxy containers. Instead, it utilizes **Organic Asymmetry** and **Glassmorphism** to create a sense of fluid movement and depth. By layering translucent surfaces over a deep midnight void, we create a UI that feels infinite, premium, and intentionally non-linear. Every element should feel like a piece of high-end stationary resting on a dark, polished desk.

---

## 2. Colors & Surface Philosophy
The palette balances the immense depth of a midnight base with the electric energy of tropical accents.

### Color Tokens
- **Background (Base):** `#0A0E1A` (The "Void")
- **Primary (Coral):** `#FF7F50` – Used for urgency, excitement, and primary CTAs.
- **Secondary (Teal):** `#008080` – Used for tranquil actions, discovery, and navigation.
- **Tertiary (Golden Amber):** `#FFBF00` – Used for highlighting "magic" moments, premium features, or saved items.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined through **Tonal Transitions**. Use `surface-container-low` on top of a `surface` background to create a visual break. If a container requires a border for accessibility, use a **Ghost Border**: `outline-variant` at 15% opacity.

### Glassmorphism & Nesting
To achieve a signature high-end look, use `backdrop-filter: blur(10px)`.
- **Level 1 (Main Cards):** `surface_container` with 40% opacity + `blur(10px)`.
- **Level 2 (Nested Elements):** Place a `surface_container_highest` element (opaque) inside a glass card to ground the most important information.

---

## 3. Typography: Editorial Rhythm
We use a combination of **Plus Jakarta Sans** for high-impact displays and **Inter** for functional reading. The goal is a "magazine" feel where the scale is exaggerated for effect.

- **Display-LG (56px, Plus Jakarta Sans):** Reserved for destination names or "Hero" travel dates. Letter spacing should be -2%.
- **Headline-MD (28px, Plus Jakarta Sans):** Used for section headers (e.g., "The Itinerary"). Use intentional asymmetry by left-aligning with a generous `spacing-8` left margin.
- **Title-SM (16px, Inter, Medium):** For card titles and navigation labels.
- **Body-MD (14px, Inter, Regular):** For descriptions. Line height must be generous (1.6) to ensure readability against dark backgrounds.

---

## 4. Elevation & Depth
In this system, depth is not "shadowed"; it is **Layered**.

- **The Layering Principle:** Stacking follows the Material 3 tonal tiers. A card (using `surface_container_low`) sits on the background (`surface`). An active state inside that card uses `surface_container_high`. 
- **Ambient Glows:** Instead of drop shadows, use a `surface_tint` (Coral or Teal) with a 20% opacity and a massive 40px blur behind FABs or active modal headers to simulate a soft neon glow.
- **Glass Depth:** Every glass card must have a `1px` stroke using a linear gradient: `white (10% opacity)` to `white (0% opacity)` to simulate light hitting the edge of a glass pane.

---

## 5. Components & Primitives

### Buttons: The "Vibrant Flow"
- **Primary Action:** A linear gradient from `primary` (Coral) to `secondary` (Teal) at a 135-degree angle. This represents the transition from "Planning" to "Arrival."
- **Secondary Action:** Ghost style. No background fill, only a `1px` border of `outline_variant` (20% opacity) and `label-md` text in `secondary_fixed`.
- **Roundedness:** All buttons use `rounded-full` (pill shape) to contrast against the `rounded-lg` (2rem) cards.

### Cards: The "Frosted Pane"
- **Style:** Glassmorphic. Background: `surface_container` at 60% opacity. 
- **Rule:** Never use dividers. Separate content using `spacing-4` vertical gaps or a `surface_bright` background shift for the header section of the card.
- **Radius:** Standardized at `rounded-lg` (2rem / 32px) for a soft, premium handheld feel.

### Floating Action Button (FAB)
- **Visuals:** Circular, `primary_container` fill. It should hover at `spacing-6` from the bottom-right.
- **Shadow:** Use an "Ambient Glow" (Coral-tinted shadow) with an 8% opacity and 24px blur.

### 5-Tab Navigation
- **Background:** `surface_container_lowest` (Opaque).
- **Active State:** The icon glows with a `secondary` (Teal) underline that is only 4px wide (pill-shaped). Do not use labels if the icons are universally understood; otherwise, use `label-sm`.

### Input Fields
- **State:** Deep midnight fill (`surface_container_lowest`). 
- **Active State:** The border glows with a 1px `tertiary` (Golden Amber) stroke. 

---

## 6. Do's and Don'ts

### Do
- **Do** use intentional white space. If an element feels cramped, increase the spacing to the next tier in the scale (e.g., from `spacing-4` to `spacing-6`).
- **Do** use the Golden Amber (`tertiary`) sparingly—only for "Member Favorites" or "Confirmed Bookings."

### Don't
- **Don't** use 100% black (`#000000`). It kills the "Midnight" depth. Always stick to the navy base.
- **Don't** use hard shadows. If you can see where the shadow ends, it's too dark.
- **Don't** use standard 4px or 8px corners. This system requires the "Generous Curve" (16px+) to feel modern and friendly.
- **Don't** use dividers or lines. If you need to separate two pieces of content, use a background color shift or a `spacing-5` gap.