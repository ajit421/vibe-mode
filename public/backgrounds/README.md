# Background images

Drop one `.png` per mode here, then point the matching variable in `.env` at it:

```
VITE_IMAGE_METRO=/backgrounds/metro.png
```

Variable names come from the theme id — `metro` → `VITE_IMAGE_METRO`,
`judaad-house` → `VITE_IMAGE_JUDAAD_HOUSE`. See `src/themes/backgrounds.ts`.

Aim for roughly **10:7 landscape** (2000×1400 is a good size). That matches the
shape of the background box, so the image is shown whole with nothing cropped.
Other shapes still work — they are cover-fitted, so the long edge gets trimmed.

Files here are served by the site itself, so they keep working offline and do
not depend on a third-party host.
