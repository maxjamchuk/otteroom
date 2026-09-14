# Contract: TMDB Attribution and Branding

Feature 006 must ship a reachable About/Credits-type surface from normal app
navigation on supported Expo targets.

It must contain:

1. an approved TMDB logo obtained from the official
   [Logos & Attribution](https://www.themoviedb.org/about/logos-attribution?language=en-US)
   page;
2. the exact prominent notice:

   > This product uses the TMDB API but is not endorsed or certified by TMDB.

3. a link to `https://www.themoviedb.org`; and
4. the approved name “TMDB” or “The Movie Database”.

The TMDB logo must be less prominent than Otteroom branding, preserve approved
color and aspect ratio, and not be flipped, rotated or used to imply endorsement.
Do not redraw/generate a substitute logo.

The logo asset may be versioned as a compliance asset; that does not create movie
metadata authority. Accessibility text must identify TMDB without implying
certification.

Required evidence:

- client/component test for exact notice, link, accessible logo and reachable
  navigation;
- asset provenance/check that the file is an approved unmodified variant;
- one folded J01 browser assertion proving the About/Credits surface is reachable;
- no screenshot/diagnostic exception and no additional Auth identity.

Non-commercial use still depends on required attribution. Commercial licensing
review is outside Feature 006 but cannot be inferred from API-key possession.
