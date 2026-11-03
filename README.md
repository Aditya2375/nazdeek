# Nazdeek

Unvalidated health-information prototype. The existing rules and translations require clinical and native-speaker review before real use. A reassuring result cannot establish that it is safe to stay home. The map is an unverified volunteer-data directory, not a guarantee of nearby care, ownership, opening hours or capability.

Live: https://aditya2375.github.io/nazdeek/

Nazdeek does not diagnose and is not medical advice. It only suggests how urgently to get care. When in doubt, go to a clinic. In an emergency call 112 or 108.

## What it does

- Voice or text input in English, Hindi, Kannada, Marathi, Tamil and Telugu. Voice uses the browser's speech recognition (works best in Chrome on Android). If voice is not available, tap symptoms instead.
- Plain rules, no black box. Danger signs (chest pain, trouble breathing, fits, heavy bleeding, snake bite, stroke signs and so on) always give an emergency answer. Everything else moves up, never down, with age, pregnancy, how long it has lasted and how weak the person is. The rules are in `engine.js` and every one is covered in `tests/engine.test.js`.
- Thoughts of self-harm get Tele-MANAS (14416) and 112, not a clinic list.
- Unverified clinic and hospital candidates from OpenStreetMap, using your location or a village, town or PIN code you type. Shows distance, directions and a phone number when the map has one.
- Reads the answer aloud when the phone has a voice for that language.

## Privacy

Typed symptoms are evaluated in this tab and not stored by this app. Browser speech recognition may send audio to its provider. Overpass/Nominatim receive coordinates and place searches; OpenStreetMap tile requests reveal the viewed area and IP address. Directions open Google Maps. No analytics or app backend. Fonts are self-hosted with licenses in assets/font-licenses.txt. Privacy notice is English pending native-language review.

## Run it

It is plain HTML, CSS and JavaScript. Open `index.html` through any static server:

    python3 -m http.server 8000

Tests:

    node tests/engine.test.js

## Limits

- Map data comes from volunteers and can be out of date or missing places. Ask locally and call ahead.
- The Hindi, Kannada, Marathi, Tamil and Telugu text should be read by native speakers before real use.
- The triage rules are a simple first filter. They have not been clinically validated.

Built for Code for a Billion (Health track).

## Technical audit scope

Medical rule outputs were not expanded or presented as clinically validated. Existing 1123 engine checks verify implementation consistency, not clinical safety. The technical pass adds bounded response parsing (2MB), 12s request timeouts, finite map coordinates, capped map rows, serialized user-started search and stale-result guards. A shared URL no longer silently initiates a location search. Government status uses explicit operator:type tags only, never a facility name heuristic; even these volunteer tags remain unverified. Emergency searches filter hospital candidates, without claiming any can handle emergencies. Search can fail or miss closer places. No health-service call or microphone recording was made during automated QA.

Clinical and native-language validation remain BLOCKED pending qualified review. Support: adityakulkarnicoding@gmail.com
