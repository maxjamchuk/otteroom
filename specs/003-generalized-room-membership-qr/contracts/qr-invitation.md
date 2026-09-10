# Contract: QR Invitation

## Payload and ownership

QR value is exactly `invitationLink(authoritativeRoomCode)` from
`src/rooms/code.ts`, shared with the textual invitation. Web uses the current
page origin and `/room/<CANONICAL_CODE>`; native uses Expo Linking for that same
route under the compatible installed app/Expo runtime. Do not construct a
different hostname or target for QR alone.

No extra token, Auth/member/user ID, session credential, query identity, QR
table, stored QR data or separate join/auth operation. External scanning opens
the existing room route; join_room handles normal new voters and member recovery.
Malformed/unknown/full targets retain normal invitation outcomes.

## Display implementation direction

Future component: `src/rooms/invitation-qr.tsx`, taking one required `value:
string` invitation prop. Use react-native-qrcode-svg 6.3.24 with Expo-selected
react-native-svg 15.15.4, installed only during implementation. Tests live in
`__tests__/rooms/invitation-qr.test.tsx`.

Use black modules, opaque white background, error correction M, size 240 logical
pixels and quietZone 48. The selected library expands its viewBox for the margin
while retaining a 240×240 rendered footprint. This provides at least four
modules of quiet area; layout must fit the mobile viewport and remain scrollable.
No logo, gradient, remote image, custom transformer, animation or scanner.

A labelled accessible RN wrapper identifies the invitation QR; selectable link
and code remain independent accessible alternatives. Do not assume the library
forwards arbitrary accessibility props. The wrapper bounds and SVG must be
visible, unobscured and nonzero for acceptance.

A small value-keyed local error boundary contains encoding/render failures. Do
not update a parent during the library's render-time onError callback. Generic
QR-unavailable feedback preserves room/count/member state and textual link/code.
Any explicit QR retry remounts the same value only, invoking neither room nor
candidate RPC. No external QR generation fallback.

Room integration occurs after the atomic membership cutover. Show QR with the
creator's invitations in either voting mode; recovery derives the same value
from the accepted room. Retain invitation access after assembly; new admissions
still receive full. No UI participant IDs or future movie controls.

## Automated encoding and join evidence

Future `e2e/support/qr-harness.ts` uses independent test-only jsqr 1.4.0. Every
call remains inside the existing safe test/diagnostic runner:

1. Assert current wrapper/SVG visibility, positive geometry and viewport bounds;
   scroll to the component through normal page interaction where necessary.
   Use DOM hit-testing at interior points to reject an unrelated covering
   element; visibility alone is not non-occlusion evidence.
   Check ordinary credential-safe text/attributes using the existing non-capture
   inspection, then read the displayed invitation in memory.
2. Select only that QR SVG subtree. Require at most 64 KiB serialized SVG and
   at most 512x512 RGBA pixels, with bounded attributes. Allow the selected
   library's static SVG geometry/definitions
   only; reject scripts, foreignObject, embedded raster images, event handlers,
   external href/CSS/fonts/URLs and any unrecognized content. This is not a
   whole-page HTML or arbitrary DOM capture API.
3. Serialize the actual selected subtree only into memory, rasterize its SVG
   through a Blob URL/Image into a detached canvas, and obtain bounded RGBA
   pixels. Preserve the rendered viewBox, colors, geometry and quiet zone.
4. Decode with jsQR (independent of the encoder). Require a result exactly equal
   to the textual invitation and expected room target. An echoed value prop,
   data attribute or generator self-inspection is insufficient.
5. Navigate an independent participant context to the decoded URL and let the
   real Auth/RPC/database/Realtime flow admit exactly one normal voter. Assert
   current count, authorization and same room; QR is not a new identity scheme.
6. Revoke Blob URLs, clear buffers and dispose temporary references on success
   or failure. Do not persist/attach SVG, pixels, decoded payload or images.
   Assertions use boolean comparisons and generic safe errors, avoiding payload
   diffs. Existing scanner must finish with zero findings.

This proves visible rendered-symbol encoding and actual normal admission. It
does not claim optical-camera simulation or screenshot-based compositing proof.
G01 checks every creator/count invitation, G05 performs decoded-target first
admission, and G06/G07 test QR/link/code recovery and full rejection.

## C1 remains unchanged

No page/locator screenshot, trace, HAR, video, storage-state export or raw
Auth/request/Realtime dump. Strict diagnostic screenshot eligibility continues
to reject visible SVG/canvas/images/background images. Memory-only decoding is
an acceptance assertion, never authorization for retained captures. Keep safe
reporter, registry, sanitizer/scanner and controlled static-surface C1 probe.

## Physical device reachability and native limits

Loopback URLs (`127.0.0.1`/`localhost`) on the development computer are not
reachable as that computer from a physical phone. Browser Docker acceptance
uses the existing loopback forwarding and is not evidence otherwise.

For supplemental phone validation, open the creator page via a reachable LAN
web origin and use a phone-reachable public local Supabase URL. Allow the
development web/API/Realtime ports as needed. Preserve the public client key;
never expose server credentials. The unchanged invitation helper then emits
the identical LAN link/QR target. Count any manual anonymous signups separately.

Native Linking targets require a compatible installed app/runtime; Expo Go and
installed scheme behavior differ. Native bundle checks prove module resolution,
not physical native rendering. Production universal links, camera/scanner,
domain deployment and TV remain outside Feature 003.
