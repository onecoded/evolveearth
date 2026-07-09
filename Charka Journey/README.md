# Chakra Journey - The Seven Sacred Gates

An interactive web experience / event framework combining chakra energy work with real-world games, breathwork, challenges, and community rituals. Two layers:

1. **chakra-destiny.html** - A standalone single-page web app where participants choose their chakra destiny journey through seven sacred gates
2. **4GATES.MD** - Event/retreat design notes: GPS-gated locations, breakthrough sharing games, physical challenges, and ceremony design

---

## Project Structure

```
Charka Journey/
  README.md              - This file
  chakra-destiny.html    - Interactive web app (self-contained, no server needed)
  4GATES.MD              - Event and retreat design notes
```

---

## Running the Web App

No server, no install. Just open the file:

```bash
# Windows
start chakra-destiny.html

# Or double-click the file in Explorer
# Or drag it into any browser window
```

The app is fully self-contained - all CSS, JavaScript, and assets are embedded in the single HTML file.

---

## For the Live Event (4GATES.MD)

The four-gates experience uses GPS-gated locations to guide participants through ritual stages. See 4GATES.MD for the full event design.

Core flow:
1. **Gate 1 (Sunset meeting point)** - $111 paid admission reveals GPS coordinates
2. **Gate 2 (Breakthrough Gate)** - Share a breakthrough, peers confirm it, receive next coordinates
3. **Gate 3 (Humble Challenge)** - Physical challenges: breath holds, balance, hand slapping, slackline
4. **Gate 4 (Wisdom Court)** - Share wisdom, receive the wisdom card

Card system: Participants who earn the Breakthrough Card, Humble Card, and Wisdom Card all three unlock the final ceremony.

---

## How to Improve This Project

### Quick wins (1-2 hours each)

1. **Deploy the web app online** - Upload chakra-destiny.html to GitHub Pages (free) or Netlify (free). Participants can access it from their phones during the event without downloading anything.
   - GitHub Pages: Create a repo, upload the file, enable Pages in Settings
   - Netlify: Drag the file to netlify.com/drop

2. **Add a QR code entry point** - Generate a QR code that links to the deployed web app. Print it on event flyers or show it at the entrance. Free QR code generators: qr-code-generator.com

3. **GPS reveal via the web app** - Currently the coordinates are shared manually. Add a payment check step to the web app: after a Stripe or Venmo confirmation code is entered, the GPS coordinates are revealed. This automates the $111 gate.

4. **Personalized chakra card** - At the end of the web app journey, generate a personalized PDF or image card showing the participant name, chakra path taken, and a custom message. Use a canvas API or html2canvas library to create shareable images.

5. **Add a waiting list / RSVP form** - Embed a simple Google Form or Typeform link from the web app intro screen to capture interested participants before events.

### Medium improvements (half-day each)

6. **Event participant tracking** - Build a simple admin panel (password-protected HTML page) where the event host can mark which participants have earned each card and track their progress through the gates in real time.

7. **Progressive web app (PWA)** - Convert to a PWA so participants can install it on their phone home screen. Works offline once installed. Add a manifest.json and service worker. Good for events with spotty cell coverage.

8. **Multi-event support** - Add a landing page that shows upcoming events with dates, locations (city only, not exact GPS), and ticket links. Each event links to its own chakra journey configuration.

9. **Audio integration** - Add ambient chakra frequency tones (binaural beats) that play during each gate screen. These can be generated with the Tone.js library or embedded as base64 audio. Frequencies: Root 396Hz, Sacral 417Hz, Solar 528Hz, Heart 639Hz, Throat 741Hz, Third Eye 852Hz, Crown 963Hz.

10. **Facilitator guide** - Create a facilitator_guide.md (or PDF) with: timing for each gate, suggested prompts for the breathwork, how to run the physical challenges safely, how to hold space for the breakthrough sharing circle.

### Architecture / Production improvements

11. **Move secrets out of the HTML** - The GPS coordinates and any access codes should not be hardcoded in the HTML (the file is readable by anyone who has it). Store them in a backend endpoint protected by a passcode or payment verification.

12. **Analytics** - Add a simple event tracking call (Plausible.io or a free Google Analytics 4 property) to see how many people complete each gate, where they drop off, and which chakra paths are most popular.

13. **Recurring retreat system** - Design the event as a series (monthly or seasonal). Build a participant profile that persists across events: which gates they have passed, which cards earned, their chakra history. A simple Supabase free tier can store this.
