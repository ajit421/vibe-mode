# ROLE

Act as a **senior creative frontend engineer, UI/UX designer, motion designer, and software architect**.

Build a complete, production-quality, highly upgradeable nostalgic music website from scratch.

The website should feel like a **digital memory machine** rather than a normal music website.

The core concept is:

> **Different situations in our daily life have different vibes, and each vibe has its own visual theme, animations, sounds, messages, and YouTube playlist.**

For example:

- At home → **Judaad House**
- Travelling in Metro → **Metro Mode**
- Travelling in Indian Train → **Indian Train Mode**
- Travelling in Uber/Rapido/Cab → **Cab Wala Mode**
- At Office → **Office Mode**
- Future themes can be added easily without modifying the core application.

---

# IMPORTANT: FIRST ANALYZE THE EXISTING PROJECT

Before writing code:

1. Inspect the complete existing codebase.
2. Identify the current framework, package manager, folder structure, build system, and deployment configuration.
3. Reuse existing good code where possible.
4. Do NOT unnecessarily rewrite the entire project if a good architecture already exists.
5. Check whether the project is already configured for Netlify.
6. Keep the website compatible with **Netlify deployment**.
7. Make the final architecture easy for another developer to understand and extend.

If the project is empty, choose a modern production-ready stack.

Preferred stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion / Motion for animations
- Lucide React for icons
- YouTube IFrame Player API or another reliable YouTube integration
- LocalStorage for user preferences
- CSS variables / theme tokens for dynamic themes

Avoid unnecessary libraries.

---

# CORE PRODUCT IDEA

Create a website called something similar to:

**"Life Mode"**

or

**"Vibe Mode"**

The exact name can be chosen based on the visual design.

The homepage should immediately communicate:

> "Where are you right now?"

The user can select a situation/mode.

Example:

🏠 Judaad House  
🚇 Metro  
🚂 Indian Train  
🚕 Cab Wala  
💼 Office

When the user selects a mode:

1. Entire visual theme changes.
2. Background changes.
3. Colors change.
4. Typography can change.
5. Main illustration/visual changes.
6. Nostalgic messages change.
7. Ambient animations change.
8. Small UI details change.
9. The associated YouTube playlist becomes active.
10. Music player updates automatically.
11. The selected mode is remembered using LocalStorage.

The transition between modes should feel cinematic.

---

# VERY IMPORTANT ARCHITECTURE

Do NOT hard-code every theme inside separate React components.

Create a **data-driven theme system**.

For example:

```ts
interface VibeTheme {
  id: string;
  name: string;
  shortName: string;
  description: string;

  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };

  typography?: {
    heading?: string;
    body?: string;
  };

  background: {
    type: string;
    image?: string;
    gradient?: string;
  };

  hero: {
    title: string;
    subtitle: string;
    visual: string;
  };

  playlists: {
    id: string;
    name: string;
    youtubePlaylistId: string;
  }[];

  quotes: string[];

  ambientSounds?: string[];

  effects?: {
    particles?: boolean;
    rain?: boolean;
    trainMovement?: boolean;
    metroMovement?: boolean;
    traffic?: boolean;
    crtNoise?: boolean;
    etc?: boolean;
  };
}
```

Create a central configuration such as:

```text
src/
├── app/
├── components/
├── themes/
│   ├── judaad-house.ts
│   ├── metro.ts
│   ├── indian-train.ts
│   ├── cab-wala.ts
│   ├── office.ts
│   └── index.ts
├── music/
│   ├── playlists.ts
│   └── youtube.ts
├── hooks/
├── utils/
├── assets/
└── styles/
```

The exact folder structure can be improved if needed.

The goal is:

> Adding a new theme should require adding mostly a new configuration object, not rewriting the application.

---

# THE INITIAL THEMES

Create these themes initially.

## 1. JUDAAD HOUSE

Context:

Three engineers live together in a rented house called:

# "JUDAAD HOUSE"

The three roommates are:

- Software Engineer
- Mechanical Engineer
- Electrical Engineer

This should NOT look like a generic house website.

It should feel like:

**3 engineers + rented house + jugaad + late-night discussions + engineering experiments + friendship + music.**

Visual details can include:

- Messy engineering desk
- Laptop
- Mechanical components
- Wires
- PCB
- Multimeter
- Screwdriver
- Coffee/tea cup
- Random tools
- Engineering drawings
- Sticky notes
- Cables
- Fan
- Backpack
- Small rented-room details
- "Jugaad" labels
- Funny engineering status messages
- Late-night atmosphere
- Hostel/PG/rented-house nostalgia
- Random technical jokes

Possible UI labels:

> JUDAAD HOUSE

> 3 Engineers  
> 1 House  
> 0 Proper Solutions

Other funny lines can be generated, but keep them tasteful and natural.

Create rotating quotes/messages such as:

- "Bhai jugaad ho jayega."
- "Kal karenge."
- "Ek baar aur test kar."
- "Chai bana?"
- "Ye temporary fix hai."
- "Temporary fixes that survived 6 months."
- "Production mein chal raha hai, don't touch it."

The theme should feel personal and warm.

---

# 2. METRO MODE

When the user is travelling in a metro:

The website should visually transform into a metro environment.

Visual inspiration:

- Indian metro interior
- Metro route map
- Station names
- Moving train effect
- Window reflections
- Handrails
- Seats
- LED display
- Platform-like UI
- Subtle motion
- City lights
- Travel atmosphere

Example text:

> NEXT STATION: VIBE

> Please mind the music.

> Doors closing...

The music playlist associated with Metro Mode should automatically play through the website's music player.

---

# 3. INDIAN TRAIN MODE

Create a nostalgic Indian railway experience.

Visual details:

- Indian railway coach
- Train window
- Passing landscape
- Railway station boards
- Berth/seat details
- Ticket-like UI
- Train number
- Platform number
- "Chai! Chai!" style atmosphere
- Moving landscape
- Slight train movement animation

Example:

> INDIAN RAILWAYS

> Platform: VIBE

> Coach: MUSIC

> Seat: WINDOW

The overall mood should feel nostalgic and cinematic.

---

# 4. CAB WALA MODE

For Uber/Rapido/taxi travel.

The theme should feel like:

**city ride + headphones + traffic + night lights + window reflections.**

Visual details:

- Car interior
- City traffic
- Street lights
- Navigation-like elements
- Route line
- ETA-style UI
- Moving road
- Reflections
- Rain effect optionally

Example:

> CAB WALA MODE

> Destination: Somewhere

> ETA: Doesn't matter

> Music: Matters.

Make it feel like listening to music while travelling alone through a city.

Do not use copyrighted Uber/Rapido logos or branding unnecessarily. Make the concept generic.

---

# 5. OFFICE MODE

Create a modern office environment.

The user selects this mode when:

> "I'm in office and I feel like listening to music."

Visual details:

- Desk
- Laptop
- Monitor
- Keyboard
- Coffee
- Office lighting
- Code/editor-like visual elements
- Calendar
- Sticky notes
- Engineering drawings
- Productivity UI

Example:

> OFFICE MODE

> Status: Working

> Productivity: questionable

> Music: Required

The user should be able to configure a separate Office playlist.

---

# MUSIC SYSTEM

This is one of the most important parts.

The application must support:

## Multiple themes

Each theme can have:

- Multiple YouTube playlists
- Playlist title
- Playlist description
- YouTube playlist ID

Example:

```ts
const playlists = {
  judaadHouse: [
    {
      id: "judaad-night",
      name: "Judaad House Nights",
      youtubePlaylistId: "YOUR_PLAYLIST_ID"
    },
    {
      id: "judaad-chai",
      name: "Chai + Engineering",
      youtubePlaylistId: "YOUR_PLAYLIST_ID"
    }
  ],

  metro: [
    {
      id: "metro-vibes",
      name: "Metro Vibes",
      youtubePlaylistId: "YOUR_PLAYLIST_ID"
    }
  ]
};
```

DO NOT put actual placeholder playlist IDs into production logic.

Create a clear configuration file where I can easily replace them.

---

# YOUTUBE PLAYER

Build a proper YouTube-based music system.

Requirements:

- Play
- Pause
- Previous
- Next
- Volume
- Mute
- Progress
- Current track
- Playlist
- Playlist switching
- Loading state
- Error state
- YouTube unavailable state

The actual YouTube player can be visually minimized/hidden behind the custom music UI if technically appropriate.

The custom UI should look like part of the website instead of the default YouTube player.

Important:

Do not violate YouTube's platform restrictions.

Use the official YouTube IFrame Player API where appropriate.

Do not download or illegally extract audio from YouTube.

---

# CUSTOM MUSIC PLAYER

Create a beautiful fixed music player near the bottom of the screen.

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ ◀   ▶   ▶▶     Track Name                    🔊    ━━━━━━━━ │
│             Judaad House Playlist                            │
└──────────────────────────────────────────────────────────────┘
```

Mobile:

Make it compact and easy to use.

The player should have:

- Album/visual placeholder
- Track title
- Playlist name
- Play/pause
- Previous
- Next
- Progress
- Volume
- Current mode
- Expand/collapse option

Use glassmorphism but make it fit the active theme.

---

# THEME SWITCHER

Create a beautiful theme selector.

It should NOT look like a boring dropdown.

Use cards or a cinematic mode selector.

Example:

```text
WHERE ARE YOU?

🏠 Judaad House
🚇 Metro
🚂 Indian Train
🚕 Cab Wala
💼 Office
```

Each card should have:

- Icon/illustration
- Theme name
- Short description
- Small animated preview
- Current playlist indicator

When clicked:

- Theme transition starts
- Background transitions
- UI colors change
- Hero content changes
- Playlist changes
- Animations change

Use Framer Motion / Motion for smooth transitions.

---

# ROTATING NOSTALGIC QUOTES

Every theme should have its own collection of messages.

Example:

```ts
quotes: [
  "Bhai chai bana.",
  "Kal pakka karenge.",
  "Ek baar restart karke dekh.",
  "Jugaad is a lifestyle."
]
```

Display one quote prominently.

Automatically change every few seconds.

Use smooth fade/slide animations.

Also provide a small manual refresh button.

---

# CENTRAL VISUAL

Every theme should have one strong central visual.

Examples:

Judaad House:

A stylized messy engineering desk/room.

Metro:

Metro coach/window.

Indian Train:

Train window/coach.

Cab:

Car window/city road.

Office:

Desk + laptop.

Do not rely on random stock images.

Prefer:

- CSS illustrations
- SVG
- generated/local artwork
- abstract graphics
- Three.js only if it genuinely improves the experience

The central visual should feel premium.

---

# NOSTALGIA DETAILS

Add small details that make the website feel alive.

Examples:

- Digital clock
- Date
- Weather-like ambient display if appropriate
- Tiny status indicators
- Fake ticket
- Route number
- Room number
- Station name
- Desk status
- Battery indicator
- WiFi indicator
- "Connection stable"
- Random funny status
- Small animated notifications

These should be subtle.

Do not overcrowd the UI.

---

# INTERACTIONS

Add meaningful interactions.

Examples:

## Judaad House

Clicking a screwdriver/tool:

> "Jugaad mode activated."

Clicking a coffee cup:

> "Chai required."

## Metro

Press keyboard:

`M`

→ Metro announcement animation.

## Train

Click window:

→ landscape movement speed changes.

## Cab

Click route:

→ route animation starts.

## Office

Press:

`Ctrl + K`

→ focus/music command panel.

Keep interactions optional and non-annoying.

---

# KEYBOARD SHORTCUTS

Implement:

```text
Space       → Play/Pause
Arrow Left  → Previous
Arrow Right → Next
M           → Mute
1           → Judaad House
2           → Metro
3           → Indian Train
4           → Cab Wala
5           → Office
```

Do not override browser shortcuts unnecessarily.

Show shortcuts somewhere subtle, such as an "?" help button.

---

# RESPONSIVE DESIGN

The website MUST work beautifully on:

- Desktop
- Laptop
- Tablet
- Mobile

Do not simply shrink the desktop design.

Create proper mobile layouts.

On mobile:

- Theme cards become horizontal/vertical scroll
- Music player becomes compact
- Central visual scales properly
- Text remains readable
- Animations remain smooth
- Touch targets are large enough

---

# VISUAL DESIGN

The design should be:

- Cinematic
- Nostalgic
- Modern
- Minimal
- Immersive
- Premium
- Personal
- Slightly playful

Avoid:

- Generic SaaS UI
- Generic dashboard design
- Excessive gradients
- Excessive glassmorphism
- Random stock photos
- Huge meaningless text
- Too many cards
- Overly complicated navigation

The website should feel like an **interactive digital memory**.

---

# PERFORMANCE

This website will be deployed on Netlify.

Optimize for:

- Fast initial loading
- Lazy loading
- Code splitting
- Optimized assets
- Efficient animations
- Avoid unnecessary re-renders
- Avoid huge JavaScript bundles
- Respect `prefers-reduced-motion`
- Mobile performance

Do not run expensive animations continuously when they are not visible.

---

# ACCESSIBILITY

Implement:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- ARIA labels where necessary
- Good color contrast
- Reduced motion support
- Accessible buttons
- Proper heading hierarchy

---

# DATA / CONFIGURATION

Keep theme and playlist data separate from UI logic.

I should be able to add a new theme like this:

```ts
{
  id: "college",
  name: "College Wala",
  description: "Backbench memories.",
  playlists: [
    {
      id: "college-vibes",
      name: "College Vibes",
      youtubePlaylistId: "..."
    }
  ],
  quotes: [
    "Attendance?",
    "Proxy laga dena.",
    "Kal se pakka padhai."
  ]
}
```

After adding this configuration, the new theme should automatically appear in the theme selector.

This is a critical requirement.

---

# FUTURE UPGRADEABILITY

Architect the application so future features can be added easily:

- 20+ themes
- 50+ playlists
- User-created themes
- Theme editor
- Playlist editor
- Custom quotes
- Ambient sound
- Weather-based themes
- Time-based themes
- Automatic mode suggestions
- Login
- Cloud database
- User profiles
- Favorites
- Recently played
- Spotify integration in future
- YouTube Music integration if legally/API feasible
- PWA
- Offline UI shell
- Shared theme URLs
- QR code to share a vibe
- "Create your own mode"

Do not implement all future features now.

Instead, create clean architecture that does not block them.

---

# LOCAL STORAGE

Persist:

- Selected theme
- Selected playlist
- Volume
- Mute state
- UI preferences

Example:

```text
localStorage
├── selectedTheme
├── selectedPlaylist
├── volume
└── preferences
```

On reload, restore the previous experience where technically possible.

---

# URL SHARING

Make themes shareable through URL parameters.

Example:

```text
/?mode=judaad-house
/?mode=metro
/?mode=indian-train
/?mode=cab-wala
/?mode=office
```

If a user opens:

```text
/?mode=metro
```

the website should automatically open Metro Mode.

Design the architecture so this can later become:

```text
/?mode=metro&playlist=metro-night
```

---

# COMPONENT ARCHITECTURE

Create reusable components such as:

```text
App
ThemeProvider
ThemeSelector
ThemeCard
ThemeBackground
Hero
CentralVisual
QuoteRotator
MusicPlayer
PlaylistSelector
YouTubePlayer
StatusBar
KeyboardShortcuts
AmbientEffects
TransitionOverlay
SettingsPanel
```

Avoid giant components.

Keep business logic separate from presentation.

---

# STATE MANAGEMENT

Use a simple state management approach.

Do not introduce Redux unless actually necessary.

Create clear state for:

```text
currentTheme
currentPlaylist
currentTrack
isPlaying
volume
progress
isMuted
```

---

# ERROR HANDLING

Handle:

- Invalid YouTube playlist ID
- YouTube API failure
- Playlist unavailable
- Network failure
- Unsupported browser
- Autoplay restrictions
- Empty playlist
- Missing theme configuration

The website should never completely break because one playlist fails.

Display friendly messages.

Example:

> "YouTube is taking a chai break. Try again."

---

# AUTOPLAY

Respect browser autoplay restrictions.

Do NOT attempt to bypass browser policies.

If autoplay is blocked:

Show:

> "Press play to start the vibe."

The first user interaction can start the music.

---

# SETTINGS

Create a small settings panel.

Possible options:

- Theme
- Playlist
- Volume
- Motion effects ON/OFF
- Ambient effects ON/OFF
- Keyboard shortcuts
- Reduce motion

Keep it minimal.

---

# LANDING EXPERIENCE

The first screen should be memorable.

Example:

```text
WHERE ARE YOU RIGHT NOW?

Choose your vibe.

[ 🏠 JUDAAD HOUSE ]
[ 🚇 METRO ]
[ 🚂 INDIAN TRAIN ]
[ 🚕 CAB WALA ]
[ 💼 OFFICE ]
```

After selecting:

The UI transforms into that world.

---

# TRANSITIONS

When changing themes, create a short transition.

For example:

Judaad House → Metro:

```text
current UI fades
↓
motion blur
↓
ambient sound/animation
↓
metro visual appears
↓
new colors appear
↓
playlist changes
↓
new quote appears
```

Keep it around 500–1000ms.

It should feel polished, not slow.

---

# DESIGN DETAILS FOR JUDAAD HOUSE

This is the flagship theme.

Make it especially detailed.

Possible title:

> JUDAAD HOUSE

Subtitle:

> Three engineers. One rented house. Infinite jugaad.

Possible status:

```text
ROOMMATES        03
ENGINEERS        03
PROPER SOLUTIONS 00
CHAI LEVEL       ████████░░
SLEEP LEVEL      ██░░░░░░░░
```

Create fictional engineer identities/types:

```text
SOFTWARE
MECHANICAL
ELECTRICAL
```

Show them subtly as part of the environment.

Example:

```text
> SOFTWARE: debugging...
> MECHANICAL: designing...
> ELECTRICAL: checking voltage...
```

Do not make this look like a corporate team page.

It should feel like an inside joke between three friends.

---

# CONTENT

Generate authentic copy based on the theme.

Avoid corporate marketing language.

Use natural Indian English/Hinglish where appropriate.

Examples:

> "Bhai volume thoda badha."

> "Kal subah jaldi uthna hai."

> "Ek last song."

> "5 minute aur."

> "Chai?"

> "Bhai ye wire kidhar ja raha hai?"

Use moderation.

The website should feel personal, not like a meme website.

---

# ASSETS

If external assets are required:

- Prefer open/free assets with appropriate licensing.
- Do not hotlink random images.
- Keep important assets locally when possible.
- Optimize images.
- Use SVG/CSS illustrations where practical.

Do not make the website dependent on an external image service for its core UI.

---

# SEO

Add:

- Proper title
- Meta description
- Open Graph metadata
- Theme-aware page title where appropriate
- Favicon
- Semantic structure

Example title:

```text
Judaad House — Three Engineers. One House. Infinite Jugaad.
```

For Metro:

```text
Metro Mode — Press Play and Watch the City Move.
```

---

# NETLIFY DEPLOYMENT

Ensure the project works correctly on Netlify.

Create/configure:

```text
netlify.toml
```

if necessary.

Ensure:

- Production build works
- SPA routes work
- Environment variables are handled correctly
- No hard-coded localhost URLs
- No development-only code
- No secret API keys committed to Git

If environment variables are needed, create:

```text
.env.example
```

with clear instructions.

---

# README

Create/update a proper README explaining:

1. Project overview
2. Tech stack
3. Installation
4. Development
5. Production build
6. Netlify deployment
7. How to add a new theme
8. How to add a YouTube playlist
9. How to modify quotes
10. How to add new animations
11. Environment variables
12. Project architecture

Most importantly, include a section:

# How to Add a New Theme

Show a complete example.

---

# CODE QUALITY

Follow:

- TypeScript strict typing
- Reusable components
- Clean naming
- No unnecessary duplication
- No giant files
- No hard-coded theme logic scattered everywhere
- No magic numbers where avoidable
- No unused dependencies
- No unused files
- No console errors
- No TypeScript errors
- No broken imports

Add comments only where they genuinely help.

---

# SECURITY

Never expose:

- API secrets
- Private keys
- Firebase admin credentials
- Service account credentials
- Private tokens

Remember:

Anything in frontend JavaScript is publicly visible.

---

# FINAL TESTING

After implementation:

1. Run the development server.
2. Test every theme.
3. Test every theme transition.
4. Test playlist switching.
5. Test play/pause.
6. Test next/previous.
7. Test volume.
8. Test mobile layout.
9. Test keyboard shortcuts.
10. Test LocalStorage.
11. Test URL-based theme selection.
12. Test page refresh.
13. Test invalid playlist handling.
14. Test production build.
15. Check browser console.
16. Check TypeScript errors.
17. Check lint errors.
18. Check Netlify compatibility.

Fix all obvious problems before finishing.

---

# IMPORTANT DEVELOPMENT RULE

Do not stop after creating a basic prototype.

I want a **complete, polished website**, not:

- a wireframe
- a generic dashboard
- a basic music player
- five colored backgrounds
- placeholder cards

The result should feel like a real creative product that someone would want to keep open while travelling, working, or hanging out at home.

---

# FINAL DELIVERABLE

At the end provide:

1. Complete working website.
2. Clean source code.
3. Modular theme architecture.
4. YouTube playlist configuration system.
5. Responsive UI.
6. Animations.
7. Keyboard interactions.
8. LocalStorage persistence.
9. URL-based theme selection.
10. Netlify-ready production build.
11. README documentation.
12. `.env.example` if required.

Before finishing, perform a complete codebase review and remove obvious bugs, dead code, unused dependencies, and console errors.

## MOST IMPORTANT PRODUCT PRINCIPLE

Think of the website as:

> **"Spotify meets your daily life memories."**

The user isn't simply selecting a color theme.

They are selecting:

**WHERE THEY ARE + WHAT THEY FEEL + WHAT MUSIC THEY WANT.**

Make every mode feel like entering a different little world.