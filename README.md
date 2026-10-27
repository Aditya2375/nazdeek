# Nazdeek

Say what is wrong, in your own language, and find out what to do next: rest at home, see a clinic, or get emergency help. It then shows the nearest government clinics and hospitals on a map.

Live: https://aditya2375.github.io/nazdeek/

Nazdeek does not diagnose and is not medical advice. It only suggests how urgently to get care. When in doubt, go to a clinic. In an emergency call 112 or 108.

## What it does

- Voice or text input in English, Hindi, Kannada, Marathi, Tamil and Telugu. Voice uses the browser's speech recognition (works best in Chrome on Android). If voice is not available, tap symptoms instead.
- Plain rules, no black box. Danger signs (chest pain, trouble breathing, fits, heavy bleeding, snake bite, stroke signs and so on) always give an emergency answer. Everything else moves up, never down, with age, pregnancy, how long it has lasted and how weak the person is. The rules are in `engine.js` and every one is covered in `tests/engine.test.js`.
- Thoughts of self-harm get Tele-MANAS (14416) and 112, not a clinic list.
- Nearest government clinics and hospitals from OpenStreetMap, using your location or a village, town or PIN code you type. Shows distance, directions and a phone number when the map has one.
- Reads the answer aloud when the phone has a voice for that language.

## Privacy

Nothing you say or pick is stored or sent to us. There is no server and no analytics. Your location goes only to the map services (Overpass and Nominatim) to look up nearby places.

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
