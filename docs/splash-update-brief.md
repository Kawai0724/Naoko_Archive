agent1.md
Purpose
This file is a focused design/update brief for the splash / cover page only of the Naoko Kawai archive website.

It does not replace the main AGENTS.md; it supplements it.
Use this file when refining the opening screen / hero cover section.
Scope
Only adjust the cover / splash page.
Do not redesign the whole archive structure here.

Current focus:
1. improve the cover image quality
2. refine the title typography
3. adjust the ENTER placement
4. improve the left-side overlay so it is not overly white
5. add a small amount of tasteful supporting information so the page is not too empty
Source cover image
Use the local source image below as the base material:

/Users/xiaowenli/Desktop/Xiaowen Li/network/cover.jpg

Before building the final splash section, create a processed web-ready version.
Image preprocessing requirements
Create:

public/cover-hero.jpg

Requirements:
- preserve the original composition and mood
- keep the landscape format
- upscale to around 2800px–3200px wide for large-screen display
- apply only gentle denoise / sharpen processing
- do not over-sharpen
- do not change the artistic style
- do not brighten the image so much that the nostalgic autumn atmosphere is lost
- preserve the warm gold / brown / green tones
The result should still feel like a soft, slightly cinematic vintage photo.
Visual direction
The splash page should feel like:
- an elegant archive opening screen
- a vintage European/Japanese photo-book cover
- restrained and tasteful
- not too modern, not too flashy
- inspired by refined editorial sites such as Criterion-style layouts
Keywords:
- warm
- quiet
- nostalgic
- editorial
- cinematic
- archival
Main title
The cover page title should use Title Case, not all-lowercase.
Required title
Naoko Kawai's Archive

Do not use:
- naoko kawai's archive
- all caps
- extra subtitle as the main focus
Typography requirements
The title should feel more Western / editorial.
Preferred display serif direction:
- Cormorant Garamond
- Bodoni Moda
- EB Garamond
Use a refined serif display style.
The title should be large, elegant, and calm.
Layout
- place the title on the left side
- keep the title block vertically balanced
- allow comfortable line breaks if needed, for example:
  - Naoko Kawai's
  - Archive
The title should remain the primary focal point on the left.
Overlay / left-side fade
The current left side is too white.
Revise it.
Required overlay behavior
Use a soft warm gradient overlay, not a flat white wash.

Target feeling:
- left side has enough contrast for text readability
- but the background image should still be partially visible
- the overlay should gradually fade toward the right
- the transition should feel smooth and natural
Overlay color direction
Prefer warm paper-like tones such as:
- ivory
- cream
- soft beige
- slightly warm gray
Avoid:
- pure white
- overly opaque white blocks
- harsh linear separation
Visual rule of thumb
- leftmost area: readable, but still textured
- middle area: semi-transparent transition
- right side: image remains rich and atmospheric
The viewer should still feel the lake, leaves, and soft reflections under the overlay.
ENTER placement and style
The current ENTER area should be refined.
Requirements
- move ENTER slightly upward so it relates more closely to the title block
- keep generous whitespace
- do not place it too far away from the title
- do not place it too close either
Style
The ENTER control should remain minimal and elegant.
Preferred options:
- ENTER →
- or ENTER with a thin line and arrow treatment
Tone:
- subtle
- editorial
- not button-heavy
- not rounded UI style
The ENTER element should feel like a printed navigation cue, not a modern app CTA.
Add supporting information
Right now the page has only one title area and feels a bit too empty.
Add a small amount of tasteful supporting information, inspired by elegant footer / editorial metadata.

This information must remain secondary and should not crowd the page.
Suggested supporting information
Use some of the following in a restrained way:
- First developed in 2026
- Developed by fly-me-to-1980 with Codex
- Records · Photobooks · Films
- Private Archive Project
- Vol. 01
Placement suggestion
Possible placements:
- small metadata block near the bottom-left
- a tiny line beneath the ENTER area
- a restrained footer-style area
Important rule
This information should be:
- small
- elegant
- low contrast compared with the main title
- supportive rather than dominant
Do not turn the splash page into a text-heavy landing page.
Suggested cover page content hierarchy
Recommended hierarchy:
1. Main title: Naoko Kawai's Archive
2. ENTER
3. Small supporting information such as:
   - First developed in 2026
   - Developed by fly-me-to-1980 with Codex
   - Records · Photobooks · Films
A possible composition example:
- large serif title on the left
- ENTER → below the title
- a tiny metadata area near the lower-left corner
Example microcopy
Use or adapt the following:
Main title
Naoko Kawai's Archive
Navigation cue
ENTER →
Supporting info candidates
First developed in 2026

Developed by fly-me-to-1980 with Codex

Records · Photobooks · Films

Private Archive Project

Choose a restrained subset. Do not place all of them if the layout becomes crowded.
Technical implementation notes
- use the processed public/cover-hero.jpg
- the splash section should occupy 100vh
- background image should use cover
- overlay should be implemented with layered gradients, not a hard opaque panel
- ensure the design still looks good on both desktop and mobile
- on mobile, typography may scale down and line breaks may change, but the same mood should remain
Mobile behavior
On mobile:
- keep the image visible
- preserve the warm gradient overlay
- do not let the title become too tiny
- stack content vertically with elegant spacing
- keep ENTER easy to tap
- supporting information can be reduced but should still exist in a minimal form
What to avoid
Do not:
- use a pure white left overlay
- leave the page feeling empty and unfinished
- add too much explanatory text
- use bright saturated colors
- use generic rounded blue buttons
- make the page look like a startup landing page
- make the image too sharp or too fake after upscaling
Deliverable
Refine the splash page so that it feels like a polished archival cover page with:
- higher-resolution background image
- Title Case title: Naoko Kawai's Archive
- better ENTER placement
- more natural gradient overlay on the left
- a few elegant supporting metadata lines
The final page should feel more complete, more editorial, and more intentional than the current version.